import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	CalendarClock,
	Clock,
	Edit2,
	Package,
	Plus,
	Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Switch } from "@/components/ui/switch";
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

const ALL_DAYS = [
	{ value: "mon", label: "Mon" },
	{ value: "tue", label: "Tue" },
	{ value: "wed", label: "Wed" },
	{ value: "thu", label: "Thu" },
	{ value: "fri", label: "Fri" },
	{ value: "sat", label: "Sat" },
	{ value: "sun", label: "Sun" },
] as const;

interface ScheduleForm {
	name: string;
	startTime: string;
	endTime: string;
	daysOfWeek: string[];
	isActive: boolean;
}

const emptyForm: ScheduleForm = {
	name: "",
	startTime: "06:00",
	endTime: "14:00",
	daysOfWeek: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
	isActive: true,
};

interface ScheduleRow {
	id: string;
	name: string;
	startTime: string;
	endTime: string;
	daysOfWeek: string;
	isActive: boolean;
	productCount: number;
	createdAt: Date | null;
	organizationId: string;
}

interface ScheduleDetailProduct {
	productId: string;
	overridePrice: string | null;
	productName: string;
	productPrice: string;
	productSku: string | null;
}

interface ScheduleDetail extends ScheduleRow {
	products: ScheduleDetailProduct[];
}

function isScheduleActiveNow(schedule: {
	startTime: string;
	endTime: string;
	daysOfWeek: string;
	isActive: boolean;
}): boolean {
	if (!schedule.isActive) return false;
	const now = new Date();
	const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
	const currentDay = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][
		now.getDay()
	]!;
	const days = schedule.daysOfWeek
		.split(",")
		.map((d: string) => d.trim().toLowerCase());
	if (!days.includes(currentDay)) return false;
	if (schedule.startTime <= schedule.endTime) {
		return currentTime >= schedule.startTime && currentTime <= schedule.endTime;
	}
	return currentTime >= schedule.startTime || currentTime <= schedule.endTime;
}

function formatDays(daysStr: string): string {
	const days = daysStr.split(",").map((d: string) => d.trim().toLowerCase());
	if (days.length === 7) return "Every day";
	if (
		days.length === 5 &&
		["mon", "tue", "wed", "thu", "fri"].every((d) => days.includes(d))
	)
		return "Weekdays";
	if (days.length === 2 && days.includes("sat") && days.includes("sun"))
		return "Weekends";
	return days.map((d) => d.charAt(0).toUpperCase() + d.slice(1)).join(", ");
}

