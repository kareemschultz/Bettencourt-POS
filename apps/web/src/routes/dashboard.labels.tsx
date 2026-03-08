import { useQuery } from "@tanstack/react-query";
import { Barcode, CheckSquare, Info, Printer, Square, Tag } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { formatGYD } from "@/lib/types";
import { orpc } from "@/utils/orpc";

// ── Code128 Barcode Encoder ──────────────────────────────────────────
// Pure JS Code128B encoder: converts a string to an array of bar widths
// Returns an array of 0s and 1s representing black(1) and white(0) bars

const CODE128B_START = 104;
const CODE128_STOP = 106;

const CODE128_PATTERNS: number[][] = [
	[2, 1, 2, 2, 2, 2],
	[2, 2, 2, 1, 2, 2],
	[2, 2, 2, 2, 2, 1],
	[1, 2, 1, 2, 2, 3],
	[1, 2, 1, 3, 2, 2],
	[1, 3, 1, 2, 2, 2],
	[1, 2, 2, 2, 1, 3],
	[1, 2, 2, 3, 1, 2],
	[1, 3, 2, 2, 1, 2],
	[2, 2, 1, 2, 1, 3],
	[2, 2, 1, 3, 1, 2],
	[2, 3, 1, 2, 1, 2],
	[1, 1, 2, 2, 3, 2],
	[1, 2, 2, 1, 3, 2],
	[1, 2, 2, 2, 3, 1],
	[1, 1, 3, 2, 2, 2],
	[1, 2, 3, 1, 2, 2],
	[1, 2, 3, 2, 2, 1],
	[2, 2, 3, 2, 1, 1],
	[2, 2, 1, 1, 3, 2],
	[2, 2, 1, 2, 3, 1],
	[2, 1, 3, 2, 1, 2],
	[2, 2, 3, 1, 1, 2],
	[3, 1, 2, 1, 3, 1],
	[3, 1, 1, 2, 2, 2],
	[3, 2, 1, 1, 2, 2],
	[3, 2, 1, 2, 2, 1],
	[3, 1, 2, 2, 1, 2],
	[3, 2, 2, 1, 1, 2],
	[3, 2, 2, 2, 1, 1],
	[2, 1, 2, 1, 2, 3],
	[2, 1, 2, 3, 2, 1],
	[2, 3, 2, 1, 2, 1],
	[1, 1, 1, 3, 2, 3],
	[1, 3, 1, 1, 2, 3],
	[1, 3, 1, 3, 2, 1],
	[1, 1, 2, 3, 1, 3],
	[1, 3, 2, 1, 1, 3],
	[1, 3, 2, 3, 1, 1],
	[2, 1, 1, 3, 1, 3],
	[2, 3, 1, 1, 1, 3],
	[2, 3, 1, 3, 1, 1],
	[1, 1, 2, 1, 3, 3],
	[1, 1, 2, 3, 3, 1],
	[1, 3, 2, 1, 3, 1],
	[1, 1, 3, 1, 2, 3],
	[1, 1, 3, 3, 2, 1],
	[1, 3, 3, 1, 2, 1],
	[3, 1, 3, 1, 2, 1],
	[2, 1, 1, 3, 3, 1],
	[2, 3, 1, 1, 3, 1],
	[2, 1, 3, 1, 1, 3],
	[2, 1, 3, 3, 1, 1],
	[2, 1, 3, 1, 3, 1],
	[3, 1, 1, 1, 2, 3],
	[3, 1, 1, 3, 2, 1],
	[3, 3, 1, 1, 2, 1],
	[3, 1, 2, 1, 1, 3],
	[3, 1, 2, 3, 1, 1],
	[3, 3, 2, 1, 1, 1],
	[3, 1, 4, 1, 1, 1],
	[2, 2, 1, 4, 1, 1],
	[4, 3, 1, 1, 1, 1],
	[1, 1, 1, 2, 2, 4],
	[1, 1, 1, 4, 2, 2],
	[1, 2, 1, 1, 2, 4],
	[1, 2, 1, 4, 2, 1],
	[1, 4, 1, 1, 2, 2],
	[1, 4, 1, 2, 2, 1],
	[1, 1, 2, 2, 1, 4],
	[1, 1, 2, 4, 1, 2],
	[1, 2, 2, 1, 1, 4],
	[1, 2, 2, 4, 1, 1],
	[1, 4, 2, 1, 1, 2],
	[1, 4, 2, 2, 1, 1],
	[2, 4, 1, 2, 1, 1],
	[2, 2, 1, 1, 1, 4],
	[4, 1, 3, 1, 1, 1],
	[2, 4, 1, 1, 1, 2],
	[1, 3, 4, 1, 1, 1],
	[1, 1, 1, 2, 4, 2],
	[1, 2, 1, 1, 4, 2],
	[1, 2, 1, 2, 4, 1],
	[1, 1, 4, 2, 1, 2],
	[1, 2, 4, 1, 1, 2],
	[1, 2, 4, 2, 1, 1],
	[4, 1, 1, 2, 1, 2],
	[4, 2, 1, 1, 1, 2],
	[4, 2, 1, 2, 1, 1],
	[2, 1, 2, 1, 4, 1],
	[2, 1, 4, 1, 2, 1],
	[4, 1, 2, 1, 2, 1],
	[1, 1, 1, 1, 4, 3],
	[1, 1, 1, 3, 4, 1],
	[1, 3, 1, 1, 4, 1],
	[1, 1, 4, 1, 1, 3],
	[1, 1, 4, 3, 1, 1],
	[4, 1, 1, 1, 1, 3],
	[4, 1, 1, 3, 1, 1],
	[1, 1, 3, 1, 4, 1],
	[1, 1, 4, 1, 3, 1],
	[3, 1, 1, 1, 4, 1],
	[4, 1, 1, 1, 3, 1],
	[2, 1, 1, 4, 1, 2],
	[2, 1, 1, 2, 1, 4],
	[2, 1, 1, 2, 3, 2],
	[2, 3, 3, 1, 1, 1, 2],
];

