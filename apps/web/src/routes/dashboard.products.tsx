import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit2, Plus, Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSupervisorOverride } from "@/hooks/use-supervisor-override";
import { formatGYD } from "@/lib/types";
import { orpc } from "@/utils/orpc";

const DEFAULT_ORG_ID = "a0000000-0000-4000-8000-000000000001";

const emptyProduct = {
	name: "",
	sku: "",
	price: "",
	cost: "",
	taxRate: "0",
	reportingCategoryId: "",
	proteinCategoryId: null as string | null,
	imageUrl: "",
	isActive: true,
};

export default function ProductsPage() {
	const [search, setSearch] = useState("");
	const [deptFilter, setDeptFilter] = useState("all");
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [form, setForm] = useState(emptyProduct);
	const [deleteTarget, setDeleteTarget] = useState<{
		id: string;
		name: string;
	} | null>(null);
	const [dialogTab, setDialogTab] = useState("details");
	const [originalPrices, setOriginalPrices] = useState<{
		price: string;
		cost: string;
	} | null>(null);
	const queryClient = useQueryClient();
	const { requestOverride, SupervisorDialog } = useSupervisorOverride();

	const { data: products = [] } = useQuery(
		orpc.products.list.queryOptions({ input: {} }),
	);
	const { data: departments = [] } = useQuery(
		orpc.categories.list.queryOptions({ input: {} }),
	);

	const createProduct = useMutation(
		orpc.products.create.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.products.list.queryOptions({ input: {} }).queryKey,
				});
				setDialogOpen(false);
			},
		}),
	);

	const updateProduct = useMutation(
		orpc.products.update.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.products.list.queryOptions({ input: {} }).queryKey,
				});
				setDialogOpen(false);
			},
		}),
	);

	const deleteProduct = useMutation(
		orpc.products.delete.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.products.list.queryOptions({ input: {} }).queryKey,
				});
				setDeleteTarget(null);
			},
		}),
	);

	const filtered = products.filter((p) => {
		const matchSearch =
			!search ||
			p.name?.toLowerCase().includes(search.toLowerCase()) ||
			p.sku?.toLowerCase().includes(search.toLowerCase());
		const matchDept =
			deptFilter === "all" || p.reportingCategoryId === deptFilter;
		return matchSearch && matchDept;
	});

	function openAdd() {
		setEditingId(null);
		setForm(emptyProduct);
		setDialogTab("details");
		setDialogOpen(true);
	}

	function openEdit(p: (typeof products)[number]) {
		setEditingId(p.id);
		const priceStr = String(p.price || "");
		const costStr = String(p.cost || "0");
		setForm({
			name: p.name || "",
			sku: p.sku || "",
			price: priceStr,
			cost: costStr,
			taxRate: String(p.taxRate || "0"),
			reportingCategoryId: p.reportingCategoryId || "",
			proteinCategoryId: p.proteinCategoryId ?? null,
			imageUrl: p.imageUrl || "",
			isActive: p.isActive !== false,
		});
		setOriginalPrices({ price: priceStr, cost: costStr });
		setDialogTab("details");
		setDialogOpen(true);
	}

	async function handleSave() {
		if (editingId) {
			const priceChanged =
				originalPrices &&
				(form.price !== originalPrices.price ||
					form.cost !== originalPrices.cost);
			let supervisorId: string | undefined;

			if (priceChanged) {
				try {
					const supervisor = await requestOverride(
						"prices.override",
						"Change Product Price",
					);
					supervisorId = supervisor.supervisorId;
				} catch {
					// Cancelled — don't save
					return;
				}
			}

			updateProduct.mutate({
				id: editingId,
				name: form.name,
				sku: form.sku || null,
				price: form.price,
				cost: form.cost || "0",
				taxRate: form.taxRate || "0",
				reportingCategoryId: form.reportingCategoryId || null,
				proteinCategoryId: form.proteinCategoryId ?? undefined,
				imageUrl: form.imageUrl || null,
				isActive: form.isActive,
				supervisorId,
			});
		} else {
			createProduct.mutate({
				organizationId: DEFAULT_ORG_ID,
				name: form.name,
				sku: form.sku || null,
				price: form.price,
				cost: form.cost || "0",
				taxRate: form.taxRate || "0",
				reportingCategoryId: form.reportingCategoryId || null,
				proteinCategoryId: form.proteinCategoryId ?? undefined,
				imageUrl: form.imageUrl || null,
			});
		}
	}

	function handleToggleActive(id: string, currentActive: boolean) {
		updateProduct.mutate({ id, isActive: !currentActive });
	}

	return (
		<div className="flex flex-col gap-6 p-4 md:p-6">
			{/* Header */}
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="font-bold text-2xl text-foreground tracking-tight">
						Products
					</h1>
					<p className="text-muted-foreground text-sm">
						{products.length} products (
						{products.filter((p) => p.isActive !== false).length} active)
					</p>
				</div>
				<Button onClick={openAdd} className="gap-2">
					<Plus className="size-4" />
					Add Product
				</Button>
			</div>

			{/* Search + Filter */}
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
				<div className="relative max-w-sm flex-1">
					<Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Search products..."
						aria-label="Search products"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="pl-9"
					/>
				</div>
				<Select value={deptFilter} onValueChange={setDeptFilter}>
					<SelectTrigger className="w-48">
						<SelectValue placeholder="All Departments" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Departments</SelectItem>
						{departments.map((d) => (
							<SelectItem key={d.id} value={d.id}>
								{d.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{/* Products Table */}
			<Card>
				<CardContent className="p-0">
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Product</TableHead>
									<TableHead>SKU</TableHead>
									<TableHead>Department</TableHead>
									<TableHead className="text-right">Price</TableHead>
									<TableHead className="text-right">Cost</TableHead>
									<TableHead className="text-right">Tax %</TableHead>
									<TableHead className="text-center">Active</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{filtered.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={8}
											className="py-8 text-center text-muted-foreground"
										>
											No products found
										</TableCell>
									</TableRow>
								) : (
									filtered.map((p) => (
										<TableRow
											key={p.id}
											className={p.isActive === false ? "opacity-50" : ""}
										>
											<TableCell className="font-medium text-foreground">
												<div className="flex items-center gap-2">{p.name}</div>
											</TableCell>
											<TableCell className="font-mono text-muted-foreground text-xs">
												{p.sku || "---"}
											</TableCell>
											<TableCell>
												<Badge variant="outline">
													{p.departmentName || "Uncategorized"}
												</Badge>
											</TableCell>
											<TableCell className="text-right font-mono">
												{formatGYD(Number(p.price))}
											</TableCell>
											<TableCell className="text-right font-mono text-muted-foreground">
												{formatGYD(Number(p.cost || 0))}
											</TableCell>
											<TableCell className="text-right font-mono text-muted-foreground">
												{Number(p.taxRate || 0)}%
											</TableCell>
											<TableCell className="text-center">
												<Switch
													checked={p.isActive !== false}
													onCheckedChange={() =>
														handleToggleActive(p.id, p.isActive !== false)
													}
													className="mx-auto"
												/>
											</TableCell>
											<TableCell className="text-right">
												<div className="flex items-center justify-end gap-1">
													<Button
														variant="ghost"
														size="icon"
														className="size-8"
														onClick={() => openEdit(p)}
													>
														<Edit2 className="size-3.5" />
														<span className="sr-only">Edit {p.name}</span>
													</Button>
													<Button
														variant="ghost"
														size="icon"
														className="size-8 text-destructive"
														onClick={() =>
															setDeleteTarget({ id: p.id, name: p.name })
														}
													>
														<Trash2 className="size-3.5" />
														<span className="sr-only">Delete {p.name}</span>
													</Button>
												</div>
											</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</div>
				</CardContent>
			</Card>

			{/* Add/Edit Dialog */}
			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogContent className={editingId ? "max-w-2xl" : "max-w-lg"}>
					<DialogHeader>
						<DialogTitle>
							{editingId ? "Edit Product" : "Add New Product"}
						</DialogTitle>
					</DialogHeader>
					{editingId ? (
						<Tabs value={dialogTab} onValueChange={setDialogTab}>
							<TabsList>
								<TabsTrigger value="details">Details</TabsTrigger>
								<TabsTrigger value="recipe">Recipe</TabsTrigger>
								<TabsTrigger value="production">Production</TabsTrigger>
							</TabsList>
							<TabsContent value="details" className="mt-4">
								<ProductDetailsForm
									form={form}
									setForm={setForm}
									departments={departments}
								/>
								<DialogFooter className="mt-4">
									<Button
										variant="outline"
										onClick={() => setDialogOpen(false)}
									>
										Cancel
									</Button>
									<Button
										onClick={handleSave}
										disabled={
											!form.name || !form.price || updateProduct.isPending
										}
									>
										{updateProduct.isPending ? "Saving..." : "Update Product"}
									</Button>
								</DialogFooter>
							</TabsContent>
							<TabsContent value="recipe" className="mt-4">
								<RecipeTab productId={editingId} productPrice={form.price} />
							</TabsContent>
							<TabsContent value="production" className="mt-4">
								<ProductionTab productId={editingId} />
							</TabsContent>
						</Tabs>
					) : (
						<>
							<ProductDetailsForm
								form={form}
								setForm={setForm}
								departments={departments}
							/>
							<DialogFooter>
								<Button variant="outline" onClick={() => setDialogOpen(false)}>
									Cancel
								</Button>
								<Button
									onClick={handleSave}
									disabled={
										!form.name || !form.price || createProduct.isPending
									}
								>
									{createProduct.isPending ? "Saving..." : "Create Product"}
								</Button>
							</DialogFooter>
						</>
					)}
				</DialogContent>
			</Dialog>

			{/* Delete Confirmation */}
			<AlertDialog
				open={!!deleteTarget}
				onOpenChange={(o) => {
					if (!o) setDeleteTarget(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently remove this product. Consider deactivating
							it instead if you want to keep historical data.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={() =>
								deleteTarget && deleteProduct.mutate({ id: deleteTarget.id })
							}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
			{SupervisorDialog}
		</div>
	);
}

// ── Shared product details form ────────────────────────────────────────

function ProductDetailsForm({
	form,
	setForm,
	departments,
}: {
	form: typeof emptyProduct;
	setForm: (f: typeof emptyProduct) => void;
	departments: Array<{ id: string; name: string }>;
}) {
	return (
		<div className="flex flex-col gap-4 py-2">
			<div className="flex flex-col gap-1.5">
				<Label>Product Name</Label>
				<Input
					value={form.name}
					onChange={(e) => setForm({ ...form, name: e.target.value })}
					placeholder="Fried Rice"
				/>
			</div>
			<div className="grid grid-cols-2 gap-4">
				<div className="flex flex-col gap-1.5">
					<Label>SKU</Label>
					<Input
						value={form.sku}
						onChange={(e) => setForm({ ...form, sku: e.target.value })}
						placeholder="FR-001"
					/>
				</div>
				<div className="flex flex-col gap-1.5">
					<Label>Department</Label>
					<Select
						value={form.reportingCategoryId}
						onValueChange={(v) => setForm({ ...form, reportingCategoryId: v })}
					>
						<SelectTrigger>
							<SelectValue placeholder="Select department" />
						</SelectTrigger>
						<SelectContent>
							{departments.map((d) => (
								<SelectItem key={d.id} value={d.id}>
									{d.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>
			<div className="space-y-2">
				<Label>
					Protein Category{" "}
					<span className="text-muted-foreground text-xs">
						(Production Report)
					</span>
				</Label>
				<Select
					value={form.proteinCategoryId ?? "none"}
					onValueChange={(v) =>
						setForm({ ...form, proteinCategoryId: v === "none" ? null : v })
					}
				>
					<SelectTrigger>
						<SelectValue placeholder="None (standalone item)" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="none">None</SelectItem>
						{departments.map((c) => (
							<SelectItem key={c.id} value={c.id}>
								{c.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<p className="text-muted-foreground text-xs">
					E.g. “Cook up BBQ” → “Barbecue Chicken”. Groups protein totals in
					production report.
				</p>
			</div>
			<div className="grid grid-cols-3 gap-4">
				<div className="flex flex-col gap-1.5">
					<Label>Price (GYD)</Label>
					<Input
						type="number"
						step="1"
						value={form.price}
						onChange={(e) => setForm({ ...form, price: e.target.value })}
					/>
				</div>
				<div className="flex flex-col gap-1.5">
					<Label>Cost (GYD)</Label>
					<Input
						type="number"
						step="1"
						value={form.cost}
						onChange={(e) => setForm({ ...form, cost: e.target.value })}
					/>
				</div>
				<div className="flex flex-col gap-1.5">
					<Label>Tax Rate %</Label>
					<Input
						type="number"
						step="0.01"
						value={form.taxRate}
						onChange={(e) => setForm({ ...form, taxRate: e.target.value })}
					/>
				</div>
			</div>
			<div className="flex flex-col gap-1.5">
				<Label>Image URL (optional)</Label>
				<Input
					value={form.imageUrl}
					onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
					placeholder="https://..."
				/>
			</div>
			<div className="flex items-center gap-3">
				<Switch
					checked={form.isActive}
					onCheckedChange={(v) => setForm({ ...form, isActive: v })}
				/>
				<Label>Active (visible in POS)</Label>
			</div>
		</div>
	);
}

// ── ProductionTab ───────────────────────────────────────────────────────
function ProductionTab({ productId }: { productId: string }) {
	const queryClient = useQueryClient();
	const [localComponents, setLocalComponents] = useState<
		{ componentName: string; quantity: string }[] | null
	>(null);
	const [addName, setAddName] = useState("");
	const [addQty, setAddQty] = useState("1");

	const { data: saved = [], isLoading } = useQuery(
		orpc.production.getComponents.queryOptions({ input: { productId } }),
	);

	const components: { componentName: string; quantity: string }[] =
		localComponents ??
		saved.map((c) => ({
			componentName: c.componentName,
			quantity: String(c.quantity),
		}));

	const saveComponents = useMutation(
		orpc.production.setComponents.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.production.getComponents.queryOptions({
						input: { productId },
					}).queryKey,
				});
				setLocalComponents(null);
				toast.success("Production components saved");
			},
			onError: (err) => toast.error(err.message || "Failed to save components"),
		}),
	);

	function handleAdd() {
		const name = addName.trim();
		if (!name) return;
		setLocalComponents([
			...components,
			{ componentName: name, quantity: addQty || "1" },
		]);
		setAddName("");
		setAddQty("1");
	}

	function handleRemove(idx: number) {
		setLocalComponents(components.filter((_, i) => i !== idx));
	}

	function handleSave() {
		saveComponents.mutate({ productId, components });
	}

	if (isLoading)
		return (
			<p className="py-4 text-center text-muted-foreground text-sm">
				Loading...
			</p>
		);

	const isDirty = localComponents !== null;

	return (
		<div className="flex flex-col gap-4">
			<p className="text-muted-foreground text-sm">
				Map this POS item to individual production components. When this product
				is sold, each component's actual count increases in the Production
				Report.
			</p>

			{components.length === 0 ? (
				<p className="rounded-md border border-dashed p-4 text-center text-muted-foreground text-sm">
					No components — this product tracks as one unit in the report.
				</p>
			) : (
				<div className="rounded-md border">
					<table className="w-full text-sm">
						<thead className="bg-muted/50">
							<tr>
								<th className="p-2 text-left font-medium">Component Name</th>
								<th className="p-2 text-center font-medium">Qty</th>
								<th className="w-10 p-2" />
							</tr>
						</thead>
						<tbody>
							{components.map((c, i) => (
								<tr key={i} className="border-t">
									<td className="p-2">{c.componentName}</td>
									<td className="p-2 text-center">{c.quantity}</td>
									<td className="p-2">
										<Button
											variant="ghost"
											size="icon"
											className="size-7 text-destructive hover:text-destructive"
											onClick={() => handleRemove(i)}
										>
											<X className="size-3.5" />
										</Button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			<div className="flex gap-2">
				<Input
					placeholder="Component name (e.g. Rice)"
					value={addName}
					onChange={(e) => setAddName(e.target.value)}
					onKeyDown={(e) => e.key === "Enter" && handleAdd()}
					className="flex-1"
				/>
				<Input
					type="number"
					step="0.25"
					min="0.25"
					placeholder="Qty"
					value={addQty}
					onChange={(e) => setAddQty(e.target.value)}
					className="w-20"
				/>
				<Button
					variant="outline"
					size="sm"
					onClick={handleAdd}
					disabled={!addName.trim()}
				>
					Add
				</Button>
			</div>

			<div className="flex justify-end">
				<Button
					size="sm"
					disabled={!isDirty || saveComponents.isPending}
					onClick={handleSave}
				>
					{saveComponents.isPending ? "Saving..." : "Save Components"}
				</Button>
			</div>
		</div>
	);
}

// ── Recipe Tab ─────────────────────────────────────────────────────────

interface RecipeRow {
	inventoryItemId: string;
	quantity: string;
	unit: string;
	itemName: string;
	avgCost: string | null;
}

function RecipeTab({
	productId,
	productPrice,
}: {
	productId: string;
	productPrice: string;
}) {
	const queryClient = useQueryClient();
	const [localIngredients, setLocalIngredients] = useState<RecipeRow[] | null>(
		null,
	);
	const [addItemId, setAddItemId] = useState("");
	const [addQty, setAddQty] = useState("");
	const [addUnit, setAddUnit] = useState("");

	// Fetch existing recipe
	const { data: savedRecipe = [], isLoading: recipeLoading } = useQuery(
		orpc.products.getRecipe.queryOptions({ input: { productId } }),
	);

	// Fetch inventory items for the dropdown
	const { data: stockLevels = [] } = useQuery(
		orpc.inventory.getStockLevels.queryOptions({ input: {} }),
	);

	// De-duplicate inventory items (stock levels may have multiple locations)
	const inventoryItems = useMemo(() => {
		const map = new Map<
			string,
			{
				id: string;
				name: string;
				unitOfMeasure: string;
				avgCost: string | null;
			}
		>();
		for (const s of stockLevels) {
			if (!map.has(s.inventoryItemId)) {
				map.set(s.inventoryItemId, {
					id: s.inventoryItemId,
					name: s.itemName,
					unitOfMeasure: s.unitOfMeasure,
					avgCost: s.avgCost,
				});
			}
		}
		return Array.from(map.values()).sort((a, b) =>
			a.name.localeCompare(b.name),
		);
	}, [stockLevels]);

	// Use local state if user has modified, otherwise use saved data
	const ingredients: RecipeRow[] =
		localIngredients ??
		savedRecipe.map((r) => ({
			inventoryItemId: r.inventoryItemId,
			quantity: r.quantity,
			unit: r.unit,
			itemName: r.itemName,
			avgCost: r.avgCost,
		}));

	// Save recipe mutation
	const saveRecipe = useMutation(
		orpc.products.saveRecipe.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.products.getRecipe.queryOptions({
						input: { productId },
					}).queryKey,
				});
				setLocalIngredients(null);
				toast.success("Recipe saved");
			},
			onError: (err) => toast.error(err.message || "Failed to save recipe"),
		}),
	);

	// Calculations
	const theoreticalCost = ingredients.reduce((sum, ing) => {
		const qty = Number(ing.quantity) || 0;
		const cost = Number(ing.avgCost) || 0;
		return sum + qty * cost;
	}, 0);
	const price = Number(productPrice) || 0;
	const foodCostPct = price > 0 ? (theoreticalCost / price) * 100 : 0;

	function handleAddIngredient() {
		if (!addItemId || !addQty) return;
		const item = inventoryItems.find((i) => i.id === addItemId);
		if (!item) return;

		// Prevent duplicate ingredients
		if (ingredients.some((ing) => ing.inventoryItemId === addItemId)) {
			toast.error("Ingredient already in recipe");
			return;
		}

		const newRow: RecipeRow = {
			inventoryItemId: addItemId,
			quantity: addQty,
			unit: addUnit || item.unitOfMeasure,
			itemName: item.name,
			avgCost: item.avgCost,
		};
		setLocalIngredients([...ingredients, newRow]);
		setAddItemId("");
		setAddQty("");
		setAddUnit("");
	}

	function handleRemoveIngredient(idx: number) {
		const updated = ingredients.filter((_, i) => i !== idx);
		setLocalIngredients(updated);
	}

	function handleSaveRecipe() {
		saveRecipe.mutate({
			productId,
			ingredients: ingredients.map((ing) => ({
				inventoryItemId: ing.inventoryItemId,
				quantity: ing.quantity,
				unit: ing.unit,
			})),
		});
	}

	const isDirty = localIngredients !== null;

	if (recipeLoading) {
		return (
			<p className="py-4 text-center text-muted-foreground">
				Loading recipe...
			</p>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			{/* Food Cost Summary */}
			<div className="flex items-center gap-4 rounded-lg border p-3">
				<div className="flex-1">
					<p className="text-muted-foreground text-sm">Theoretical Food Cost</p>
					<p className="font-semibold text-lg">{formatGYD(theoreticalCost)}</p>
				</div>
				<Separator orientation="vertical" className="h-10" />
				<div className="flex-1">
					<p className="text-muted-foreground text-sm">Food Cost %</p>
					<p
						className={`font-semibold text-lg ${
							foodCostPct <= 0
								? "text-muted-foreground"
								: foodCostPct < 30
									? "text-green-600"
									: foodCostPct <= 40
										? "text-amber-600"
										: "text-red-600"
						}`}
					>
						{price > 0 ? `${foodCostPct.toFixed(1)}% of price` : "No price set"}
					</p>
				</div>
			</div>

			{/* Ingredients Table */}
			<div className="overflow-x-auto rounded-md border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Ingredient</TableHead>
							<TableHead className="w-24 text-right">Qty</TableHead>
							<TableHead className="w-24">Unit</TableHead>
							<TableHead className="w-28 text-right">Est. Cost</TableHead>
							<TableHead className="w-12" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{ingredients.length === 0 && (
							<TableRow>
								<TableCell
									colSpan={5}
									className="py-6 text-center text-muted-foreground"
								>
									No ingredients added. Use the form below to build this
									product's recipe.
								</TableCell>
							</TableRow>
						)}
						{ingredients.map((ing, idx) => {
							const lineCost =
								(Number(ing.quantity) || 0) * (Number(ing.avgCost) || 0);
							return (
								<TableRow key={`${ing.inventoryItemId}-${idx}`}>
									<TableCell className="font-medium">{ing.itemName}</TableCell>
									<TableCell className="text-right font-mono">
										{ing.quantity}
									</TableCell>
									<TableCell className="text-muted-foreground">
										{ing.unit}
									</TableCell>
									<TableCell className="text-right font-mono">
										{formatGYD(lineCost)}
									</TableCell>
									<TableCell>
										<Button
											variant="ghost"
											size="icon"
											className="size-7 text-destructive"
											onClick={() => handleRemoveIngredient(idx)}
										>
											<X className="size-3.5" />
											<span className="sr-only">Remove {ing.itemName}</span>
										</Button>
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			</div>

			{/* Add Ingredient Row */}
			<div className="flex flex-col gap-2 sm:flex-row sm:items-end">
				<div className="flex-1">
					<Label className="text-xs">Ingredient</Label>
					<Select value={addItemId} onValueChange={setAddItemId}>
						<SelectTrigger>
							<SelectValue placeholder="Select ingredient..." />
						</SelectTrigger>
						<SelectContent>
							{inventoryItems
								.filter(
									(item) =>
										!ingredients.some((ing) => ing.inventoryItemId === item.id),
								)
								.map((item) => (
									<SelectItem key={item.id} value={item.id}>
										{item.name}
									</SelectItem>
								))}
						</SelectContent>
					</Select>
				</div>
				<div className="w-24">
					<Label className="text-xs">Qty</Label>
					<Input
						type="number"
						step="0.01"
						min="0"
						value={addQty}
						onChange={(e) => setAddQty(e.target.value)}
						placeholder="0"
					/>
				</div>
				<div className="w-24">
					<Label className="text-xs">Unit</Label>
					<Input
						value={addUnit}
						onChange={(e) => setAddUnit(e.target.value)}
						placeholder={
							inventoryItems.find((i) => i.id === addItemId)?.unitOfMeasure ||
							"kg"
						}
					/>
				</div>
				<Button
					variant="outline"
					className="gap-1"
					onClick={handleAddIngredient}
					disabled={!addItemId || !addQty}
				>
					<Plus className="size-3.5" />
					Add
				</Button>
			</div>

			{/* Save button */}
			<div className="flex justify-end gap-2 pt-2">
				{isDirty && (
					<Button variant="ghost" onClick={() => setLocalIngredients(null)}>
						Discard Changes
					</Button>
				)}
				<Button
					onClick={handleSaveRecipe}
					disabled={saveRecipe.isPending || !isDirty}
				>
					{saveRecipe.isPending ? "Saving..." : "Save Recipe"}
				</Button>
			</div>
		</div>
	);
}
