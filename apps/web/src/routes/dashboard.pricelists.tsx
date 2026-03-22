/**
 * Customer-Specific Pricelists (GAP-018)
 * Manage price overrides per product, assign to customers.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DollarSign, Loader2, Plus, Tag, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
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

export default function PricelistsPage() {
	const queryClient = useQueryClient();
	const [showCreate, setShowCreate] = useState(false);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [form, setForm] = useState({
		name: "",
		description: "",
		isActive: true,
	});

	const { data: pricelists = [], isLoading } = useQuery(
		orpc.pricelists.getPricelists.queryOptions({
			input: { includeItems: true },
		}),
	);

	const { data: customersData } = useQuery(
		orpc.customers.list.queryOptions({ input: {} }),
	);
	const customers = customersData?.customers ?? [];

	const createMutation = useMutation(
		orpc.pricelists.createPricelist.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.pricelists.getPricelists.queryOptions({ input: {} })
						.queryKey,
				});
				toast.success("Pricelist created");
				setShowCreate(false);
				setForm({ name: "", description: "", isActive: true });
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const deleteMutation = useMutation(
		orpc.pricelists.deletePricelist.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.pricelists.getPricelists.queryOptions({ input: {} })
						.queryKey,
				});
				toast.success("Pricelist deleted");
				if (selectedId) setSelectedId(null);
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const assignCustomerMutation = useMutation(
		orpc.pricelists.assignCustomerPricelist.mutationOptions({
			onSuccess: () => toast.success("Customer assigned to pricelist"),
			onError: (err) => toast.error(err.message),
		}),
	);

	const selectedPricelist = pricelists.find((p) => p.id === selectedId);

	return (
		<div className="container mx-auto max-w-6xl p-4 md:p-6">
			<div className="mb-6 flex items-center justify-between">
				<div>
					<h1 className="font-bold text-2xl">Customer Pricelists</h1>
					<p className="text-muted-foreground text-sm">
						Create custom pricing tiers and assign them to specific customers.
					</p>
				</div>
				<Button
					onClick={() => setShowCreate(true)}
					className="min-h-[44px] gap-2"
				>
					<Plus className="size-4" />
					New Pricelist
				</Button>
			</div>

			{isLoading ? (
				<div className="flex justify-center py-12">
					<Loader2 className="size-8 animate-spin text-muted-foreground" />
				</div>
			) : pricelists.length === 0 ? (
				<Card>
					<CardContent className="flex flex-col items-center gap-4 py-16 text-center">
						<Tag className="size-12 text-muted-foreground" />
						<div>
							<p className="font-medium">No pricelists yet</p>
							<p className="text-muted-foreground text-sm">
								Create a pricelist to offer custom pricing to specific
								customers.
							</p>
						</div>
						<Button onClick={() => setShowCreate(true)} className="gap-2">
							<Plus className="size-4" />
							Create Pricelist
						</Button>
					</CardContent>
				</Card>
			) : (
				<div className="grid gap-4 lg:grid-cols-3">
					{/* Pricelist list */}
					<div className="space-y-3">
						{pricelists.map((pl) => (
							<Card
								key={pl.id}
								className={`cursor-pointer transition-all hover:border-primary ${
									selectedId === pl.id
										? "border-primary ring-2 ring-primary"
										: ""
								}`}
								onClick={() => setSelectedId(pl.id)}
							>
								<CardHeader className="pb-2">
									<div className="flex items-center justify-between">
										<CardTitle className="text-base">{pl.name}</CardTitle>
										<Badge variant={pl.isActive ? "default" : "secondary"}>
											{pl.isActive ? "Active" : "Inactive"}
										</Badge>
									</div>
									{pl.description && (
										<CardDescription>{pl.description}</CardDescription>
									)}
								</CardHeader>
								<CardContent>
									<div className="flex items-center gap-4 text-muted-foreground text-sm">
										<span className="flex items-center gap-1">
											<DollarSign className="size-3.5" />
											{(pl as { items?: unknown[] }).items?.length ?? 0} items
										</span>
									</div>
								</CardContent>
							</Card>
						))}
					</div>

					{/* Detail pane */}
					{selectedPricelist ? (
						<div className="space-y-4 lg:col-span-2">
							<Card>
								<CardHeader>
									<div className="flex items-center justify-between">
										<CardTitle>{selectedPricelist.name}</CardTitle>
										<Button
											variant="destructive"
											size="sm"
											onClick={() =>
												deleteMutation.mutate({ id: selectedPricelist.id })
											}
											disabled={deleteMutation.isPending}
											className="min-h-[36px] gap-2"
										>
											<Trash2 className="size-4" />
											Delete
										</Button>
									</div>
								</CardHeader>
								<CardContent>
									<h3 className="mb-2 flex items-center gap-2 font-medium">
										<DollarSign className="size-4" />
										Price Overrides
									</h3>
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Product</TableHead>
												<TableHead>Custom Price</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{(
												(
													selectedPricelist as {
														items?: {
															productId: string;
															productName: string;
															price: string;
														}[];
													}
												).items ?? []
											).map((item) => (
												<TableRow key={item.productId}>
													<TableCell>{item.productName}</TableCell>
													<TableCell className="font-semibold text-primary">
														${Number(item.price).toFixed(2)}
													</TableCell>
												</TableRow>
											))}
											{(
												(selectedPricelist as { items?: unknown[] }).items ?? []
											).length === 0 && (
												<TableRow>
													<TableCell
														colSpan={2}
														className="text-center text-muted-foreground"
													>
														No price overrides yet
													</TableCell>
												</TableRow>
											)}
										</TableBody>
									</Table>
								</CardContent>
							</Card>

							{/* Assign to Customer */}
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<Users className="size-4" />
										Assign to Customer
									</CardTitle>
									<CardDescription>
										Select a customer to assign this pricelist. Each customer
										can have one active pricelist.
									</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="flex gap-3">
										<Select
											onValueChange={(customerId) =>
												assignCustomerMutation.mutate({
													customerId,
													pricelistId: selectedPricelist.id,
												})
											}
										>
											<SelectTrigger className="min-h-[44px]">
												<SelectValue placeholder="Select customer..." />
											</SelectTrigger>
											<SelectContent>
												{customers.map((c) => (
													<SelectItem key={c.id} value={c.id}>
														{c.name}
														{c.phone ? ` — ${c.phone}` : ""}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										{assignCustomerMutation.isPending && (
											<Loader2 className="size-5 animate-spin self-center" />
										)}
									</div>
								</CardContent>
							</Card>
						</div>
					) : (
						<div className="flex items-center justify-center rounded-xl border border-dashed text-muted-foreground lg:col-span-2">
							<p>Select a pricelist to view details</p>
						</div>
					)}
				</div>
			)}

			{/* Create Pricelist Dialog */}
			<Dialog open={showCreate} onOpenChange={setShowCreate}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Create Pricelist</DialogTitle>
					</DialogHeader>
					<div className="space-y-4">
						<div>
							<Label htmlFor="pl-name">Name</Label>
							<Input
								id="pl-name"
								value={form.name}
								onChange={(e) =>
									setForm((f) => ({ ...f, name: e.target.value }))
								}
								placeholder="e.g. Wholesale, VIP Member"
								className="min-h-[44px]"
							/>
						</div>
						<div>
							<Label htmlFor="pl-desc">Description</Label>
							<Textarea
								id="pl-desc"
								value={form.description}
								onChange={(e) =>
									setForm((f) => ({ ...f, description: e.target.value }))
								}
								placeholder="Optional description"
								rows={2}
							/>
						</div>
						<div className="flex items-center gap-3">
							<Switch
								id="pl-active"
								checked={form.isActive}
								onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
							/>
							<Label htmlFor="pl-active">Active</Label>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setShowCreate(false)}>
							Cancel
						</Button>
						<Button
							onClick={() =>
								createMutation.mutate({
									name: form.name,
									description: form.description || undefined,
									isActive: form.isActive,
								})
							}
							disabled={!form.name || createMutation.isPending}
						>
							{createMutation.isPending && (
								<Loader2 className="mr-2 size-4 animate-spin" />
							)}
							Create
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
