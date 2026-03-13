import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	CalendarDays,
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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { todayGY } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

const STATUS_COLORS: Record<string, string> = {
	confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
	seated: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
	completed: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
	cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
	no_show: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
};

export default function ReservationsPage() {
	const qc = useQueryClient();
	const [selectedDate, setSelectedDate] = useState(todayGY());
	const [createOpen, setCreateOpen] = useState(false);
	const [statusFilter, setStatusFilter] = useState("all");

	const queryKey = orpc.reservations.list.queryOptions({
		input: { date: selectedDate },
	}).queryKey;

	const { data: reservations = [], isLoading } = useQuery(
		orpc.reservations.list.queryOptions({
			input: { date: selectedDate },
		}),
	);

	const { data: tables = [] } = useQuery(
		orpc.tables.list.queryOptions({ input: {} }),
	);

	const createMutation = useMutation(
		orpc.reservations.create.mutationOptions({
			onSuccess: () => {
				qc.invalidateQueries({ queryKey });
				setCreateOpen(false);
				toast.success("Reservation created");
			},
		}),
	);

	const updateMutation = useMutation(
		orpc.reservations.update.mutationOptions({
			onSuccess: () => {
				qc.invalidateQueries({ queryKey });
			},
		}),
	);

	const removeMutation = useMutation(
		orpc.reservations.remove.mutationOptions({
			onSuccess: () => {
				qc.invalidateQueries({ queryKey });
				toast.success("Reservation removed");
			},
		}),
	);

	const filtered = statusFilter === "all"
		? reservations
		: (reservations as Array<{ status: string }>).filter((r) => r.status === statusFilter);

	const todayConfirmed = (reservations as Array<{ status: string }>).filter(
		(r) => r.status === "confirmed",
	).length;
	const totalGuests = (reservations as Array<{ partySize: number }>).reduce(
		(sum, r) => sum + r.partySize,
		0,
	);

	return (
		<div className="space-y-6 p-4 md:p-6">
			{/* Header */}
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="font-bold text-2xl tracking-tight">Reservations</h1>
					<p className="text-muted-foreground text-sm">
						Manage table reservations and bookings
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Input
						type="date"
						value={selectedDate}
						onChange={(e) => setSelectedDate(e.target.value)}
						className="h-9 w-40"
					/>
					<Select value={statusFilter} onValueChange={setStatusFilter}>
						<SelectTrigger className="h-9 w-32">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All</SelectItem>
							<SelectItem value="confirmed">Confirmed</SelectItem>
							<SelectItem value="seated">Seated</SelectItem>
							<SelectItem value="completed">Completed</SelectItem>
							<SelectItem value="cancelled">Cancelled</SelectItem>
							<SelectItem value="no_show">No Show</SelectItem>
						</SelectContent>
					</Select>
					<Dialog open={createOpen} onOpenChange={setCreateOpen}>
						<DialogTrigger asChild>
							<Button>
								<Plus className="mr-1 size-4" /> New Reservation
							</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>New Reservation</DialogTitle>
							</DialogHeader>
							<CreateReservationForm
								tables={tables as Array<{ id: string; name: string }>}
								defaultDate={selectedDate}
								onSubmit={(data) => createMutation.mutate(data)}
								isSubmitting={createMutation.isPending}
							/>
						</DialogContent>
					</Dialog>
				</div>
			</div>

			{/* Summary cards */}
			<div className="grid grid-cols-3 gap-4">
				<Card>
					<CardContent className="flex items-center gap-3 py-4">
						<CalendarDays className="size-8 text-muted-foreground" />
						<div>
							<p className="font-bold text-2xl">{reservations.length}</p>
							<p className="text-muted-foreground text-xs">Total bookings</p>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="flex items-center gap-3 py-4">
						<Clock className="size-8 text-blue-500" />
						<div>
							<p className="font-bold text-2xl">{todayConfirmed}</p>
							<p className="text-muted-foreground text-xs">Upcoming</p>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="flex items-center gap-3 py-4">
						<Users className="size-8 text-green-500" />
						<div>
							<p className="font-bold text-2xl">{totalGuests}</p>
							<p className="text-muted-foreground text-xs">Total guests</p>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Table */}
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
									<TableHead>Time</TableHead>
									<TableHead>Guest</TableHead>
									<TableHead>Phone</TableHead>
									<TableHead className="text-center">Party</TableHead>
									<TableHead>Table</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Notes</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{filtered.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={8}
											className="py-12 text-center text-muted-foreground"
										>
											No reservations for this date
										</TableCell>
									</TableRow>
								) : (
									(filtered as Array<{
										id: string;
										time: string;
										customerName: string;
										customerPhone: string | null;
										partySize: number;
										tableName: string | null;
										status: string;
										notes: string | null;
									}>).map((r) => (
										<TableRow key={r.id}>
											<TableCell className="font-medium">{r.time}</TableCell>
											<TableCell>{r.customerName}</TableCell>
											<TableCell className="text-muted-foreground text-xs">
												{r.customerPhone || "–"}
											</TableCell>
											<TableCell className="text-center">{r.partySize}</TableCell>
											<TableCell>{r.tableName || "–"}</TableCell>
											<TableCell>
												<Badge
													variant="secondary"
													className={STATUS_COLORS[r.status] ?? ""}
												>
													{r.status.replace("_", " ")}
												</Badge>
											</TableCell>
											<TableCell className="max-w-[150px] truncate text-muted-foreground text-xs">
												{r.notes || "–"}
											</TableCell>
											<TableCell className="text-right">
												<div className="flex justify-end gap-1">
													{r.status === "confirmed" && (
														<Button
															variant="outline"
															size="sm"
															onClick={() =>
																updateMutation.mutate({
																	id: r.id,
																	status: "seated",
																})
															}
														>
															<Check className="mr-1 size-3" /> Seat
														</Button>
													)}
													{r.status === "seated" && (
														<Button
															variant="outline"
															size="sm"
															onClick={() =>
																updateMutation.mutate({
																	id: r.id,
																	status: "completed",
																})
															}
														>
															<Check className="mr-1 size-3" /> Done
														</Button>
													)}
													{r.status === "confirmed" && (
														<Button
															variant="ghost"
															size="sm"
															onClick={() =>
																updateMutation.mutate({
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
															if (confirm("Delete this reservation?")) {
																removeMutation.mutate({ id: r.id });
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

// ── Create Form ─────────────────────────────────────────────────────────

function CreateReservationForm({
	tables,
	defaultDate,
	onSubmit,
	isSubmitting,
}: {
	tables: Array<{ id: string; name: string }>;
	defaultDate: string;
	onSubmit: (data: {
		locationId: string;
		customerName: string;
		customerPhone?: string | null;
		customerEmail?: string | null;
		date: string;
		time: string;
		partySize: number;
		tableId?: string | null;
		notes?: string | null;
	}) => void;
	isSubmitting: boolean;
}) {
	const [name, setName] = useState("");
	const [phone, setPhone] = useState("");
	const [email, setEmail] = useState("");
	const [date, setDate] = useState(defaultDate);
	const [time, setTime] = useState("18:00");
	const [partySize, setPartySize] = useState(2);
	const [tableId, setTableId] = useState<string>("");
	const [notes, setNotes] = useState("");

	const { data: locations = [] } = useQuery(
		orpc.locations.listLocations.queryOptions({ input: {} }),
	);
	const locationId = (locations as Array<{ id: string }>)[0]?.id ?? "";

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
				<div className="space-y-1.5">
					<Label>Email (optional)</Label>
					<Input
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						placeholder="email@example.com"
					/>
				</div>
				<div className="grid grid-cols-3 gap-3">
					<div className="space-y-1.5">
						<Label>Date</Label>
						<Input
							type="date"
							value={date}
							onChange={(e) => setDate(e.target.value)}
						/>
					</div>
					<div className="space-y-1.5">
						<Label>Time</Label>
						<Input
							type="time"
							value={time}
							onChange={(e) => setTime(e.target.value)}
						/>
					</div>
					<div className="space-y-1.5">
						<Label>Party Size</Label>
						<Input
							type="number"
							min={1}
							max={50}
							value={partySize}
							onChange={(e) => setPartySize(Number(e.target.value))}
						/>
					</div>
				</div>
				<div className="space-y-1.5">
					<Label>Table (optional)</Label>
					<Select value={tableId} onValueChange={setTableId}>
						<SelectTrigger>
							<SelectValue placeholder="Auto-assign" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="">Auto-assign</SelectItem>
							{tables.map((t) => (
								<SelectItem key={t.id} value={t.id}>
									{t.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-1.5">
					<Label>Notes</Label>
					<Textarea
						value={notes}
						onChange={(e) => setNotes(e.target.value)}
						placeholder="Special requests, allergies..."
						rows={2}
					/>
				</div>
			</div>
			<DialogFooter>
				<Button
					onClick={() =>
						onSubmit({
							locationId,
							customerName: name,
							customerPhone: phone || null,
							customerEmail: email || null,
							date,
							time,
							partySize,
							tableId: tableId || null,
							notes: notes || null,
						})
					}
					disabled={!name.trim() || !locationId || isSubmitting}
				>
					{isSubmitting && <Loader2 className="mr-1 size-4 animate-spin" />}
					Create Reservation
				</Button>
			</DialogFooter>
		</>
	);
}
