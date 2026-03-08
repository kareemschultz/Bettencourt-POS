import { beforeAll, describe, expect, test } from "bun:test";

// Set key before importing module so the env is ready
beforeAll(() => {
	process.env.SECRET_ENCRYPTION_KEY = "a".repeat(64); // 64 hex chars = valid 32-byte key
});

// Dynamic import so the env is set first
const { encrypt, decrypt, isEncrypted } = await import("../lib/crypto");

describe("crypto — AES-256-GCM round-trip", () => {
	test("encrypt produces enc:v1: prefix", () => {
		const result = encrypt("hello");
		expect(result.startsWith("enc:v1:")).toBe(true);
	});

	test("encrypt then decrypt returns original plaintext", () => {
		const original = "AC1234567890abcdef";
		const encrypted = encrypt(original);
		expect(decrypt(encrypted)).toBe(original);
	});

	test("each encryption produces a different ciphertext (unique IV)", () => {
		const a = encrypt("same value");
		const b = encrypt("same value");
		expect(a).not.toBe(b);
		// But both decrypt to the same thing
		expect(decrypt(a)).toBe(decrypt(b));
	});

	test("decrypt passes through legacy plaintext unchanged", () => {
		const legacy = "ACabcdef1234567890";
		expect(decrypt(legacy)).toBe(legacy);
	});

	test("isEncrypted returns true only for enc:v1: prefixed values", () => {
		expect(isEncrypted(encrypt("test"))).toBe(true);
		expect(isEncrypted("plaintext")).toBe(false);
		expect(isEncrypted("enc:v2:something")).toBe(false);
	});

	test("decrypt throws on malformed enc:v1: payload", () => {
		expect(() => decrypt("enc:v1:badinput")).toThrow(
			"Invalid encrypted value format",
		);
	});

	test("encrypts special characters and unicode", () => {
		const special = "ACabc!@#$%^&*()_+-=[]{}|;':\",./<>?";
		expect(decrypt(encrypt(special))).toBe(special);
	});

	test("encrypts empty string", () => {
		expect(decrypt(encrypt(""))).toBe("");
	});
});
