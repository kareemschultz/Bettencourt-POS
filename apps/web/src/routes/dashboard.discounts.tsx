import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Calendar,
	Clock,
	Edit2,
	Percent,
	Plus,
	Tag,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
import { formatGYD } from "@/lib/types";
import { orpc } from "@/utils/orpc";

interface DiscountForm {
	name: string;
	type: string;
	value: number;
	applyTo: string;
	minOrderTotal: string;
	minQuantity: string;
	buyQuantity: string;
	getQuantity: string;
	isAutoApply: boolean;
	scheduleType: string;
	startTime: string;
	endTime: string;
	startDate: string;
	endDate: string;
	daysOfWeek: string;
	promoCode: string;
	maxUses: string;
	stackable: boolean;
}

const emptyForm: DiscountForm = {
	name: "",
	type: "percentage",
	value: 10,
	applyTo: "order",
	minOrderTotal: "",
	minQuantity: "",
	buyQuantity: "",
	getQuantity: "",
	isAutoApply: false,
	scheduleType: "always",
	startTime: "",
	endTime: "",
	startDate: "",
	endDate: "",
	daysOfWeek: "",
	promoCode: "",
	maxUses: "",
	stackable: false,
};

function getDiscountStatus(rule: {
	isActive: boolean;
	scheduleType: string;
	startDate: string | null;
	endDate: string | null;
}): { label: string; variant: "default" | "secondary" | "destructive" } {
	if (!rule.isActive) return { label: "Inactive", variant: "secondary" };
	if (rule.scheduleType === "date_range" && rule.endDate) {
		const now = new Date().toISOString().split("T")[0]!;
		if (now > rule.endDate) return { label: "Expired", variant: "destructive" };
		if (rule.startDate && now < rule.startDate)
			return { label: "Scheduled", variant: "secondary" };
	}
	return { label: "Active", variant: "default" };
}

function formatDiscountValue(type: string, value: string) {
	const v = Number(value);
	if (type === "percentage") return `${v}%`;
	if (type === "fixed") return formatGYD(v);
	if (type === "bogo") return "BOGO";
	return "Buy X Get Y";
}

