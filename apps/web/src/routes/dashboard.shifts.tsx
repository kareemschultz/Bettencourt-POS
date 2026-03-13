import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Clock, Loader2, Plus, Trash2, Users } from "lucide-react";
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
import { orpc } from "@/utils/orpc";

const DAYS = [
	"monday",
	"tuesday",
	"wednesday",
	"thursday",
	"friday",
	"saturday",
	"sunday",
] as const;

const DAY_LABELS: Record<string, string> = {
	monday: "Mon",
	tuesday: "Tue",
	wednesday: "Wed",
	thursday: "Thu",
	friday: "Fri",
	saturday: "Sat",
	sunday: "Sun",
};

const DAY_COLORS: Record<string, string> = {
	monday: "bg-blue-100 text-blue-800",
	tuesday: "bg-green-100 text-green-800",
	wednesday: "bg-yellow-100 text-yellow-800",
	thursday: "bg-purple-100 text-purple-800",
	friday: "bg-orange-100 text-orange-800",
	saturday: "bg-red-100 text-red-800",
	sunday: "bg-gray-100 text-gray-800",
};

type ShiftRow = {
	id: string;
	userId: string;
	userName: string;
	dayOfWeek: string;
	startTime: string;
	endTime: string;
	notes: string | null;
	isActive: string;
};