function encodeCode128B(text: string): number[] {
	const codes: number[] = [CODE128B_START];
	for (let i = 0; i < text.length; i++) {
		const code = text.charCodeAt(i) - 32;
		if (code < 0 || code > 95) continue; // skip non-printable
		codes.push(code);
	}

	// Calculate checksum
	let checksum = codes[0]!;
	for (let i = 1; i < codes.length; i++) {
		checksum += codes[i]! * i;
	}
	checksum = checksum % 103;
	codes.push(checksum);
	codes.push(CODE128_STOP);

	// Convert to bar pattern
	const bars: number[] = [];
	for (const code of codes) {
		const pattern = CODE128_PATTERNS[code];
		if (!pattern) continue;
		let isBar = true;
		for (const width of pattern) {
			for (let j = 0; j < width; j++) {
				bars.push(isBar ? 1 : 0);
			}
			isBar = !isBar;
		}
	}

	return bars;
}

// ── EAN-13 Barcode Encoder ──────────────────────────────────────────
// Pure JS EAN-13 encoder: converts a 12- or 13-digit string to bar pattern

const EAN_L_PATTERNS: number[][] = [
	[0, 0, 0, 1, 1, 0, 1],
	[0, 0, 1, 1, 0, 0, 1],
	[0, 0, 1, 0, 0, 1, 1],
	[0, 1, 1, 1, 1, 0, 1],
	[0, 1, 0, 0, 0, 1, 1],
	[0, 1, 1, 0, 0, 0, 1],
	[0, 1, 0, 1, 1, 1, 1],
	[0, 1, 1, 1, 0, 1, 1],
	[0, 1, 1, 0, 1, 1, 1],
	[0, 0, 0, 1, 0, 1, 1],
];

const EAN_G_PATTERNS: number[][] = [
	[0, 1, 0, 0, 1, 1, 1],
	[0, 1, 1, 0, 0, 1, 1],
	[0, 0, 1, 1, 0, 1, 1],
	[0, 1, 0, 0, 0, 0, 1],
	[0, 0, 1, 1, 1, 0, 1],
	[0, 1, 1, 1, 0, 0, 1],
	[0, 0, 0, 0, 1, 0, 1],
	[0, 0, 1, 0, 0, 0, 1],
	[0, 0, 0, 1, 0, 0, 1],
	[0, 0, 1, 0, 1, 1, 1],
];

