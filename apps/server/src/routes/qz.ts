// Env vars store the PEM files as base64 to avoid multiline issues in
// Docker Compose env_file handling (which doesn't expand \n escapes).
export function decodePem(b64: string | undefined): string {
	if (!b64) return "";
	try {
		return Buffer.from(b64, "base64").toString("utf8");
	} catch {
		return "";
	}
}