export default function ShiftsPage() {
	const qc = useQueryClient();
	const [createOpen, setCreateOpen] = useState(false);
	const [filterDay, setFilterDay] = useState("all");

	const queryKey = orpc.shifts.list.queryOptions({ input: {} }).queryKey;

	const { data: shifts = [], isLoading } = useQuery(
		orpc.shifts.list.queryOptions({ input: {} }),
	);

	const { data: settings } = useQuery(
		orpc.settings.getTeam.queryOptions({ input: {} }),
	);
	const team = (settings ?? []) as Array<{
		id: string;
		name: string;
		role: string;
	}>;

	const createMut = useMutation(
		orpc.shifts.create.mutationOptions({
			onSuccess: () => {
				qc.invalidateQueries({ queryKey });
				setCreateOpen(false);
				toast.success("Shift created");
			},
		}),
	);

	const removeMut = useMutation(
		orpc.shifts.remove.mutationOptions({
			onSuccess: () => {
				qc.invalidateQueries({ queryKey });
				toast.success("Shift removed");
			},
		}),
	);

	const rows = (shifts as ShiftRow[]).filter(
		(s) => filterDay === "all" || s.dayOfWeek === filterDay,
	);

	// Group by employee for summary
	const employeeMap = new Map<string, number>();
	for (const s of shifts as ShiftRow[]) {
		employeeMap.set(s.userName, (employeeMap.get(s.userName) ?? 0) + 1);
	}

	return (
		<div className="space-y-6 p-4 md:p-6">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="font-bold text-2xl tracking-tight">Shift Schedule</h1>
					<p className="text-muted-foreground text-sm">
						Manage weekly employee shifts
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Select value={filterDay} onValueChange={setFilterDay}>
						<SelectTrigger className="h-9 w-32">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Days</SelectItem>
							{DAYS.map((d) => (
								<SelectItem key={d} value={d}>
									{d.charAt(0).toUpperCase() + d.slice(1)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Dialog open={createOpen} onOpenChange={setCreateOpen}>
						<DialogTrigger asChild>
							<Button>
								<Plus className="mr-1 size-4" /> Add Shift
							</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Add Shift</DialogTitle>
							</DialogHeader>
							<CreateShiftForm
								team={team}
								onSubmit={(data) => createMut.mutate(data)}
								isSubmitting={createMut.isPending}
							/>
						</DialogContent>
					</Dialog>
				</div>
			</div>

			{/* Summary */}
			<div className="grid grid-cols-3 gap-4">
				<Card>
					<CardContent className="flex items-center gap-3 py-4">
						<Calendar className="size-8 text-muted-foreground" />
						<div>
							<p className="font-bold text-2xl">
								{(shifts as ShiftRow[]).length}
							</p>
							<p className="text-muted-foreground text-xs">Total shifts</p>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="flex items-center gap-3 py-4">
						<Users className="size-8 text-blue-500" />
						<div>
							<p className="font-bold text-2xl">{employeeMap.size}</p>
							<p className="text-muted-foreground text-xs">
								Employees scheduled
							</p>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="flex items-center gap-3 py-4">
						<Clock className="size-8 text-green-500" />
						<div>
							<p className="font-bold text-2xl">
								{new Set((shifts as ShiftRow[]).map((s) => s.dayOfWeek)).size}
							</p>
							<p className="text-muted-foreground text-xs">Days covered</p>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Schedule Table */}
			{isLoading ? (
				<div className="flex justify-center py-12">
					<Loader2 className="size-8 animate-spin text-muted-foreground" />
				</div>
			) : (
				<Card>
					<CardHeader>
						<CardTitle className="text-base">Weekly Schedule</CardTitle>
					</CardHeader>
					<CardContent className="p-0">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Day</TableHead>
									<TableHead>Employee</TableHead>
									<TableHead>Start</TableHead>
									<TableHead>End</TableHead>
									<TableHead>Notes</TableHead>
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
											No shifts scheduled
										</TableCell>
									</TableRow>
								) : (
									rows.map((s) => (
										<TableRow key={s.id}>
											<TableCell>
												<Badge
													variant="secondary"
													className={DAY_COLORS[s.dayOfWeek] ?? ""}
												>
													{DAY_LABELS[s.dayOfWeek] ?? s.dayOfWeek}
												</Badge>
											</TableCell>
											<TableCell className="font-medium">
												{s.userName}
											</TableCell>
											<TableCell className="font-mono text-sm">
												{s.startTime}
											</TableCell>
											<TableCell className="font-mono text-sm">
												{s.endTime}
											</TableCell>
											<TableCell className="max-w-[150px] truncate text-muted-foreground text-xs">
												{s.notes || "–"}
											</TableCell>
											<TableCell className="text-right">
												<Button
													variant="ghost"
													size="sm"
													onClick={() => {
														if (confirm("Remove this shift?")) {
															removeMut.mutate({
																id: s.id,
															});
														}
													}}
												>
													<Trash2 className="size-3 text-destructive" />
												</Button>
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

function CreateShiftForm({
	team,
	onSubmit,
	isSubmitting,
}: {
	team: Array<{ id: string; name: string }>;
	onSubmit: (data: {
		userId: string;
		dayOfWeek: (typeof DAYS)[number];
		startTime: string;
		endTime: string;
		notes?: string | null;
	}) => void;
	isSubmitting: boolean;
}) {
	const [userId, setUserId] = useState("");
	const [day, setDay] = useState<string>("monday");
	const [start, setStart] = useState("09:00");
	const [end, setEnd] = useState("17:00");
	const [notes, setNotes] = useState("");

	return (
		<>
			<div className="space-y-4 py-4">
				<div className="space-y-1.5">
					<Label>Employee</Label>
					<Select value={userId} onValueChange={setUserId}>
						<SelectTrigger>
							<SelectValue placeholder="Select employee" />
						</SelectTrigger>
						<SelectContent>
							{team.map((u) => (
								<SelectItem key={u.id} value={u.id}>
									{u.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-1.5">
					<Label>Day of Week</Label>
					<Select value={day} onValueChange={setDay}>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{DAYS.map((d) => (
								<SelectItem key={d} value={d}>
									{d.charAt(0).toUpperCase() + d.slice(1)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="grid grid-cols-2 gap-3">
					<div className="space-y-1.5">
						<Label>Start Time</Label>
						<Input
							type="time"
							value={start}
							onChange={(e) => setStart(e.target.value)}
						/>
					</div>
					<div className="space-y-1.5">
						<Label>End Time</Label>
						<Input
							type="time"
							value={end}
							onChange={(e) => setEnd(e.target.value)}
						/>
					</div>
				</div>
				<div className="space-y-1.5">
					<Label>Notes (optional)</Label>
					<Input
						value={notes}
						onChange={(e) => setNotes(e.target.value)}
						placeholder="e.g. Opening shift"
					/>
				</div>
			</div>
			<DialogFooter>
				<Button
					onClick={() =>
						onSubmit({
							userId,
							dayOfWeek: day as (typeof DAYS)[number],
							startTime: start,
							endTime: end,
							notes: notes || null,
						})
					}
					disabled={!userId || isSubmitting}
				>
					{isSubmitting && <Loader2 className="mr-1 size-4 animate-spin" />}
					Create Shift
				</Button>
			</DialogFooter>
		</>
	);
}
