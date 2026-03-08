/**
 * Triggers a browser download of a CSV file built from an array of row objects.
 * Column names come from the first row's keys.
 */
export function downloadCsv(
	filename: string,
	rows: Record<string, unknown>[],
): void {
	if (!rows.length) return;
	const headers = Object.keys(rows[0]!);
	const csv = [
		headers.join(","),
		...rows.map((r) =>
			headers
				.map((h) => {
					const v = String(r[h] ?? "");
					return v.includes(",") || v.includes('"')
						? `"${v.replace(/"/g, '""')}"`
						: v;
				})
				.join(","),
		),
	].join("\n");
	const blob = new Blob([csv], { type: "text/csv" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}
