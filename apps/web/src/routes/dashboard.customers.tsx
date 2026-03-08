import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Edit2,
	Mail,
	Phone,
	Plus,
	Search,
	ShoppingBag,
	Trash2,
	Users,
} from "lucide-react";
import { useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatGYD } from "@/lib/types";
import { orpc } from "@/utils/orpc";

interface CustomerForm {
	name: string;
	phone: string;
	email: string;
	notes: string;
}

const emptyForm: CustomerForm = { name: "", phone: "", email: "", notes: "" };

export default function CustomersPage() {
	const queryClient = useQueryClient();
	const [search, setSearch] = useState("");
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [form, setForm] = useState<CustomerForm>(emptyForm);
	const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);

	const { data, isLoading } = useQuery(
		orpc.customers.list.queryOptions({
			input: { search: search || undefined, limit: 50, offset: 0 },
		}),
	);

	const { data: orderHistory } = useQuery({
		...orpc.customers.getHistory.queryOptions({
			input: { customerId: selectedCustomer!, limit: 20 },
		}),
		enabled: !!selectedCustomer,
	});

	const listKey = orpc.customers.list.queryOptions({
		input: { search: search || undefined, limit: 50, offset: 0 },
	}).queryKey;

	const createMut = useMutation(
		orpc.customers.create.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: listKey });
				setDialogOpen(false);
				setForm(emptyForm);
				toast.success("Customer created");
			},
			onError: (err) => toast.error(err.message || "Failed to create customer"),
		}),
	);

	const updateMut = useMutation(
		orpc.customers.update.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: listKey });
				setDialogOpen(false);
				setEditingId(null);
				setForm(emptyForm);
				toast.success("Customer updated");
			},
			onError: (err) => toast.error(err.message || "Failed to update customer"),
		}),
	);

	const [deleteConfirmCustomer, setDeleteConfirmCustomer] = useState<{
		id: string;
		name: string;
	} | null>(null);
	const deleteMut = useMutation(
		orpc.customers.deleteCustomer.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: listKey });
				toast.success("Customer deleted");
			},
			onError: (err) => toast.error(err.message || "Failed to delete customer"),
		}),
	);

	function openCreate() {
		setEditingId(null);
		setForm(emptyForm);
		setDialogOpen(true);
	}

	function openEdit(c: {
		id: string;
		name: string;
		phone: string | null;
		email: string | null;
		notes: string | null;
	}) {
		setEditingId(c.id);
		setForm({
			name: c.name,
			phone: c.phone || "",
			email: c.email || "",
			notes: c.notes || "",
		});
		setDialogOpen(true);
	}

	function handleSave() {
		if (!form.name.trim()) {
			toast.error("Name is required");
			return;
		}
		if (editingId) {
			updateMut.mutate({
				id: editingId,
				name: form.name,
				phone: form.phone || undefined,
				email: form.email || undefined,
				notes: form.notes || undefined,
			});
		} else {
			createMut.mutate({
				name: form.name,
				phone: form.phone || undefined,
				email: form.email || undefined,
				notes: form.notes || undefined,
			});
		}
	}

	const customers = data?.customers ?? [];
	const total = data?.total ?? 0;

	return (
		<div className="space-y-6 p-4 md:p-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="flex items-center gap-2 font-bold text-2xl">
						<Users className="size-6 text-primary" />
						Customers
					</h1>
					<p className="text-muted-foreground text-sm">
						Track customer info, visit history, and spending. {total} customer
						{total !== 1 ? "s" : ""} in database.
					</p>
				</div>
				<Button onClick={openCreate}>
					<Plus className="mr-2 size-4" />
					Add Customer
				</Button>
			</div>

			<div className="relative max-w-sm">
				<Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					placeholder="Search by name or phone..."
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					className="pl-10"
				/>
			</div>

			<div className="grid gap-6 lg:grid-cols-3">
				<div className="lg:col-span-2">
					<Card>
						<CardContent className="p-0">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Name</TableHead>
										<TableHead>Phone</TableHead>
										<TableHead>Email</TableHead>
										<TableHead className="text-right">Visits</TableHead>
										<TableHead className="text-right">Total Spent</TableHead>
										<TableHead className="w-20" />
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
									) : customers.length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={6}
												className="py-8 text-center text-muted-foreground"
											>
												<Users className="mx-auto mb-2 size-8 opacity-50" />
												<p className="font-medium">No customers found</p>
												<p className="mt-1 text-xs">
													Add your first customer or adjust your search.
												</p>
											</TableCell>
										</TableRow>
									) : (
										customers.map((c) => (
											<TableRow
												key={c.id}
												className={`cursor-pointer ${selectedCustomer === c.id ? "bg-muted" : ""}`}
												onClick={() => setSelectedCustomer(c.id)}
											>
												<TableCell className="font-medium">{c.name}</TableCell>
												<TableCell>
													{c.phone ? (
														<span className="flex items-center gap-1">
															<Phone className="size-3" />
															{c.phone}
														</span>
													) : (
														<span className="text-muted-foreground">—</span>
													)}
												</TableCell>
												<TableCell>
													{c.email ? (
														<span className="flex items-center gap-1">
															<Mail className="size-3" />
															{c.email}
														</span>
													) : (
														<span className="text-muted-foreground">—</span>
													)}
												</TableCell>
												<TableCell className="text-right">
													{c.visitCount}
												</TableCell>
												<TableCell className="text-right font-medium">
													{formatGYD(Number(c.totalSpent))}
												</TableCell>
												<TableCell>
													<div className="flex items-center gap-1">
														<Button
															variant="ghost"
															size="sm"
															onClick={(e) => {
																e.stopPropagation();
																openEdit(c);
															}}
														>
															<Edit2 className="size-3.5" />
														</Button>
														<Button
															variant="ghost"
															size="sm"
															className="text-destructive hover:text-destructive"
															disabled={deleteMut.isPending}
															onClick={(e) => {
																e.stopPropagation();
																setDeleteConfirmCustomer({
																	id: c.id,
																	name: c.name,
																});
															}}
														>
															<Trash2 className="size-3.5" />
														</Button>
													</div>
												</TableCell>
											</TableRow>
										))
									)}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
				</div>

				<div>
					{selectedCustomer ? (
						<CustomerDetail
							customerId={selectedCustomer}
							orders={orderHistory ?? []}
						/>
					) : (
						<Card>
							<CardContent className="py-12 text-center text-muted-foreground">
								<Users className="mx-auto mb-2 size-8 opacity-50" />
								<p className="font-medium">Select a customer to view details</p>
								<p className="mt-1 text-xs">
									Click a row on the left to see contact info, visit stats, and
									order history.
								</p>
							</CardContent>
						</Card>
					)}
				</div>
			</div>

			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{editingId ? "Edit Customer" : "New Customer"}
						</DialogTitle>
						<DialogDescription>
							{editingId
								? "Update customer information"
								: "Add a new customer to the database"}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div>
							<Label>Name *</Label>
							<Input
								value={form.name}
								onChange={(e) => setForm({ ...form, name: e.target.value })}
								placeholder="Customer name"
							/>
						</div>
						<div>
							<Label>Phone</Label>
							<Input
								value={form.phone}
								onChange={(e) => setForm({ ...form, phone: e.target.value })}
								placeholder="+592-..."
							/>
						</div>
						<div>
							<Label>Email</Label>
							<Input
								type="email"
								value={form.email}
								onChange={(e) => setForm({ ...form, email: e.target.value })}
								placeholder="customer@example.com"
							/>
						</div>
						<div>
							<Label>Notes</Label>
							<Textarea
								value={form.notes}
								onChange={(e) => setForm({ ...form, notes: e.target.value })}
								placeholder="Preferences, allergies, etc."
								rows={3}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDialogOpen(false)}>
							Cancel
						</Button>
						<Button
							onClick={handleSave}
							disabled={createMut.isPending || updateMut.isPending}
						>
							{createMut.isPending || updateMut.isPending
								? "Saving..."
								: "Save"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Delete Customer Confirmation */}
			<AlertDialog
				open={!!deleteConfirmCustomer}
				onOpenChange={(o) => {
					if (!o) setDeleteConfirmCustomer(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Delete {deleteConfirmCustomer?.name}?
						</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete this customer and their data.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={() =>
								deleteConfirmCustomer &&
								deleteMut.mutate({ id: deleteConfirmCustomer.id })
							}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

function CustomerDetail({
	customerId,
	orders,
}: {
	customerId: string;
	orders: Array<{
		id: string;
		orderNumber: string;
		total: string;
		status: string;
		createdAt: string | Date;
	}>;
}) {
	const { data: customer } = useQuery(
		orpc.customers.getById.queryOptions({ input: { id: customerId } }),
	);

	if (!customer) return null;

	return (
		<div className="space-y-4">
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-lg">{customer.name}</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					{customer.phone && (
						<div className="flex items-center gap-2 text-sm">
							<Phone className="size-4 text-muted-foreground" />
							{customer.phone}
						</div>
					)}
					{customer.email && (
						<div className="flex items-center gap-2 text-sm">
							<Mail className="size-4 text-muted-foreground" />
							{customer.email}
						</div>
					)}
					<div className="grid grid-cols-2 gap-3 pt-2">
						<div className="rounded-lg bg-muted p-3 text-center">
							<div className="font-bold text-2xl">{customer.visitCount}</div>
							<div className="text-muted-foreground text-xs">Visits</div>
						</div>
						<div className="rounded-lg bg-muted p-3 text-center">
							<div className="font-bold text-2xl">
								{formatGYD(Number(customer.totalSpent))}
							</div>
							<div className="text-muted-foreground text-xs">Total Spent</div>
						</div>
					</div>
					{customer.notes && (
						<div className="pt-2">
							<div className="mb-1 font-medium text-muted-foreground text-xs">
								Notes
							</div>
							<p className="text-sm">{customer.notes}</p>
						</div>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="flex items-center gap-2 text-sm">
						<ShoppingBag className="size-4" />
						Recent Orders
					</CardTitle>
				</CardHeader>
				<CardContent>
					{orders.length === 0 ? (
						<p className="py-4 text-center text-muted-foreground text-sm">
							No orders yet
						</p>
					) : (
						<div className="space-y-2">
							{orders.map((o) => (
								<div
									key={o.id}
									className="flex items-center justify-between rounded-md border p-2 text-sm"
								>
									<div>
										<span className="font-medium font-mono">
											{o.orderNumber}
										</span>
										<span className="ml-2 text-muted-foreground">
											{new Date(o.createdAt).toLocaleDateString()}
										</span>
									</div>
									<div className="flex items-center gap-2">
										<Badge
											variant={
												o.status === "completed" ? "default" : "secondary"
											}
										>
											{o.status}
										</Badge>
										<span className="font-medium">
											{formatGYD(Number(o.total))}
										</span>
									</div>
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