const EAN_R_PATTERNS: number[][] = [
	[1, 1, 1, 0, 0, 1, 0],
	[1, 1, 0, 0, 1, 1, 0],
	[1, 1, 0, 1, 1, 0, 0],
	[1, 0, 0, 0, 0, 1, 0],
	[1, 0, 1, 1, 1, 0, 0],
	[1, 0, 0, 1, 1, 1, 0],
	[1, 0, 1, 0, 0, 0, 0],
	[1, 0, 0, 0, 1, 0, 0],
	[1, 0, 0, 1, 0, 0, 0],
	[1, 1, 1, 0, 1, 0, 0],
];

// Parity patterns for the left half, indexed by the first digit
const EAN_PARITY: string[] = [
	"LLLLLL",
	"LLGLGG",
	"LLGGLG",
	"LLGGGL",
	"LGLLGG",
	"LGGLLG",
	"LGGGLL",
	"LGLGLG",
	"LGLGGL",
	"LGGLGL",
];

function encodeEAN13(digits: string): number[] {
	// Strip non-digits
	const clean = digits.replace(/\D/g, "");

	let ean: number[];
	if (clean.length === 12) {
		// Calculate check digit
		ean = clean.split("").map(Number);
		let sum = 0;
		for (let i = 0; i < 12; i++) {
			sum += ean[i]! * (i % 2 === 0 ? 1 : 3);
		}
		ean.push((10 - (sum % 10)) % 10);
	} else if (clean.length === 13) {
		ean = clean.split("").map(Number);
		// Validate check digit
		let sum = 0;
		for (let i = 0; i < 12; i++) {
			sum += ean[i]! * (i % 2 === 0 ? 1 : 3);
		}
		const expected = (10 - (sum % 10)) % 10;
		if (ean[12] !== expected) {
			// Invalid check digit — recalculate
			ean[12] = expected;
		}
	} else {
		// Fall back to code128 for non-EAN strings
		return encodeCode128B(digits);
	}

	const firstDigit = ean[0]!;
	const parity = EAN_PARITY[firstDigit]!;

	const bars: number[] = [];

	// Start guard: 101
	bars.push(1, 0, 1);

	// Left half: digits 1-6
	for (let i = 0; i < 6; i++) {
		const digit = ean[i + 1]!;
		const pattern =
			parity[i] === "L" ? EAN_L_PATTERNS[digit]! : EAN_G_PATTERNS[digit]!;
		bars.push(...pattern);
	}

	// Center guard: 01010
	bars.push(0, 1, 0, 1, 0);

	// Right half: digits 7-12
	for (let i = 0; i < 6; i++) {
		const digit = ean[i + 7]!;
		bars.push(...EAN_R_PATTERNS[digit]!);
	}

	// End guard: 101
	bars.push(1, 0, 1);

	return bars;
}

function BarcodeCanvas({
	text,
	width = 200,
	height = 50,
	format = "code128",
}: {
	text: string;
	width?: number;
	height?: number;
	format?: "code128" | "ean13";
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas || !text) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const bars = format === "ean13" ? encodeEAN13(text) : encodeCode128B(text);
		const barWidth = width / bars.length;

		ctx.clearRect(0, 0, width, height);
		ctx.fillStyle = "#000";

		for (let i = 0; i < bars.length; i++) {
			if (bars[i]) {
				ctx.fillRect(i * barWidth, 0, barWidth, height);
			}
		}
	}, [text, width, height, format]);

	return (
		<canvas ref={canvasRef} width={width} height={height} className="mx-auto" />
	);
}

type LabelFormat = "shelf" | "price_tag" | "receipt";

