import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Loader2, Plus, Tag, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { orpc } from "@/utils/orpc";

type PricelistRow = {
	id: string;
	name: string;
	description: string | null;
	isActive: boolean;
	itemCount: number;
	customerCount: number;
	createdAt: string;
};

type PricelistItem = {
	id: string;
	productId: string;
	productName: string;
	standardPrice: string;
	overridePrice: string;
};

export default function PricelistsPage() {
	const qc = useQueryClient();
	const [createOpen, setCreateOpen] = useState(false);
	const [selectedId, setSelectedId] = useState<string | null>(null);

	const listKey = orpc.pricelists.list.queryOptions({ input: {} }).queryKey;

	const { data: pricelists = [], isLoading } = useQuery(
		orpc.pricelists.list.queryOptions({ input: {} }),
	);

	const createMut = useMutation(
		orpc.pricelists.create.mutationOptions({
			onSuccess: () => {
				qc.invalidateQueries({ queryKey: listKey });
				setCreateOpen(false);
				toast.success("Pricelist created");
			},
		}),
	);

	const removeMut = useMutation(
		orpc.pricelists.remove.mutationOptions({
			onSuccess: () => {
				qc.invalidateQueries({ queryKey: listKey });
				setSelectedId(null);
				toast.success("Pricelist deleted");
			},
		}),
	);

	const rows = pricelists as PricelistRow[];

	if (selectedId) {
		return (
			<PricelistDetail
				id={selectedId}
				name={rows.find((r) => r.id === selectedId)?.name ?? ""}
				onBack={() => setSelectedId(null)}
			/>
		);
	}

	return (
		<div className="space-y-6 p-4 md:p-6">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="font-bold text-2xl tracking-tight">Pricelists</h1>
					<p className="text-muted-foreground text-sm">
						Customer-specific pricing overrides
					</p>
				</div>
				<Dialog open={createOpen} onOpenChange={setCreateOpen}>
					<DialogTrigger asChild>
						<Button>
							<Plus className="mr-1 size-4" /> New Pricelist
						</Button>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Create Pricelist</DialogTitle>
						</DialogHeader>
						<CreatePricelistForm
							onSubmit={(data) => createMut.mutate(data)}
							isSubmitting={createMut.isPending}
						/>
					</DialogContent>
				</Dialog>
			</div>

			{/* Summary */}
			<div className="grid grid-cols-2 gap-4">
				<Card>
					<CardContent className="flex items-center gap-3 py-4">
						<Tag className="size-8 text-blue-500" />
						<div>
							<p className="font-bold text-2xl">{rows.length}</p>
							<p className="text-muted-foreground text-xs">Total pricelists</p>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="flex items-center gap-3 py-4">
						<Users className="size-8 text-green-500" />
						<div>
							<p className="font-bold text-2xl">
								{rows.reduce((s, r) => s + r.customerCount, 0)}
							</p>
							<p className="text-muted-foreground text-xs">
								Customers assigned
							</p>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Pricelists table */}
			{isLoading ? (
				<div className="flex justify-center py-12">
					<Loader2 className="size-8 animate-spin text-muted-foreground" />
				</div>
			) : (
				<Card>
					<CardHeader>
						<CardTitle className="text-base">All Pricelists</CardTitle>
					</CardHeader>
					<CardContent className="p-0">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead>Description</TableHead>
									<TableHead className="text-center">Products</TableHead>
									<TableHead className="text-center">Customers</TableHead>
									<TableHead>Status</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{rows.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={6}
											className="py-12 text-center text-muted-foreground"
										>
											No pricelists yet. Create one to offer customer-specific
											pricing.
										</TableCell>
									</TableRow>
								) : (
									rows.map((r) => (
										<TableRow
											key={r.id}
											className="cursor-pointer"
											onClick={() => setSelectedId(r.id)}
										>
											<TableCell className="font-medium">{r.name}</TableCell>
											<TableCell className="max-w-[200px] truncate text-muted-foreground text-xs">
												{r.description || "–"}
											</TableCell>
											<TableCell className="text-center">
												{r.itemCount}
											</TableCell>
											<TableCell className="text-center">
												{r.customerCount}
											</TableCell>
											<TableCell>
												<Badge variant={r.isActive ? "default" : "secondary"}>
													{r.isActive ? "Active" : "Inactive"}
												</Badge>
											</TableCell>
											<TableCell className="text-right">
												<div className="flex justify-end gap-1">
													<Button
														variant="ghost"
														size="sm"
														onClick={(e) => {
															e.stopPropagation();
															if (confirm(`Delete "${r.name}"?`)) {
																removeMut.mutate({
																	id: r.id,
																});
															}
														}}
													>
														<Trash2 className="size-3 text-destructive" />
													</Button>
													<ChevronRight className="size-4 text-muted-foreground" />
												</div>
											</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

// ── Create Form ──────────────────────────────────────────────────────

function CreatePricelistForm({
	onSubmit,
	isSubmitting,
}: {
	onSubmit: (data: { name: string; description?: string }) => void;
	isSubmitting: boolean;
}) {
	const [name, setName] = useState("");
	const [desc, setDesc] = useState("");

	return (
		<>
			<div className="space-y-4 py-4">
				<div className="space-y-1.5">
					<Label>Name</Label>
					<Input
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="e.g. VIP, Wholesale, Staff"
					/>
				</div>
				<div className="space-y-1.5">
					<Label>Description (optional)</Label>
					<Textarea
						value={desc}
						onChange={(e) => setDesc(e.target.value)}
						placeholder="Who is this pricelist for?"
						rows={2}
					/>
				</div>
			</div>
			<DialogFooter>
				<Button
					onClick={() =>
						onSubmit({
							name,
							description: desc || undefined,
						})
					}
					disabled={!name.trim() || isSubmitting}
				>
					{isSubmitting && <Loader2 className="mr-1 size-4 animate-spin" />}
					Create
				</Button>
			</DialogFooter>
		</>
	);
}

// ── Pricelist Detail View ────────────────────────────────────────────

function PricelistDetail({
	id,
	name,
	onBack,
}: {
	id: string;
	name: string;
	onBack: () => void;
}) {
	const qc = useQueryClient();
	const [addOpen, setAddOpen] = useState(false);

	const itemsKey = orpc.pricelists.get.queryOptions({ input: { id } }).queryKey;

	const { data: items = [], isLoading } = useQuery(
		orpc.pricelists.get.queryOptions({ input: { id } }),
	);

	const addMut = useMutation(
		orpc.pricelists.addItem.mutationOptions({
			onSuccess: () => {
				qc.invalidateQueries({ queryKey: itemsKey });
				setAddOpen(false);
				toast.success("Price override added");
			},
		}),
	);

	const removeMut = useMutation(
		orpc.pricelists.removeItem.mutationOptions({
			onSuccess: () => {
				qc.invalidateQueries({ queryKey: itemsKey });
			},
		}),
	);

	const rows = items as PricelistItem[];

	return (
		<div className="space-y-6 p-4 md:p-6">
			<div className="flex items-center gap-3">
				<Button variant="ghost" size="sm" onClick={onBack}>
					Back
				</Button>
				<div>
					<h1 className="font-bold text-2xl tracking-tight">{name}</h1>
					<p className="text-muted-foreground text-sm">
						{rows.length} product price overrides
					</p>
				</div>
				<div className="ml-auto">
					<Dialog open={addOpen} onOpenChange={setAddOpen}>
						<DialogTrigger asChild>
							<Button size="sm">
								<Plus className="mr-1 size-3.5" /> Add Product
							</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Add Price Override</DialogTitle>
							</DialogHeader>
							<AddItemForm
								pricelistId={id}
								onSubmit={(data) => addMut.mutate(data)}
								isSubmitting={addMut.isPending}
							/>
						</DialogContent>
					</Dialog>
				</div>
			</div>

			{isLoading ? (
				<div className="flex justify-center py-12">
					<Loader2 className="size-8 animate-spin text-muted-foreground" />
				</div>
			) : (
				<Card>
					<CardContent className="p-0">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Product</TableHead>
									<TableHead className="text-right">Standard Price</TableHead>
									<TableHead className="text-right">Override Price</TableHead>
									<TableHead className="text-right">Savings</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{rows.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={5}
											className="py-12 text-center text-muted-foreground"
										>
											No price overrides yet. Add products to set custom prices.
										</TableCell>
									</TableRow>
								) : (
									rows.map((r) => {
										const std = Number(r.standardPrice);
										const ovr = Number(r.overridePrice);
										const diff = std - ovr;
										const pct = std > 0 ? ((diff / std) * 100).toFixed(0) : "0";
										return (
											<TableRow key={r.id}>
												<TableCell className="font-medium">
													{r.productName}
												</TableCell>
												<TableCell className="text-right text-muted-foreground">
													${Number(r.standardPrice).toFixed(2)}
												</TableCell>
												<TableCell className="text-right font-medium">
													${Number(r.overridePrice).toFixed(2)}
												</TableCell>
												<TableCell className="text-right">
													{diff > 0 ? (
														<span className="text-green-600">-{pct}%</span>
													) : diff < 0 ? (
														<span className="text-red-600">
															+{Math.abs(Number(pct))}%
														</span>
													) : (
														<span className="text-muted-foreground">–</span>
													)}
												</TableCell>
												<TableCell className="text-right">
													<Button
														variant="ghost"
														size="sm"
														onClick={() =>
															removeMut.mutate({
																id: r.id,
															})
														}
													>
														<Trash2 className="size-3 text-destructive" />
													</Button>
												</TableCell>
											</TableRow>
										);
									})
								)}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

// ── Add Item Form ────────────────────────────────────────────────────

function AddItemForm({
	pricelistId,
	onSubmit,
	isSubmitting,
}: {
	pricelistId: string;
	onSubmit: (data: {
		pricelistId: string;
		productId: string;
		price: number;
	}) => void;
	isSubmitting: boolean;
}) {
	const [productId, setProductId] = useState("");
	const [price, setPrice] = useState("");

	// Get products for the dropdown
	const { data: products = [] } = useQuery(
		orpc.pos.getProducts.queryOptions({ input: {} }),
	);

	const productList = (
		products as Array<{
			products: Array<{ id: string; name: string; price: string }>;
		}>
	).flatMap((dept) => dept.products ?? []);

	return (
		<>
			<div className="space-y-4 py-4">
				<div className="space-y-1.5">
					<Label>Product</Label>
					<select
						value={productId}
						onChange={(e) => {
							setProductId(e.target.value);
							// Pre-fill with current price
							const p = productList.find((x) => x.id === e.target.value);
							if (p && !price) setPrice(Number(p.price).toFixed(2));
						}}
						className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
					>
						<option value="">Select product...</option>
						{productList.map((p) => (
							<option key={p.id} value={p.id}>
								{p.name} (${Number(p.price).toFixed(2)})
							</option>
						))}
					</select>
				</div>
				<div className="space-y-1.5">
					<Label>Override Price</Label>
					<Input
						type="number"
						step="0.01"
						min="0"
						value={price}
						onChange={(e) => setPrice(e.target.value)}
						placeholder="0.00"
					/>
				</div>
			</div>
			<DialogFooter>
				<Button
					onClick={() =>
						onSubmit({
							pricelistId,
							productId,
							price: Number(price),
						})
					}
					disabled={!productId || !price || isSubmitting}
				>
					{isSubmitting && <Loader2 className="mr-1 size-4 animate-spin" />}
					Add Override
				</Button>
			</DialogFooter>
		</>
	);
}
