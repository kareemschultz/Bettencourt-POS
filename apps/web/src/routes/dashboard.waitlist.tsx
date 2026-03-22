import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Bell,
	Check,
	Clock,
	Loader2,
	Plus,
	Trash2,
	Users,
	X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { orpc } from "@/utils/orpc";

const STATUS_COLORS: Record<string, string> = {
	waiting: "bg-blue-100 text-blue-800",
	notified: "bg-yellow-100 text-yellow-800",
	seated: "bg-green-100 text-green-800",
	cancelled: "bg-gray-100 text-gray-800",
	no_show: "bg-red-100 text-red-800",
};

type WaitlistRow = {
	id: string;
	customerName: string;
	customerPhone: string | null;
	partySize: number;
	estimatedWaitMinutes: number | null;
	status: string;
	notes: string | null;
	notifiedAt: string | null;
	seatedAt: string | null;
	createdAt: string;
};

export default function WaitlistPage() {
	const qc = useQueryClient();
	const [addOpen, setAddOpen] = useState(false);

	const queryKey = orpc.waitlist.list.queryOptions({ input: {} }).queryKey;

	const { data: entries = [], isLoading } = useQuery(
		orpc.waitlist.list.queryOptions({ input: {} }),
	);

	const addMut = useMutation(
		orpc.waitlist.add.mutationOptions({
			onSuccess: () => {
				qc.invalidateQueries({ queryKey });
				setAddOpen(false);
				toast.success("Added to waitlist");
			},
		}),
	);

	const updateMut = useMutation(
		orpc.waitlist.updateStatus.mutationOptions({
			onSuccess: () => {
				qc.invalidateQueries({ queryKey });
			},
		}),
	);

	const removeMut = useMutation(
		orpc.waitlist.remove.mutationOptions({
			onSuccess: () => {
				qc.invalidateQueries({ queryKey });
				toast.success("Removed from waitlist");
			},
		}),
	);

	const rows = entries as unknown as WaitlistRow[];
	const waiting = rows.filter((r) => r.status === "waiting").length;
	const totalGuests = rows
		.filter((r) => r.status === "waiting")
		.reduce((sum, r) => sum + r.partySize, 0);

	function ageLabel(createdAt: string): string {
		const mins = Math.floor(
			(Date.now() - new Date(createdAt).getTime()) / 60000,
		);
		if (mins < 1) return "Just now";
		if (mins < 60) return `${mins}m`;
		return `${Math.floor(mins / 60)}h ${mins % 60}m`;
	}

	return (
		<div className="space-y-6 p-4 md:p-6">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="font-bold text-2xl tracking-tight">Waitlist</h1>
					<p className="text-muted-foreground text-sm">
						Manage guest waitlist queue
					</p>
				</div>
				<Dialog open={addOpen} onOpenChange={setAddOpen}>
					<DialogTrigger asChild>
						<Button>
							<Plus className="mr-1 size-4" /> Add Guest
						</Button>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Add to Waitlist</DialogTitle>
						</DialogHeader>
						<AddWaitlistForm
							onSubmit={(data) => addMut.mutate(data)}
							isSubmitting={addMut.isPending}
						/>
					</DialogContent>
				</Dialog>
			</div>

			{/* Summary */}
			<div className="grid grid-cols-3 gap-4">
				<Card>
					<CardContent className="flex items-center gap-3 py-4">
						<Clock className="size-8 text-blue-500" />
						<div>
							<p className="font-bold text-2xl">{waiting}</p>
							<p className="text-muted-foreground text-xs">Waiting</p>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="flex items-center gap-3 py-4">
						<Users className="size-8 text-muted-foreground" />
						<div>
							<p className="font-bold text-2xl">{totalGuests}</p>
							<p className="text-muted-foreground text-xs">Guests in queue</p>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="flex items-center gap-3 py-4">
						<Check className="size-8 text-green-500" />
						<div>
							<p className="font-bold text-2xl">
								{rows.filter((r) => r.status === "seated").length}
							</p>
							<p className="text-muted-foreground text-xs">Seated today</p>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Queue */}
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
									<TableHead>#</TableHead>
									<TableHead>Guest</TableHead>
									<TableHead>Phone</TableHead>
									<TableHead className="text-center">Party</TableHead>
									<TableHead>Wait</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Notes</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{rows.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={8}
											className="py-12 text-center text-muted-foreground"
										>
											Waitlist is empty
										</TableCell>
									</TableRow>
								) : (
									rows.map((r, i) => (
										<TableRow key={r.id}>
											<TableCell className="text-muted-foreground">
												{i + 1}
											</TableCell>
											<TableCell className="font-medium">
												{r.customerName}
											</TableCell>
											<TableCell className="text-muted-foreground text-xs">
												{r.customerPhone || "–"}
											</TableCell>
											<TableCell className="text-center">
												{r.partySize}
											</TableCell>
											<TableCell className="text-muted-foreground text-xs">
												{ageLabel(r.createdAt)}
											</TableCell>
											<TableCell>
												<Badge
													variant="secondary"
													className={STATUS_COLORS[r.status] ?? ""}
												>
													{r.status.replace("_", " ")}
												</Badge>
											</TableCell>
											<TableCell className="max-w-[120px] truncate text-muted-foreground text-xs">
												{r.notes || "–"}
											</TableCell>
											<TableCell className="text-right">
												<div className="flex justify-end gap-1">
													{r.status === "waiting" && (
														<>
															<Button
																variant="outline"
																size="sm"
																onClick={() =>
																	updateMut.mutate({
																		id: r.id,
																		status: "notified",
																	})
																}
															>
																<Bell className="mr-1 size-3" />
																Notify
															</Button>
															<Button
																variant="outline"
																size="sm"
																onClick={() =>
																	updateMut.mutate({
																		id: r.id,
																		status: "seated",
																	})
																}
															>
																<Check className="mr-1 size-3" />
																Seat
															</Button>
														</>
													)}
													{r.status === "notified" && (
														<Button
															variant="outline"
															size="sm"
															onClick={() =>
																updateMut.mutate({
																	id: r.id,
																	status: "seated",
																})
															}
														>
															<Check className="mr-1 size-3" />
															Seat
														</Button>
													)}
													{(r.status === "waiting" ||
														r.status === "notified") && (
														<Button
															variant="ghost"
															size="sm"
															onClick={() =>
																updateMut.mutate({
																	id: r.id,
																	status: "no_show",
																})
															}
														>
															<X className="size-3 text-orange-500" />
														</Button>
													)}
													<Button
														variant="ghost"
														size="sm"
														onClick={() => {
															if (confirm("Remove from waitlist?")) {
																removeMut.mutate({
																	id: r.id,
																});
															}
														}}
													>
														<Trash2 className="size-3 text-destructive" />
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
			)}
		</div>
	);
}

