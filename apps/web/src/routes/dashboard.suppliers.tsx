import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Building2,
	Mail,
	MapPin,
	Phone,
	Plus,
	Search,
	Trash2,
	User,
} from "lucide-react";
import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { orpc } from "@/utils/orpc";

type SupplierRow = {
	id: string;
	name: string;
	contactName: string | null;
	email: string | null;
	phone: string | null;
	address: string | null;
	salesRep: string | null;
	categories: string[];
	itemsSupplied: string | null;
	isActive: boolean;
};

const BLANK_FORM = {
	name: "",
	contactName: "",
	email: "",
	phone: "",
	address: "",
	salesRep: "",
	categoriesText: "", // comma-separated input
	itemsSupplied: "",
};

export default function SuppliersPage() {
	const qc = useQueryClient();
	const [search, setSearch] = useState("");
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editId, setEditId] = useState<string | null>(null);
	const [form, setForm] = useState(BLANK_FORM);

	const { data: suppliers = [], isLoading } = useQuery(
		orpc.settings.getSuppliers.queryOptions({ input: {} }),
	);

	const createMut = useMutation(
		orpc.settings.createSupplier.mutationOptions({
			onSuccess: () => {
				qc.invalidateQueries({
					queryKey: orpc.settings.getSuppliers.queryOptions({ input: {} })
						.queryKey,
				});
				toast.success("Supplier added");
				setDialogOpen(false);
			},
			onError: () => toast.error("Failed to add supplier"),
		}),
	);

	const updateMut = useMutation(
		orpc.settings.updateSupplier.mutationOptions({
			onSuccess: () => {
				qc.invalidateQueries({
					queryKey: orpc.settings.getSuppliers.queryOptions({ input: {} })
						.queryKey,
				});
				toast.success("Supplier updated");
				setDialogOpen(false);
			},
			onError: () => toast.error("Failed to update supplier"),
		}),
	);

	const deleteMut = useMutation(
		orpc.settings.deleteSupplier.mutationOptions({
			onSuccess: () => {
				qc.invalidateQueries({
					queryKey: orpc.settings.getSuppliers.queryOptions({ input: {} })
						.queryKey,
				});
				toast.success("Supplier deactivated");
			},
			onError: () => toast.error("Failed to remove supplier"),
		}),
	);

	const filtered = (suppliers as SupplierRow[]).filter(
		(s) =>
			s.isActive &&
			(search === "" ||
				s.name.toLowerCase().includes(search.toLowerCase()) ||
				(s.contactName ?? "").toLowerCase().includes(search.toLowerCase()) ||
				(s.salesRep ?? "").toLowerCase().includes(search.toLowerCase())),
	);

	function openCreate() {
		setEditId(null);
		setForm(BLANK_FORM);
		setDialogOpen(true);
	}

	function openEdit(s: SupplierRow) {
		setEditId(s.id);
		setForm({
			name: s.name,
			contactName: s.contactName ?? "",
			email: s.email ?? "",
			phone: s.phone ?? "",
			address: s.address ?? "",
			salesRep: s.salesRep ?? "",
			categoriesText: (s.categories ?? []).join(", "),
			itemsSupplied: s.itemsSupplied ?? "",
		});
		setDialogOpen(true);
	}

	function handleSave() {
		const categories = form.categoriesText
			.split(",")
			.map((c) => c.trim())
			.filter(Boolean);

		const payload = {
			name: form.name,
			contactName: form.contactName || null,
			email: form.email || null,
			phone: form.phone || null,
			address: form.address || null,
			salesRep: form.salesRep || null,
			categories,
			itemsSupplied: form.itemsSupplied || null,
		};

		if (editId) {
			updateMut.mutate({ id: editId, ...payload });
		} else {
			createMut.mutate(payload);
		}
	}

	const saving = createMut.isPending || updateMut.isPending;

	return (
		<div className="space-y-6 p-4 md:p-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="font-bold text-2xl">Suppliers</h1>
					<p className="text-muted-foreground text-sm">
						Manage supplier contacts, categories, and items supplied
					</p>
				</div>
				<Button onClick={openCreate} className="gap-1.5">
					<Plus className="size-4" />
					Add Supplier
				</Button>
			</div>

			{/* Search */}
			<div className="relative max-w-sm">
				<Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					placeholder="Search suppliers..."
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					className="pl-9"
				/>
			</div>

			{/* Supplier grid */}
			{isLoading ? (
				<div className="py-16 text-center text-muted-foreground">
					Loading suppliers...
				</div>
			) : filtered.length === 0 ? (
				<div className="py-16 text-center text-muted-foreground">
					{search
						? "No suppliers match your search."
						: "No suppliers yet. Add one to get started."}
				</div>
			) : (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{filtered.map((s) => (
						<button
							key={s.id}
							type="button"
							className="w-full cursor-pointer space-y-3 rounded-lg border bg-card p-4 text-left transition-shadow hover:shadow-sm"
							onClick={() => openEdit(s)}
						>
							<div className="flex items-start justify-between gap-2">
								<div className="flex min-w-0 items-center gap-2">
									<div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
										<Building2 className="size-4 text-primary" />
									</div>
									<div className="min-w-0">
										<p className="truncate font-semibold">{s.name}</p>
										{s.contactName && (
											<p className="truncate text-muted-foreground text-xs">
												{s.contactName}
											</p>
										)}
									</div>
								</div>
								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										if (confirm(`Deactivate ${s.name}?`)) {
											deleteMut.mutate({ id: s.id });
										}
									}}
									className="rounded p-1 text-muted-foreground hover:text-destructive"
								>
									<Trash2 className="size-3.5" />
								</button>
							</div>

							{/* Categories */}
							{s.categories && s.categories.length > 0 && (
								<div className="flex flex-wrap gap-1">
									{s.categories.map((cat) => (
										<Badge key={cat} variant="secondary" className="text-xs">
											{cat}
										</Badge>
									))}
								</div>
							)}

							{/* Contact info */}
							<div className="space-y-1 text-muted-foreground text-xs">
								{s.phone && (
									<div className="flex items-center gap-1.5">
										<Phone className="size-3 shrink-0" />
										{s.phone}
									</div>
								)}
								{s.email && (
									<div className="flex items-center gap-1.5">
										<Mail className="size-3 shrink-0" />
										<span className="truncate">{s.email}</span>
									</div>
								)}
								{s.address && (
									<div className="flex items-center gap-1.5">
										<MapPin className="size-3 shrink-0" />
										<span className="truncate">{s.address}</span>
									</div>
								)}
								{s.salesRep && (
									<div className="flex items-center gap-1.5">
										<User className="size-3 shrink-0" />
										Sales rep: {s.salesRep}
									</div>
								)}
							</div>

							{/* Items supplied */}
							{s.itemsSupplied && (
								<p className="line-clamp-2 border-t pt-2 text-muted-foreground text-xs">
									<span className="font-medium text-foreground">
										Supplies:{" "}
									</span>
									{s.itemsSupplied}
								</p>
							)}
						</button>
					))}
				</div>
			)}

			{/* Add / Edit Dialog */}
			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
					<DialogHeader>
						<DialogTitle>
							{editId ? "Edit Supplier" : "Add Supplier"}
						</DialogTitle>
					</DialogHeader>

					<div className="space-y-4 py-2">
						<div className="space-y-1.5">
							<Label>Business Name *</Label>
							<Input
								value={form.name}
								onChange={(e) =>
									setForm((f) => ({ ...f, name: e.target.value }))
								}
								placeholder="e.g. Fresh Foods Supply"
							/>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1.5">
								<Label>Person of Contact</Label>
								<Input
									value={form.contactName}
									onChange={(e) =>
										setForm((f) => ({ ...f, contactName: e.target.value }))
									}
									placeholder="Main contact"
								/>
							</div>
							<div className="space-y-1.5">
								<Label>Sales Rep</Label>
								<Input
									value={form.salesRep}
									onChange={(e) =>
										setForm((f) => ({ ...f, salesRep: e.target.value }))
									}
									placeholder="Sales representative"
								/>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1.5">
								<Label>Phone</Label>
								<Input
									value={form.phone}
									onChange={(e) =>
										setForm((f) => ({ ...f, phone: e.target.value }))
									}
									placeholder="+592 ..."
								/>
							</div>
							<div className="space-y-1.5">
								<Label>Email</Label>
								<Input
									type="email"
									value={form.email}
									onChange={(e) =>
										setForm((f) => ({ ...f, email: e.target.value }))
									}
									placeholder="supplier@email.com"
								/>
							</div>
						</div>

						<div className="space-y-1.5">
							<Label>Address</Label>
							<Input
								value={form.address}
								onChange={(e) =>
									setForm((f) => ({ ...f, address: e.target.value }))
								}
								placeholder="Street, City"
							/>
						</div>

						<div className="space-y-1.5">
							<Label>Categories</Label>
							<Input
								value={form.categoriesText}
								onChange={(e) =>
									setForm((f) => ({ ...f, categoriesText: e.target.value }))
								}
								placeholder="e.g. Food & Beverage, Packaging (comma-separated)"
							/>
							<p className="text-muted-foreground text-xs">
								Separate multiple categories with commas
							</p>
						</div>

						<div className="space-y-1.5">
							<Label>Items Supplied</Label>
							<Textarea
								value={form.itemsSupplied}
								onChange={(e) =>
									setForm((f) => ({ ...f, itemsSupplied: e.target.value }))
								}
								placeholder="e.g. Chicken, rice, cooking oil, flour..."
								rows={2}
							/>
						</div>
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => setDialogOpen(false)}>
							Cancel
						</Button>
						<Button onClick={handleSave} disabled={!form.name.trim() || saving}>
							{saving ? "Saving..." : editId ? "Save Changes" : "Add Supplier"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
