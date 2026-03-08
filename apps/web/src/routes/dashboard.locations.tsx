import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit2, MapPin, Plus, Trash2 } from "lucide-react";
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
import { Card, CardContent } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { orpc } from "@/utils/orpc";

interface LocationForm {
	name: string;
	address: string;
	phone: string;
	timezone: string;
	receiptHeader: string;
	receiptFooter: string;
	isActive: boolean;
}

const emptyForm: LocationForm = {
	name: "",
	address: "",
	phone: "",
	timezone: "America/Guyana",
	receiptHeader: "",
	receiptFooter: "",
	isActive: true,
};

export default function LocationsPage() {
	const queryClient = useQueryClient();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [form, setForm] = useState<LocationForm>(emptyForm);
	const [deleteId, setDeleteId] = useState<string | null>(null);

	const { data: locations = [], isLoading } = useQuery(
		orpc.locations.listLocations.queryOptions({ input: {} }),
	);

	const listKey = orpc.locations.listLocations.queryOptions({
		input: {},
	}).queryKey;

	const createMut = useMutation(
		orpc.locations.createLocation.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: listKey });
				setDialogOpen(false);
				setForm(emptyForm);
				toast.success("Location created");
			},
			onError: (err) => toast.error(err.message || "Failed to create location"),
		}),
	);

	const updateMut = useMutation(
		orpc.locations.updateLocation.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: listKey });
				setDialogOpen(false);
				setEditingId(null);
				setForm(emptyForm);
				toast.success("Location updated");
			},
			onError: (err) => toast.error(err.message || "Failed to update location"),
		}),
	);

	const deleteMut = useMutation(
		orpc.locations.deleteLocation.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: listKey });
				setDeleteId(null);
				toast.success("Location deactivated");
			},
			onError: (err) =>
				toast.error(err.message || "Failed to deactivate location"),
		}),
	);

	function openCreate() {
		setEditingId(null);
		setForm(emptyForm);
		setDialogOpen(true);
	}

	function openEdit(loc: (typeof locations)[number]) {
		setEditingId(loc.id);
		setForm({
			name: loc.name,
			address: loc.address || "",
			phone: loc.phone || "",
			timezone: loc.timezone,
			receiptHeader: loc.receiptHeader || "",
			receiptFooter: loc.receiptFooter || "",
			isActive: loc.isActive,
		});
		setDialogOpen(true);
	}

	function handleSave() {
		if (!form.name.trim()) {
			toast.error("Name is required");
			return;
		}

		const payload = {
			name: form.name,
			address: form.address || null,
			phone: form.phone || null,
			timezone: form.timezone,
			receiptHeader: form.receiptHeader || null,
			receiptFooter: form.receiptFooter || null,
			isActive: form.isActive,
		};

		if (editingId) {
			updateMut.mutate({ id: editingId, ...payload });
		} else {
			createMut.mutate(payload);
		}
	}

	const activeCount = locations.filter((l) => l.isActive).length;

	return (
		<div className="flex flex-col gap-6 p-4 md:p-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="flex items-center gap-2 font-bold text-2xl">
						<MapPin className="size-6 text-primary" />
						Locations
					</h1>
					<p className="text-muted-foreground">
						{activeCount} active location{activeCount !== 1 ? "s" : ""}
					</p>
				</div>
				<Button onClick={openCreate}>
					<Plus className="mr-2 size-4" />
					New Location
				</Button>
			</div>

			<Card>
				<CardContent className="p-0">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead>Address</TableHead>
								<TableHead>Phone</TableHead>
								<TableHead>Timezone</TableHead>
								<TableHead>Status</TableHead>
								<TableHead className="w-24" />
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
							) : locations.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={6}
										className="py-8 text-center text-muted-foreground"
									>
										<MapPin className="mx-auto mb-2 size-8 opacity-50" />
										No locations configured
									</TableCell>
								</TableRow>
							) : (
								locations.map((loc) => (
									<TableRow key={loc.id}>
										<TableCell className="font-medium">{loc.name}</TableCell>
										<TableCell>{loc.address || "---"}</TableCell>
										<TableCell>{loc.phone || "---"}</TableCell>
										<TableCell className="text-muted-foreground text-sm">
											{loc.timezone}
										</TableCell>
										<TableCell>
											<Badge variant={loc.isActive ? "default" : "secondary"}>
												{loc.isActive ? "Active" : "Inactive"}
											</Badge>
										</TableCell>
										<TableCell>
											<div className="flex gap-1">
												<Button
													variant="ghost"
													size="sm"
													onClick={() => openEdit(loc)}
												>
													<Edit2 className="size-3.5" />
												</Button>
												{loc.isActive && (
													<Button
														variant="ghost"
														size="sm"
														onClick={() => setDeleteId(loc.id)}
													>
														<Trash2 className="size-3.5 text-destructive" />
													</Button>
												)}
											</div>
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</CardContent>
			</Card>

			{/* Create/Edit Dialog */}
			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
					<DialogHeader>
						<DialogTitle>
							{editingId ? "Edit Location" : "New Location"}
						</DialogTitle>
						<DialogDescription>
							{editingId
								? "Update the location details below."
								: "Add a new location for your organization."}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div>
							<Label>Name *</Label>
							<Input
								value={form.name}
								onChange={(e) => setForm({ ...form, name: e.target.value })}
								placeholder="e.g. Main Branch, Georgetown"
							/>
						</div>
						<div>
							<Label>Address</Label>
							<Input
								value={form.address}
								onChange={(e) => setForm({ ...form, address: e.target.value })}
								placeholder="e.g. Lot 12 Robb Street, Georgetown"
							/>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div>
								<Label>Phone</Label>
								<Input
									value={form.phone}
									onChange={(e) => setForm({ ...form, phone: e.target.value })}
									placeholder="+592-227-0000"
								/>
							</div>
							<div>
								<Label>Timezone</Label>
								<Input
									value={form.timezone}
									onChange={(e) =>
										setForm({ ...form, timezone: e.target.value })
									}
									placeholder="America/Guyana"
								/>
							</div>
						</div>
						<div>
							<Label>Receipt Header</Label>
							<Input
								value={form.receiptHeader}
								onChange={(e) =>
									setForm({ ...form, receiptHeader: e.target.value })
								}
								placeholder="Optional header text for receipts"
							/>
						</div>
						<div>
							<Label>Receipt Footer</Label>
							<Input
								value={form.receiptFooter}
								onChange={(e) =>
									setForm({ ...form, receiptFooter: e.target.value })
								}
								placeholder="Optional footer text for receipts"
							/>
						</div>
						<div className="flex items-center gap-3">
							<Switch
								checked={form.isActive}
								onCheckedChange={(checked) =>
									setForm({ ...form, isActive: checked })
								}
							/>
							<Label>Active</Label>
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

			{/* Delete Confirmation */}
			<AlertDialog
				open={!!deleteId}
				onOpenChange={(open) => !open && setDeleteId(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Deactivate Location</AlertDialogTitle>
						<AlertDialogDescription>
							This will deactivate the location. It will no longer appear in the
							location switcher. Active orders at this location will prevent
							deactivation.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => deleteId && deleteMut.mutate({ id: deleteId })}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{deleteMut.isPending ? "Deactivating..." : "Deactivate"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