function AddWaitlistForm({
	onSubmit,
	isSubmitting,
}: {
	onSubmit: (data: {
		customerName: string;
		customerPhone?: string | null;
		partySize: number;
		estimatedWaitMinutes?: number | null;
		notes?: string | null;
	}) => void;
	isSubmitting: boolean;
}) {
	const [name, setName] = useState("");
	const [phone, setPhone] = useState("");
	const [party, setParty] = useState(2);
	const [wait, setWait] = useState("");
	const [notes, setNotes] = useState("");

	return (
		<>
			<div className="space-y-4 py-4">
				<div className="grid grid-cols-2 gap-3">
					<div className="space-y-1.5">
						<Label>Guest Name</Label>
						<Input
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="John Smith"
						/>
					</div>
					<div className="space-y-1.5">
						<Label>Phone</Label>
						<Input
							value={phone}
							onChange={(e) => setPhone(e.target.value)}
							placeholder="+592-..."
						/>
					</div>
				</div>
				<div className="grid grid-cols-2 gap-3">
					<div className="space-y-1.5">
						<Label>Party Size</Label>
						<Input
							type="number"
							min={1}
							max={50}
							value={party}
							onChange={(e) => setParty(Number(e.target.value))}
						/>
					</div>
					<div className="space-y-1.5">
						<Label>Est. Wait (min)</Label>
						<Input
							type="number"
							min={0}
							value={wait}
							onChange={(e) => setWait(e.target.value)}
							placeholder="15"
						/>
					</div>
				</div>
				<div className="space-y-1.5">
					<Label>Notes</Label>
					<Input
						value={notes}
						onChange={(e) => setNotes(e.target.value)}
						placeholder="High chair needed, allergies..."
					/>
				</div>
			</div>
			<DialogFooter>
				<Button
					onClick={() =>
						onSubmit({
							customerName: name,
							customerPhone: phone || null,
							partySize: party,
							estimatedWaitMinutes: wait ? Number(wait) : null,
							notes: notes || null,
						})
					}
					disabled={!name.trim() || isSubmitting}
				>
					{isSubmitting && <Loader2 className="mr-1 size-4 animate-spin" />}
					Add to Waitlist
				</Button>
			</DialogFooter>
		</>
	);
}