export default function LabelsPage() {
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [labelFormat, setLabelFormat] = useState<LabelFormat>("shelf");
	const [showPreview, setShowPreview] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [quantities, setQuantities] = useState<Record<string, number>>({});

	const { data: productsData, isLoading } = useQuery(
		orpc.pos.getProducts.queryOptions({ input: {} }),
	);
	const allProducts = productsData?.products ?? [];

	const filteredProducts = allProducts.filter(
		(p) =>
			p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			p.sku?.toLowerCase().includes(searchQuery.toLowerCase()),
	);

	const selectedProducts = allProducts.filter((p) => selectedIds.has(p.id));

	function toggleProduct(id: string) {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	}

	function selectAll() {
		setSelectedIds(new Set(filteredProducts.map((p) => p.id)));
	}

	function deselectAll() {
		setSelectedIds(new Set());
	}

	function handlePrint() {
		window.print();
	}

	const totalLabelCount = selectedProducts.reduce(
		(sum, p) => sum + (quantities[p.id] || 1),
		0,
	);

	const gridCols =
		labelFormat === "shelf"
			? "grid-cols-3"
			: labelFormat === "receipt"
				? "grid-cols-4"
				: "grid-cols-4";

	return (
		<>
			{/* Print-only styles */}
			<style>{`
        @media print {
          body * { visibility: hidden !important; }
          #label-print-area, #label-print-area * { visibility: visible !important; }
          #label-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 0.25in !important;
          }
          @page {
            margin: 0.25in;
            size: letter;
          }
        }
      `}</style>

			<div className="space-y-6 p-4 md:p-6 print:hidden">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="flex items-center gap-2 font-bold text-2xl">
							<Printer className="size-6 text-primary" />
							Barcode Labels
						</h1>
						<p className="text-muted-foreground text-sm">
							Select products below, choose a label format, preview, and print.
							Labels include barcode, product name, and price.
						</p>
					</div>
					<div className="flex items-center gap-3">
						<Select
							value={labelFormat}
							onValueChange={(v) => setLabelFormat(v as LabelFormat)}
						>
							<SelectTrigger className="w-48">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="shelf">Shelf Label</SelectItem>
								<SelectItem value="price_tag">Price Tag (Compact)</SelectItem>
								<SelectItem value="receipt">Receipt Sticker (58mm)</SelectItem>
							</SelectContent>
						</Select>
						<Button
							variant="outline"
							onClick={() => setShowPreview(!showPreview)}
							disabled={selectedIds.size === 0}
						>
							<Barcode className="mr-2 size-4" />
							{showPreview ? "Hide Preview" : "Preview"}
						</Button>
						<Button
							className="bg-emerald-600 text-white hover:bg-emerald-700"
							onClick={handlePrint}
							disabled={selectedIds.size === 0}
						>
							<Printer className="mr-2 size-4" />
							Print Labels
							{totalLabelCount > 0 && (
								<Badge
									variant="secondary"
									className="ml-2 bg-white/20 text-white text-xs"
								>
									{totalLabelCount}
								</Badge>
							)}
						</Button>
					</div>
				</div>

				{/* Info banner */}
				<div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-blue-800 text-sm dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
					<Info className="mt-0.5 size-4 shrink-0" />
					<span>
						Print barcode labels for shelf pricing, price tags, or receipt-width
						stickers. Select products, set quantities, and preview before
						printing.
					</span>
				</div>

				{/* Product Selection */}
				<Card>
					<CardHeader className="pb-3">
						<div className="flex items-center justify-between">
							<CardTitle>Select Products</CardTitle>
							<div className="flex items-center gap-2">
								<Button variant="ghost" size="sm" onClick={selectAll}>
									<CheckSquare className="mr-1 size-3.5" />
									Select All
								</Button>
								<Button variant="ghost" size="sm" onClick={deselectAll}>
									<Square className="mr-1 size-3.5" />
									Deselect All
								</Button>
							</div>
						</div>
						<Input
							placeholder="Search products by name or SKU..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="mt-2"
						/>
					</CardHeader>
					<CardContent className="p-0">
						<div className="max-h-[45vh] overflow-y-auto">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="w-10" />
										<TableHead>Product</TableHead>
										<TableHead>SKU</TableHead>
										<TableHead>Price</TableHead>
										<TableHead>Category</TableHead>
										<TableHead className="w-20 text-center">Qty</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{isLoading ? (
										<TableRow>
											<TableCell
												colSpan={6}
												className="py-8 text-center text-muted-foreground"
											>
												<Skeleton className="h-4 w-full" />
											</TableCell>
										</TableRow>
									) : filteredProducts.length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={6}
												className="py-8 text-center text-muted-foreground"
											>
												<Tag className="mx-auto mb-2 size-8 opacity-50" />
												<p className="font-medium">No products found</p>
												<p className="mt-1 text-xs">
													Try a different search term, or add products in the
													inventory.
												</p>
											</TableCell>
										</TableRow>
									) : (
										filteredProducts.map((product) => (
											<TableRow
												key={product.id}
												className={
													selectedIds.has(product.id)
														? "bg-primary/5"
														: "cursor-pointer"
												}
												onClick={() => toggleProduct(product.id)}
											>
												<TableCell onClick={(e) => e.stopPropagation()}>
													<Checkbox
														checked={selectedIds.has(product.id)}
														onCheckedChange={() => toggleProduct(product.id)}
													/>
												</TableCell>
												<TableCell className="font-medium">
													{product.name}
												</TableCell>
												<TableCell className="font-mono text-sm">
													{product.sku || "---"}
												</TableCell>
												<TableCell>
													{formatGYD(Number(product.price))}
												</TableCell>
												<TableCell className="text-muted-foreground">
													{product.departmentName || "---"}
												</TableCell>
												<TableCell
													onClick={(e) => e.stopPropagation()}
													className="text-center"
												>
													{selectedIds.has(product.id) ? (
														<Input
															type="number"
															min={1}
															max={99}
															value={quantities[product.id] || 1}
															onChange={(e) => {
																const val = Math.max(
																	1,
																	Math.min(99, Number(e.target.value) || 1),
																);
																setQuantities((prev) => ({
																	...prev,
																	[product.id]: val,
																}));
															}}
															className="mx-auto h-8 w-16 text-center"
														/>
													) : (
														<span className="text-muted-foreground">-</span>
													)}
												</TableCell>
											</TableRow>
										))
									)}
								</TableBody>
							</Table>
						</div>
					</CardContent>
				</Card>

				{/* Preview */}
				{showPreview && selectedProducts.length > 0 && (
					<Card>
						<CardHeader>
							<CardTitle>Label Preview</CardTitle>
							<CardDescription>
								How your labels will look when printed. Use the Print button
								above to send to your printer.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className={`grid ${gridCols} gap-4`}>
								{selectedProducts.flatMap((product) =>
									Array.from(
										{ length: quantities[product.id] || 1 },
										(_, i) => (
											<LabelCard
												key={`${product.id}-${i}`}
												name={product.name}
												price={Number(product.price)}
												sku={product.sku || product.id.slice(0, 8)}
												format={labelFormat}
											/>
										),
									),
								)}
							</div>
						</CardContent>
					</Card>
				)}
			</div>

			{/* Printable area (always rendered for print) */}
			<div id="label-print-area" className="hidden print:block">
				<div className={`grid ${gridCols} gap-3`}>
					{selectedProducts.flatMap((product) =>
						Array.from({ length: quantities[product.id] || 1 }, (_, i) => (
							<LabelCard
								key={`${product.id}-print-${i}`}
								name={product.name}
								price={Number(product.price)}
								sku={product.sku || product.id.slice(0, 8)}
								format={labelFormat}
							/>
						)),
					)}
				</div>
			</div>
		</>
	);
}

