/**
 * AES-256-GCM symmetric encryption for secrets stored at rest.
 *
 * Encrypted values are prefixed with "enc:v1:" so legacy plaintext values
 * are detected automatically — no migration script required.
 *
 * Format: enc:v1:<iv_hex>:<ciphertext_hex>:<auth_tag_hex>
 *
 * Key source: process.env.SECRET_ENCRYPTION_KEY (64 hex chars = 32 bytes)
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const ENC_PREFIX = "enc:v1:";

function getKey(): Buffer {
	const raw = process.env.SECRET_ENCRYPTION_KEY;
	if (!raw || raw.length < 32) {
		throw new Error(
			"SECRET_ENCRYPTION_KEY must be set and at least 32 characters",
		);
	}
	// Accept either a 64-char hex string (32 bytes) or any 32+ char string
	if (/^[0-9a-fA-F]{64}$/.test(raw)) {
		return Buffer.from(raw, "hex");
	}
	// Fallback: use first 32 bytes of the string directly
	return Buffer.from(raw.slice(0, 32), "utf8");
}

/**
 * Encrypts a plaintext string. Returns an "enc:v1:..." prefixed string.
 * Returns null if input is null.
 */
export function encrypt(plaintext: string): string {
	const key = getKey();
	const iv = randomBytes(12); // 96-bit IV for GCM
	const cipher = createCipheriv(ALGORITHM, key, iv);

	const encrypted = Buffer.concat([
		cipher.update(plaintext, "utf8"),
		cipher.final(),
	]);
	const authTag = cipher.getAuthTag();

	return `${ENC_PREFIX}${iv.toString("hex")}:${encrypted.toString("hex")}:${authTag.toString("hex")}`;
}

/**
 * Decrypts an "enc:v1:..." string back to plaintext.
 * If the value does not start with the prefix (legacy plaintext), returns as-is.
 * Returns null if input is null.
 */
export function decrypt(value: string): string {
	if (!value.startsWith(ENC_PREFIX)) {
		// Legacy plaintext — return unchanged
		return value;
	}
	const payload = value.slice(ENC_PREFIX.length);
	const parts = payload.split(":");
	if (parts.length !== 3) {
		throw new Error("Invalid encrypted value format");
	}
	const [ivHex, ciphertextHex, authTagHex] = parts as [string, string, string];

	const key = getKey();
	const iv = Buffer.from(ivHex, "hex");
	const ciphertext = Buffer.from(ciphertextHex, "hex");
	const authTag = Buffer.from(authTagHex, "hex");

	const decipher = createDecipheriv(ALGORITHM, key, iv);
	decipher.setAuthTag(authTag);

	return decipher.update(ciphertext).toString("utf8") + decipher.final("utf8");
}

/** Returns true if the value is already encrypted with our scheme. */
export function isEncrypted(value: string): boolean {
	return value.startsWith(ENC_PREFIX);
}
