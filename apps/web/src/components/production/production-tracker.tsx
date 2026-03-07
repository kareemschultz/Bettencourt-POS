import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Check,
	CookingPot,
	Layers,
	Minus,
	Moon,
	Plus,
	RefreshCw,
	Sunrise,
	X,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { todayGY } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

type EntryType = "opening" | "reorder" | "closing";
type ProductItem = {
	id: string;
	name: string;
	department_id: string | null;
	department_name: string | null;
};
type ProductionTotal = {
	product_id: string;
	product_name: string;
	opening: number;
	reorder: number;
	closing: number;
};

const MODE_CONFIG: Record<
	EntryType,
	{
		label: string;
		subLabel: string;
		color: string;
		bg: string;
		icon: typeof Sunrise;
	}
> = {
	opening: {
		label: "Opening",
		subLabel: "Restaurant / Bakery",
		color: "text-blue-700 dark:text-blue-400",
		bg: "bg-blue-600",
		icon: Sunrise,
	},
	reorder: {
		label: "Reorder",
		subLabel: "Mid-day top-up",
		color: "text-amber-700 dark:text-amber-400",
		bg: "bg-amber-600",
		icon: RefreshCw,
	},
	closing: {
		label: "Closing",
		subLabel: "Damage / Spoilage",
		color: "text-emerald-700 dark:text-emerald-400",
		bg: "bg-emerald-600",
		icon: Moon,
	},
};

interface Props {
	products: ProductItem[];
	initialTotals: ProductionTotal[];
	userId: string;
	userName: string;
	comboProductIds: Set<string>;
}