function LabelCard({
	name,
	price,
	sku,
	format,
}: {
	name: string;
	price: number;
	sku: string;
	format: LabelFormat;
}) {
	if (format === "price_tag") {
		return (
			<div className="break-inside-avoid rounded border p-2 text-center">
				<div className="truncate font-medium text-xs leading-tight">{name}</div>
				<div className="mt-0.5 font-bold text-lg">{formatGYD(price)}</div>
				<div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
					{sku}
				</div>
			</div>
		);
	}

	if (format === "receipt") {
		// Receipt sticker format: narrow (58mm receipt paper width)
		return (
			<div
				className="break-inside-avoid rounded border p-2 text-center"
				style={{ maxWidth: "58mm" }}
			>
				<div className="truncate font-medium text-xs leading-tight">
					{name.length > 30 ? `${name.slice(0, 30)}...` : name}
				</div>
				<div className="mt-0.5 font-bold text-base">{formatGYD(price)}</div>
				<div className="mt-1">
					<BarcodeCanvas text={sku} width={150} height={35} />
				</div>
				<div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
					{sku}
				</div>
			</div>
		);
	}

	// Shelf Label
	return (
		<div className="break-inside-avoid rounded border p-3 text-center">
			<div className="truncate font-semibold text-sm">{name}</div>
			<div className="mt-1 font-bold text-xl">{formatGYD(price)}</div>
			<div className="mt-2">
				<BarcodeCanvas text={sku} width={180} height={40} />
			</div>
			<div className="mt-1 font-mono text-muted-foreground text-xs">{sku}</div>
		</div>
	);
}