export default function DiscountsPage() {
	const queryClient = useQueryClient();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [form, setForm] = useState<DiscountForm>(emptyForm);

	const { data: rules = [], isLoading } = useQuery(
		orpc.discounts.list.queryOptions({ input: {} }),
	);

	const listKey = orpc.discounts.list.queryOptions({ input: {} }).queryKey;

	const createMut = useMutation(
		orpc.discounts.create.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: listKey });
				setDialogOpen(false);
				setForm(emptyForm);
				toast.success("Discount rule created");
			},
			onError: (err) => toast.error(err.message || "Failed to create discount"),
		}),
	);

	const updateMut = useMutation(
		orpc.discounts.update.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: listKey });
				setDialogOpen(false);
				setEditingId(null);
				setForm(emptyForm);
				toast.success("Discount rule updated");
			},
			onError: (err) => toast.error(err.message || "Failed to update discount"),
		}),
	);

	const removeMut = useMutation(
		orpc.discounts.remove.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: listKey });
				toast.success("Discount rule deactivated");
			},
		}),
	);

	function openCreate() {
		setEditingId(null);
		setForm(emptyForm);
		setDialogOpen(true);
	}

	function openEdit(r: Record<string, unknown>) {
		setEditingId(r.id as string);
		setForm({
			name: r.name as string,
			type: r.type as string,
			value: Number(r.value),
			applyTo: r.applyTo as string,
			minOrderTotal: r.minOrderTotal ? String(r.minOrderTotal) : "",
			minQuantity: r.minQuantity ? String(r.minQuantity) : "",
			buyQuantity: r.buyQuantity ? String(r.buyQuantity) : "",
			getQuantity: r.getQuantity ? String(r.getQuantity) : "",
			isAutoApply: r.isAutoApply as boolean,
			scheduleType: r.scheduleType as string,
			startTime: (r.startTime as string) || "",
			endTime: (r.endTime as string) || "",
			startDate: (r.startDate as string) || "",
			endDate: (r.endDate as string) || "",
			daysOfWeek: (r.daysOfWeek as string) || "",
			promoCode: (r.promoCode as string) || "",
			maxUses: r.maxUses ? String(r.maxUses) : "",
			stackable: r.stackable as boolean,
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
			type: form.type as "percentage" | "fixed" | "bogo" | "buy_x_get_y",
			value: form.value,
			applyTo: form.applyTo as "order" | "item" | "category",
			minOrderTotal: form.minOrderTotal ? Number(form.minOrderTotal) : null,
			minQuantity: form.minQuantity ? Number(form.minQuantity) : null,
			buyQuantity: form.buyQuantity ? Number(form.buyQuantity) : null,
			getQuantity: form.getQuantity ? Number(form.getQuantity) : null,
			isAutoApply: form.isAutoApply,
			scheduleType: form.scheduleType as
				| "always"
				| "time_window"
				| "date_range",
			startTime: form.startTime || null,
			endTime: form.endTime || null,
			startDate: form.startDate || null,
			endDate: form.endDate || null,
			daysOfWeek: form.daysOfWeek || null,
			promoCode: form.promoCode || null,
			maxUses: form.maxUses ? Number(form.maxUses) : null,
			stackable: form.stackable,
		};

		if (editingId) {
			updateMut.mutate({ id: editingId, ...payload });
		} else {
			createMut.mutate(payload);
		}
	}

	const activeCount = rules.filter((r) => r.isActive).length;

	return (
		<div className="space-y-6 p-4 md:p-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="flex items-center gap-2 font-bold text-2xl">
						<Percent className="size-6 text-primary" />
						Discount Rules
					</h1>
					<p className="text-muted-foreground text-sm">
						Create and manage percentage, fixed, or BOGO discounts. Schedule
						them for happy hours, promo periods, or set up promo codes.{" "}
						{activeCount} active rule{activeCount !== 1 ? "s" : ""}.
					</p>
				</div>
				<Button onClick={openCreate}>
					<Plus className="mr-2 size-4" />
					New Discount
				</Button>
			</div>

			<Card>
				<CardContent className="p-0">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead>Type</TableHead>
								<TableHead>Value</TableHead>
								<TableHead>Schedule</TableHead>
								<TableHead>Promo Code</TableHead>
								<TableHead>Usage</TableHead>
								<TableHead>Status</TableHead>
								<TableHead className="w-24" />
							</TableRow>
						</TableHeader>
						<TableBody>
							{isLoading ? (
								<TableRow>
									<TableCell
										colSpan={8}
										className="py-8 text-center text-muted-foreground"
									>
										Loading...
									</TableCell>
								</TableRow>
							) : rules.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={8}
										className="py-8 text-center text-muted-foreground"
									>
										<Tag className="mx-auto mb-2 size-8 opacity-50" />
										<p className="font-medium">No discount rules configured</p>
										<p className="mt-1 text-xs">
											Click "New Discount" to create your first rule --
											percentage off, fixed amount, BOGO, and more.
										</p>
									</TableCell>
								</TableRow>
							) : (
								rules.map((rule) => {
									const status = getDiscountStatus(rule);
									return (
										<TableRow key={rule.id}>
											<TableCell className="font-medium">{rule.name}</TableCell>
											<TableCell>
												<Badge variant="secondary" className="capitalize">
													{rule.type.replace("_", " ")}
												</Badge>
											</TableCell>
											<TableCell>
												{formatDiscountValue(rule.type, rule.value)}
											</TableCell>
											<TableCell>
												{rule.scheduleType === "always" ? (
													"Always"
												) : rule.scheduleType === "time_window" ? (
													<span className="flex items-center gap-1 text-sm">
														<Clock className="size-3" />
														{rule.startTime}–{rule.endTime}
													</span>
												) : (
													<span className="flex items-center gap-1 text-sm">
														<Calendar className="size-3" />
														{rule.startDate} to {rule.endDate}
													</span>
												)}
											</TableCell>
											<TableCell>
												{rule.promoCode ? (
													<Badge variant="outline" className="font-mono">
														{rule.promoCode}
													</Badge>
												) : rule.isAutoApply ? (
													<Badge variant="secondary">Auto-apply</Badge>
												) : (
													"Manual"
												)}
											</TableCell>
											<TableCell>
												{rule.maxUses
													? `${rule.currentUses}/${rule.maxUses}`
													: rule.currentUses > 0
														? rule.currentUses.toString()
														: "—"}
											</TableCell>
											<TableCell>
												<Badge variant={status.variant}>{status.label}</Badge>
											</TableCell>
											<TableCell>
												<div className="flex gap-1">
													<Button
														variant="ghost"
														size="sm"
														onClick={() =>
															openEdit(
																rule as unknown as Record<string, unknown>,
															)
														}
													>
														<Edit2 className="size-3.5" />
													</Button>
													{rule.isActive && (
														<Button
															variant="ghost"
															size="sm"
															onClick={() => removeMut.mutate({ id: rule.id })}
														>
															<Trash2 className="size-3.5 text-destructive" />
														</Button>
													)}
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

			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
					<DialogHeader>
						<DialogTitle>
							{editingId ? "Edit Discount Rule" : "New Discount Rule"}
						</DialogTitle>
						<DialogDescription>
							Configure discount conditions and schedule
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div>
							<Label>Name *</Label>
							<Input
								value={form.name}
								onChange={(e) => setForm({ ...form, name: e.target.value })}
								placeholder="e.g. Happy Hour, BOGO Chicken"
							/>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<div>
								<Label>Type</Label>
								<Select
									value={form.type}
									onValueChange={(v) => setForm({ ...form, type: v })}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="percentage">Percentage</SelectItem>
										<SelectItem value="fixed">Fixed Amount</SelectItem>
										<SelectItem value="bogo">BOGO</SelectItem>
										<SelectItem value="buy_x_get_y">Buy X Get Y</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div>
								<Label>
									{form.type === "percentage" ? "Discount %" : "Amount (GYD)"}
								</Label>
								<Input
									type="number"
									min={0}
									value={form.value}
									onChange={(e) =>
										setForm({ ...form, value: Number(e.target.value) })
									}
								/>
							</div>
						</div>

						<div>
							<Label>Apply To</Label>
							<Select
								value={form.applyTo}
								onValueChange={(v) => setForm({ ...form, applyTo: v })}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="order">Entire Order</SelectItem>
									<SelectItem value="item">Specific Product</SelectItem>
									<SelectItem value="category">Category</SelectItem>
								</SelectContent>
							</Select>
						</div>

						{(form.type === "bogo" || form.type === "buy_x_get_y") && (
							<div className="grid grid-cols-2 gap-3">
								<div>
									<Label>Buy Quantity</Label>
									<Input
										type="number"
										min={1}
										value={form.buyQuantity}
										onChange={(e) =>
											setForm({ ...form, buyQuantity: e.target.value })
										}
										placeholder="e.g. 2"
									/>
								</div>
								<div>
									<Label>Get Quantity (Free)</Label>
									<Input
										type="number"
										min={1}
										value={form.getQuantity}
										onChange={(e) =>
											setForm({ ...form, getQuantity: e.target.value })
										}
										placeholder="e.g. 1"
									/>
								</div>
							</div>
						)}

						<div className="grid grid-cols-2 gap-3">
							<div>
								<Label>Min Order Total (GYD)</Label>
								<Input
									type="number"
									min={0}
									value={form.minOrderTotal}
									onChange={(e) =>
										setForm({ ...form, minOrderTotal: e.target.value })
									}
									placeholder="Optional"
								/>
							</div>
							<div>
								<Label>Min Quantity</Label>
								<Input
									type="number"
									min={0}
									value={form.minQuantity}
									onChange={(e) =>
										setForm({ ...form, minQuantity: e.target.value })
									}
									placeholder="Optional"
								/>
							</div>
						</div>

						<div className="border-t pt-4">
							<Label className="font-semibold text-base">Schedule</Label>
							<Select
								value={form.scheduleType}
								onValueChange={(v) => setForm({ ...form, scheduleType: v })}
							>
								<SelectTrigger className="mt-2">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="always">Always Active</SelectItem>
									<SelectItem value="time_window">
										Time Window (e.g. Happy Hour)
									</SelectItem>
									<SelectItem value="date_range">
										Date Range (Promo Period)
									</SelectItem>
								</SelectContent>
							</Select>
						</div>

						{form.scheduleType === "time_window" && (
							<>
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
									<Label>Days of Week (comma-separated)</Label>
									<Input
										value={form.daysOfWeek}
										onChange={(e) =>
											setForm({ ...form, daysOfWeek: e.target.value })
										}
										placeholder="mon,tue,wed,thu,fri"
									/>
								</div>
							</>
						)}

						{form.scheduleType === "date_range" && (
							<div className="grid grid-cols-2 gap-3">
								<div>
									<Label>Start Date</Label>
									<Input
										type="date"
										value={form.startDate}
										onChange={(e) =>
											setForm({ ...form, startDate: e.target.value })
										}
									/>
								</div>
								<div>
									<Label>End Date</Label>
									<Input
										type="date"
										value={form.endDate}
										onChange={(e) =>
											setForm({ ...form, endDate: e.target.value })
										}
									/>
								</div>
							</div>
						)}

						<div className="space-y-3 border-t pt-4">
							<div>
								<Label>Promo Code (optional)</Label>
								<Input
									value={form.promoCode}
									onChange={(e) =>
										setForm({
											...form,
											promoCode: e.target.value.toUpperCase(),
										})
									}
									placeholder="e.g. HAPPYHOUR"
									className="font-mono uppercase"
								/>
							</div>
							<div>
								<Label>Max Uses (leave empty for unlimited)</Label>
								<Input
									type="number"
									min={1}
									value={form.maxUses}
									onChange={(e) =>
										setForm({ ...form, maxUses: e.target.value })
									}
									placeholder="Unlimited"
								/>
							</div>
							<div className="flex items-center gap-3">
								<Switch
									checked={form.isAutoApply}
									onCheckedChange={(checked) =>
										setForm({ ...form, isAutoApply: checked })
									}
								/>
								<Label>Auto-apply at POS (no code needed)</Label>
							</div>
							<div className="flex items-center gap-3">
								<Switch
									checked={form.stackable}
									onCheckedChange={(checked) =>
										setForm({ ...form, stackable: checked })
									}
								/>
								<Label>Stackable (can combine with other discounts)</Label>
							</div>
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
		</div>
	);
}