export function ProductionTracker({
	products,
	initialTotals,
	userId,
	comboProductIds,
}: Props) {
	const queryClient = useQueryClient();
	const [mode, setMode] = useState<EntryType>("opening");
	const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(
		null,
	);
	const [quantity, setQuantity] = useState(0);
	const [notes, setNotes] = useState("");
	const [deptFilter, setDeptFilter] = useState<string>("all");
	const [workflow, setWorkflow] = useState<"restaurant" | "bakery">(
		"restaurant",
	);

	const today = todayGY();

	// Live-updating totals via oRPC polling
	const { data: prodData } = useQuery(
		orpc.production.getEntries.queryOptions({
			input: { date: today },
			query: { refetchInterval: 10000 },
		}),
	);

	const rawTotals = (prodData?.totals || []) as Record<string, unknown>[];
	const totals: ProductionTotal[] =
		rawTotals.length > 0
			? rawTotals.map((t) => ({
					product_id: t.product_id as string,
					product_name: t.product_name as string,
					opening: Number(t.opening),
					reorder: Number(t.reorder),
					closing: Number(t.closing),
				}))
			: initialTotals;

	const totalsMap = new Map(totals.map((t) => [t.product_id, t]));

	const createEntryMutation = useMutation(
		orpc.production.createEntry.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: ["production"] });
				setSelectedProduct(null);
				setQuantity(0);
				setNotes("");
				toast.success("Entry logged");
			},
			onError: (error) => {
				toast.error(error.message || "Failed to log entry");
			},
		}),
	);

	// Fetch component breakdown when a combo product is selected
	const { data: selectedComponents = [] } = useQuery(
		orpc.production.getComponents.queryOptions({
			input: {
				productId:
					selectedProduct?.id ?? "00000000-0000-0000-0000-000000000000",
			},
			query: { enabled: !!selectedProduct },
		}),
	);

	function isBakeryDept(name: string | null): boolean {
		const d = (name ?? "").toLowerCase();
		// Covers: "Bakery", "Pastry", "Pastries", "Baking"
		return (
			d.includes("bakery") ||
			d.includes("baking") ||
			d.includes("pastri") ||
			d.includes("pastry")
		);
	}

	const filteredProducts = products.filter((p) =>
		workflow === "bakery"
			? isBakeryDept(p.department_name)
			: !isBakeryDept(p.department_name),
	);

	// Only show department pills relevant to the current workflow
	const departments = Array.from(
		new Set(filteredProducts.map((p) => p.department_name).filter(Boolean)),
	) as string[];

	const filtered =
		deptFilter === "all"
			? filteredProducts
			: filteredProducts.filter((p) => p.department_name === deptFilter);

	const handleNumpad = useCallback((digit: number) => {
		setQuantity((prev) => {
			const next = prev * 10 + digit;
			return next > 9999 ? prev : next;
		});
	}, []);

	function handleSubmit() {
		if (!selectedProduct || quantity <= 0) return;
		createEntryMutation.mutate({
			productId: selectedProduct.id,
			productName: selectedProduct.name,
			loggedByUserId: userId,
			entryType: mode,
			workflow,
			quantity,
			notes: notes || null,
		});
	}

	const modeConfig = MODE_CONFIG[mode];

	return (
		<div className="flex h-[calc(100vh-3.5rem)] flex-col">
			{/* Workflow selector */}
			<div className="mb-4 flex gap-2 px-3 pt-3 sm:px-4">
				<button
					type="button"
					onClick={() => setWorkflow("restaurant")}
					className={`rounded-md px-4 py-2 font-medium text-sm transition-colors ${workflow === "restaurant" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
				>
					Restaurant → Food
				</button>
				<button
					type="button"
					onClick={() => setWorkflow("bakery")}
					className={`rounded-md px-4 py-2 font-medium text-sm transition-colors ${workflow === "bakery" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
				>
					Bakery → Pastry
				</button>
			</div>

			{/* Mode Toggle Bar */}
			<div className="flex items-center gap-2 border-border border-b bg-muted/30 px-3 py-2 sm:px-4">
				{(Object.entries(MODE_CONFIG) as [EntryType, typeof modeConfig][]).map(
					([key, cfg]) => {
						const Icon = cfg.icon;
						return (
							<Button
								key={key}
								variant={mode === key ? "default" : "outline"}
								className={`h-14 flex-1 flex-col gap-0 text-base sm:h-16 sm:text-lg ${mode === key ? `${cfg.bg} text-white` : ""}`}
								onClick={() => setMode(key)}
							>
								<span className="flex items-center gap-1.5">
									<Icon className="size-4" />
									{cfg.label}
								</span>
								<span
									className={`font-normal text-[10px] leading-none ${mode === key ? "text-white/75" : "text-muted-foreground"}`}
								>
									{cfg.subLabel}
								</span>
							</Button>
						);
					},
				)}
			</div>

			{/* Department filter pills */}
			<div className="flex gap-1.5 overflow-x-auto border-border border-b px-3 py-2 sm:px-4">
				<Button
					variant={deptFilter === "all" ? "default" : "outline"}
					size="sm"
					className="h-9 shrink-0 text-sm"
					onClick={() => setDeptFilter("all")}
				>
					All
				</Button>
				{departments.map((d) => (
					<Button
						key={d}
						variant={deptFilter === d ? "default" : "outline"}
						size="sm"
						className="h-9 shrink-0 text-sm"
						onClick={() => setDeptFilter(d)}
					>
						{d}
					</Button>
				))}
			</div>

			{/* Product Grid -- large tap targets */}
			<div className="flex-1 overflow-y-auto p-3 sm:p-4">
				<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
					{filtered.map((product) => {
						const t = totalsMap.get(product.id);
						const produced = (t?.opening || 0) + (t?.reorder || 0);
						const remaining = produced - (t?.closing || 0);
						const isCombo = comboProductIds.has(product.id);
						return (
							<button
								key={product.id}
								onClick={() => {
									setSelectedProduct(product);
									setQuantity(0);
									setNotes("");
								}}
								className="flex flex-col items-center justify-center rounded-xl border-2 border-border bg-card p-3 text-center transition-colors hover:border-primary active:scale-[0.97] sm:p-4"
								style={{ minHeight: 120, touchAction: "manipulation" }}
							>
								{isCombo ? (
									<Layers className="mb-1 size-6 text-amber-500 sm:size-7" />
								) : (
									<CookingPot className="mb-1 size-6 text-muted-foreground sm:size-7" />
								)}
								<span className="font-semibold text-foreground text-xs leading-tight sm:text-sm">
									{product.name}
								</span>
								{product.department_name && (
									<span className="mt-0.5 text-[10px] text-muted-foreground">
										{product.department_name}
									</span>
								)}
								{isCombo && (
									<Badge
										variant="secondary"
										className="mt-0.5 text-[9px] text-amber-700 dark:text-amber-400"
									>
										splits into components
									</Badge>
								)}
								{produced > 0 && (
									<div className="mt-1.5 flex gap-1.5">
										<Badge variant="secondary" className="text-[10px]">
											Made: {produced}
										</Badge>
										{t?.closing ? (
											<Badge variant="outline" className="text-[10px]">
												Left: {remaining}
											</Badge>
										) : null}
									</div>
								)}
							</button>
						);
					})}
				</div>
			</div>

			{/* Number Pad Dialog */}
			<Dialog
				open={!!selectedProduct}
				onOpenChange={(open) => {
					if (!open) setSelectedProduct(null);
				}}
			>
				<DialogContent className="max-w-sm sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2 text-lg">
							<div className={`rounded-full p-1.5 text-white ${modeConfig.bg}`}>
								{(() => {
									const Icon = modeConfig.icon;
									return <Icon className="size-4" />;
								})()}
							</div>
							{modeConfig.label}: {selectedProduct?.name}
						</DialogTitle>
					</DialogHeader>

					{/* Quantity display */}
					<div className="rounded-lg border-2 border-border bg-muted/30 p-4 text-center">
						<span className="font-bold text-4xl text-foreground tabular-nums sm:text-5xl">
							{quantity || "0"}
						</span>
						<p className="mt-1 text-muted-foreground text-xs">
							servings / units
						</p>
					</div>

					{/* Number Pad */}
					<div className="grid grid-cols-3 gap-2">
						{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
							<Button
								key={n}
								variant="outline"
								className="h-14 font-bold text-xl sm:h-16 sm:text-2xl"
								onClick={() => handleNumpad(n)}
							>
								{n}
							</Button>
						))}
						<Button
							variant="outline"
							className="h-14 font-bold text-xl sm:h-16 sm:text-2xl"
							onClick={() => setQuantity(0)}
						>
							C
						</Button>
						<Button
							variant="outline"
							className="h-14 font-bold text-xl sm:h-16 sm:text-2xl"
							onClick={() => handleNumpad(0)}
						>
							0
						</Button>
						<Button
							variant="outline"
							className="h-14 sm:h-16"
							onClick={() => setQuantity((prev) => Math.floor(prev / 10))}
						>
							<X className="size-5" />
						</Button>
					</div>

					{/* Quick quantities */}
					<div className="flex gap-2">
						{[5, 10, 20, 25, 50].map((q) => (
							<Button
								key={q}
								variant="secondary"
								size="sm"
								className="flex-1 text-xs"
								onClick={() => setQuantity(q)}
							>
								{q}
							</Button>
						))}
					</div>

					{/* +/- fine tune */}
					<div className="flex items-center justify-center gap-4">
						<Button
							variant="outline"
							size="icon"
							className="size-10"
							onClick={() => setQuantity((q) => Math.max(0, q - 1))}
						>
							<Minus className="size-4" />
							<span className="sr-only">Decrease quantity</span>
						</Button>
						<span className="font-bold text-lg tabular-nums">{quantity}</span>
						<Button
							variant="outline"
							size="icon"
							className="size-10"
							onClick={() => setQuantity((q) => q + 1)}
						>
							<Plus className="size-4" />
							<span className="sr-only">Increase quantity</span>
						</Button>
					</div>

					{/* Combo component preview */}
					{selectedComponents.length > 0 && (
						<div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/20">
							<p className="mb-1.5 font-medium text-amber-800 dark:text-amber-300">
								Will log as separate components:
							</p>
							<div className="space-y-0.5">
								{selectedComponents.map((c) => (
									<div
										key={c.id}
										className="flex items-center justify-between text-amber-700 dark:text-amber-400"
									>
										<span>{c.componentName}</span>
										<span className="font-mono font-semibold">
											× {Math.max(1, Math.round(quantity * Number(c.quantity)))}
										</span>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Optional notes */}
					<Textarea
						placeholder="Notes (optional)"
						value={notes}
						onChange={(e) => setNotes(e.target.value)}
						className="h-16 resize-none text-sm"
					/>

					<DialogFooter>
						<Button variant="outline" onClick={() => setSelectedProduct(null)}>
							Cancel
						</Button>
						<Button
							onClick={handleSubmit}
							disabled={quantity <= 0 || createEntryMutation.isPending}
							className={`gap-2 ${modeConfig.bg} text-white`}
						>
							<Check className="size-4" />
							{createEntryMutation.isPending
								? "Saving..."
								: selectedComponents.length > 0
									? `Split ${quantity} → ${selectedComponents.length} items (${modeConfig.label})`
									: `Log ${quantity} (${modeConfig.label})`}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