export default function MenuSchedulesPage() {
	const queryClient = useQueryClient();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [form, setForm] = useState<ScheduleForm>(emptyForm);
	const [productDialogOpen, setProductDialogOpen] = useState(false);
	const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(
		null,
	);
	const [localAssignments, setLocalAssignments] = useState<
		Map<string, number | null>
	>(new Map());
	const [searchQuery, setSearchQuery] = useState("");

	const { data: rawSchedules = [], isLoading } = useQuery(
		orpc.menuSchedules.list.queryOptions({ input: {} }),
	);
	const schedules = rawSchedules as ScheduleRow[];

	const { data: rawDetail } = useQuery(
		orpc.menuSchedules.getById.queryOptions({
			input: { id: selectedScheduleId ?? "" },
			enabled: !!selectedScheduleId && productDialogOpen,
		}),
	);
	const scheduleDetail = rawDetail as ScheduleDetail | undefined;

	const { data: productsData } = useQuery(
		orpc.pos.getProducts.queryOptions({ input: {} }),
	);
	const allProducts = productsData?.products ?? [];

	const listKey = orpc.menuSchedules.list.queryOptions({ input: {} })
		.queryKey as readonly unknown[];

	const createMut = useMutation(
		orpc.menuSchedules.create.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: listKey });
				setDialogOpen(false);
				setForm(emptyForm);
				toast.success("Schedule created");
			},
			onError: (err: Error) =>
				toast.error(err.message || "Failed to create schedule"),
		}),
	);

	const updateMut = useMutation(
		orpc.menuSchedules.update.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: listKey });
				setDialogOpen(false);
				setEditingId(null);
				setForm(emptyForm);
				toast.success("Schedule updated");
			},
			onError: (err: Error) =>
				toast.error(err.message || "Failed to update schedule"),
		}),
	);

	const deleteMut = useMutation(
		orpc.menuSchedules.delete.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: listKey });
				toast.success("Schedule deleted");
			},
		}),
	);

	const toggleActiveMut = useMutation(
		orpc.menuSchedules.update.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: listKey });
			},
		}),
	);

	const assignProductsMut = useMutation(
		orpc.menuSchedules.assignProducts.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: listKey });
				setProductDialogOpen(false);
				toast.success("Products assigned");
			},
			onError: (err: Error) =>
				toast.error(err.message || "Failed to assign products"),
		}),
	);

	// Populate local assignments when schedule detail loads
	useEffect(() => {
		if (productDialogOpen && scheduleDetail?.products) {
			const map = new Map<string, number | null>();
			for (const p of scheduleDetail.products) {
				map.set(p.productId, p.overridePrice ? Number(p.overridePrice) : null);
			}
			setLocalAssignments(map);
		}
	}, [productDialogOpen, scheduleDetail]);

	function openCreate() {
		setEditingId(null);
		setForm(emptyForm);
		setDialogOpen(true);
	}

	function openEdit(s: ScheduleRow) {
		setEditingId(s.id);
		setForm({
			name: s.name,
			startTime: s.startTime,
			endTime: s.endTime,
			daysOfWeek: s.daysOfWeek
				.split(",")
				.map((d: string) => d.trim().toLowerCase()),
			isActive: s.isActive,
		});
		setDialogOpen(true);
	}

	function openProducts(scheduleId: string) {
		setSelectedScheduleId(scheduleId);
		setLocalAssignments(new Map());
		setSearchQuery("");
		setProductDialogOpen(true);
	}

	function toggleProduct(productId: string) {
		setLocalAssignments((prev) => {
			const next = new Map(prev);
			if (next.has(productId)) {
				next.delete(productId);
			} else {
				next.set(productId, null);
			}
			return next;
		});
	}

	function setOverridePrice(productId: string, price: string) {
		setLocalAssignments((prev) => {
			const next = new Map(prev);
			next.set(productId, price ? Number(price) : null);
			return next;
		});
	}

	function handleSave() {
		if (!form.name.trim()) {
			toast.error("Name is required");
			return;
		}
		if (form.daysOfWeek.length === 0) {
			toast.error("Select at least one day");
			return;
		}

		const daysOfWeek = form.daysOfWeek.join(",");

		if (editingId) {
			updateMut.mutate({
				id: editingId,
				name: form.name,
				startTime: form.startTime,
				endTime: form.endTime,
				daysOfWeek,
				isActive: form.isActive,
			} as never);
		} else {
			createMut.mutate({
				name: form.name,
				startTime: form.startTime,
				endTime: form.endTime,
				daysOfWeek,
				isActive: form.isActive,
			} as never);
		}
	}

	function handleAssignSave() {
		if (!selectedScheduleId) return;
		const products: Array<{ productId: string; overridePrice: number | null }> =
			[];
		localAssignments.forEach((overridePrice, productId) => {
			products.push({ productId, overridePrice });
		});
		assignProductsMut.mutate({
			scheduleId: selectedScheduleId,
			products,
		} as never);
	}

	function toggleDay(day: string) {
		setForm((prev) => ({
			...prev,
			daysOfWeek: prev.daysOfWeek.includes(day)
				? prev.daysOfWeek.filter((d) => d !== day)
				: [...prev.daysOfWeek, day],
		}));
	}

	const filteredProducts = allProducts.filter(
		(p) =>
			p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			p.sku?.toLowerCase().includes(searchQuery.toLowerCase()),
	);

	return (
		<div className="space-y-6 p-4 md:p-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="flex items-center gap-2 font-bold text-2xl">
						<CalendarClock className="size-6 text-primary" />
						Menu Schedules
					</h1>
					<p className="text-muted-foreground">
						Define time-based menus with optional price overrides
					</p>
				</div>
				<Button onClick={openCreate}>
					<Plus className="mr-2 size-4" />
					New Schedule
				</Button>
			</div>

			<Card>
				<CardContent className="p-0">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead>Time Window</TableHead>
								<TableHead>Days</TableHead>
								<TableHead>Products</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Active</TableHead>
								<TableHead className="w-32" />
							</TableRow>
						</TableHeader>
						<TableBody>
							{isLoading ? (
								<TableRow>
									<TableCell
										colSpan={7}
										className="py-8 text-center text-muted-foreground"
									>
										Loading...
									</TableCell>
								</TableRow>
							) : schedules.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={7}
										className="py-8 text-center text-muted-foreground"
									>
										<CalendarClock className="mx-auto mb-2 size-8 opacity-50" />
										No menu schedules configured
									</TableCell>
								</TableRow>
							) : (
								schedules.map((schedule) => {
									const activeNow = isScheduleActiveNow(schedule);
									return (
										<TableRow
											key={schedule.id}
											className={activeNow ? "bg-primary/5" : ""}
										>
											<TableCell className="font-medium">
												{schedule.name}
												{activeNow && (
													<Badge variant="default" className="ml-2 text-xs">
														Active Now
													</Badge>
												)}
											</TableCell>
											<TableCell>
												<span className="flex items-center gap-1 text-sm">
													<Clock className="size-3" />
													{schedule.startTime} - {schedule.endTime}
												</span>
											</TableCell>
											<TableCell className="text-sm">
												{formatDays(schedule.daysOfWeek)}
											</TableCell>
											<TableCell>
												<Button
													variant="ghost"
													size="sm"
													onClick={() => openProducts(schedule.id)}
													className="gap-1"
												>
													<Package className="size-3.5" />
													{schedule.productCount} product
													{schedule.productCount !== 1 ? "s" : ""}
												</Button>
											</TableCell>
											<TableCell>
												<Badge
													variant={schedule.isActive ? "default" : "secondary"}
												>
													{schedule.isActive ? "Enabled" : "Disabled"}
												</Badge>
											</TableCell>
											<TableCell>
												<Switch
													checked={schedule.isActive}
													onCheckedChange={(checked: boolean) =>
														toggleActiveMut.mutate({
															id: schedule.id,
															isActive: checked,
														} as never)
													}
												/>
											</TableCell>
											<TableCell>
												<div className="flex gap-1">
													<Button
														variant="ghost"
														size="sm"
														onClick={() => openEdit(schedule)}
													>
														<Edit2 className="size-3.5" />
													</Button>
													<Button
														variant="ghost"
														size="sm"
														onClick={() => {
															if (confirm("Delete this schedule?")) {
																deleteMut.mutate({ id: schedule.id } as never);
															}
														}}
													>
														<Trash2 className="size-3.5 text-destructive" />
													</Button>
												</div>
											</TableCell>
										</TableRow>
									);
								})
							)}
						</TableBody>
					</Table>
				</CardContent>
			</Card>

			{/* Schedule Create/Edit Dialog */}
			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogContent className="max-w-lg">
					<DialogHeader>
						<DialogTitle>
							{editingId ? "Edit Schedule" : "New Menu Schedule"}
						</DialogTitle>
						<DialogDescription>
							Set a time window and days for this menu schedule
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div>
							<Label>Name *</Label>
							<Input
								value={form.name}
								onChange={(e) => setForm({ ...form, name: e.target.value })}
								placeholder="e.g. Breakfast Menu, Lunch Special"
							/>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<div>
								<Label>Start Time</Label>
								<Input
									type="time"
									value={form.startTime}
									onChange={(e) =>
										setForm({ ...form, startTime: e.target.value })
									}
								/>
							</div>
							<div>
								<Label>End Time</Label>
								<Input
									type="time"
									value={form.endTime}
									onChange={(e) =>
										setForm({ ...form, endTime: e.target.value })
									}
								/>
							</div>
						</div>

						<div>
							<Label className="mb-2 block">Days of Week *</Label>
							<div className="flex flex-wrap gap-2">
								{ALL_DAYS.map((day) => (
									<Button
										key={day.value}
										type="button"
										variant={
											form.daysOfWeek.includes(day.value)
												? "default"
												: "outline"
										}
										size="sm"
										onClick={() => toggleDay(day.value)}
									>
										{day.label}
									</Button>
								))}
							</div>
						</div>

						<div className="flex items-center gap-3">
							<Switch
								checked={form.isActive}
								onCheckedChange={(checked: boolean) =>
									setForm({ ...form, isActive: checked })
								}
							/>
							<Label>Enabled</Label>
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

			{/* Product Assignment Dialog */}
			<Dialog
				open={productDialogOpen}
				onOpenChange={(open) => {
					setProductDialogOpen(open);
					if (!open) setSelectedScheduleId(null);
				}}
			>
				<DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Assign Products to Schedule</DialogTitle>
						<DialogDescription>
							Select products to include in this schedule. Optionally set price
							overrides.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4">
						<Input
							placeholder="Search products..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
						/>

						<div className="text-muted-foreground text-sm">
							{localAssignments.size} product
							{localAssignments.size !== 1 ? "s" : ""} selected
						</div>

						<div className="max-h-[50vh] overflow-y-auto rounded-md border">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="w-10" />
										<TableHead>Product</TableHead>
										<TableHead>Price</TableHead>
										<TableHead>Override Price</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{filteredProducts.map((product) => {
										const isAssigned = localAssignments.has(product.id);
										const override = localAssignments.get(product.id);
										return (
											<TableRow key={product.id}>
												<TableCell>
													<Checkbox
														checked={isAssigned}
														onCheckedChange={() => toggleProduct(product.id)}
													/>
												</TableCell>
												<TableCell>
													<div className="font-medium">{product.name}</div>
													{product.sku && (
														<div className="text-muted-foreground text-xs">
															SKU: {product.sku}
														</div>
													)}
												</TableCell>
												<TableCell>
													{formatGYD(Number(product.price))}
												</TableCell>
												<TableCell>
													{isAssigned && (
														<Input
															type="number"
															min={0}
															step="0.01"
															placeholder="Same as regular"
															value={override ?? ""}
															onChange={(e) =>
																setOverridePrice(product.id, e.target.value)
															}
															className="w-32"
														/>
													)}
												</TableCell>
											</TableRow>
										);
									})}
									{filteredProducts.length === 0 && (
										<TableRow>
											<TableCell
												colSpan={4}
												className="py-4 text-center text-muted-foreground"
											>
												No products found
											</TableCell>
										</TableRow>
									)}
								</TableBody>
							</Table>
						</div>
					</div>

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setProductDialogOpen(false)}
						>
							Cancel
						</Button>
						<Button
							onClick={handleAssignSave}
							disabled={assignProductsMut.isPending}
						>
							{assignProductsMut.isPending ? "Saving..." : "Save Assignments"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
