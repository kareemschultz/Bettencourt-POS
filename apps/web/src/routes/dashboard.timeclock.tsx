import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Download, LogIn, LogOut, Timer, Users } from "lucide-react";
import { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { todayGY } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

function formatDuration(ms: number) {
	const totalMins = Math.floor(ms / 60000);
	const hours = Math.floor(totalMins / 60);
	const mins = totalMins % 60;
	return `${hours}h ${mins}m`;
}

function LiveTimer({ clockIn }: { clockIn: string | Date }) {
	const [now, setNow] = useState(Date.now());

	useEffect(() => {
		const interval = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(interval);
	}, []);

	const elapsed = now - new Date(clockIn).getTime();
	const hours = Math.floor(elapsed / 3600000);
	const mins = Math.floor((elapsed % 3600000) / 60000);
	const secs = Math.floor((elapsed % 60000) / 1000);

	return (
		<span className="font-bold font-mono text-4xl text-foreground tabular-nums">
			{String(hours).padStart(2, "0")}:{String(mins).padStart(2, "0")}:
			{String(secs).padStart(2, "0")}
		</span>
	);
}

export default function TimeclockPage() {
	const queryClient = useQueryClient();
	const today = todayGY();
	const [dateRange, setDateRange] = useState({ start: today, end: today });
	const [employeeSearch, setEmployeeSearch] = useState("");

	const { data: activeShift, isLoading: loadingShift } = useQuery({
		...orpc.timeclock.getActiveShift.queryOptions({ input: {} }),
		refetchInterval: 30000,
	});

	const { data: todayShifts = [] } = useQuery(
		orpc.timeclock.getShifts.queryOptions({
			input: { startDate: today, endDate: today },
		}),
	);

	const { data: summary = [] } = useQuery(
		orpc.timeclock.getSummary.queryOptions({
			input: { startDate: dateRange.start, endDate: dateRange.end },
		}),
	);

	const shiftQueryKey = orpc.timeclock.getActiveShift.queryOptions({
		input: {},
	}).queryKey;
	const todayQueryKey = orpc.timeclock.getShifts.queryOptions({
		input: { startDate: today, endDate: today },
	}).queryKey;
	const summaryQueryKey = orpc.timeclock.getSummary.queryOptions({
		input: { startDate: dateRange.start, endDate: dateRange.end },
	}).queryKey;

	const clockInMut = useMutation(
		orpc.timeclock.clockIn.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: shiftQueryKey });
				queryClient.invalidateQueries({ queryKey: todayQueryKey });
				toast.success("Clocked in!");
			},
			onError: (err) => toast.error(err.message || "Failed to clock in"),
		}),
	);

	const clockOutMut = useMutation(
		orpc.timeclock.clockOut.mutationOptions({
			onSuccess: (data) => {
				queryClient.invalidateQueries({ queryKey: shiftQueryKey });
				queryClient.invalidateQueries({ queryKey: todayQueryKey });
				queryClient.invalidateQueries({ queryKey: summaryQueryKey });
				toast.success(`Clocked out! Shift duration: ${data.duration} hours`);
			},
			onError: (err) => toast.error(err.message || "Failed to clock out"),
		}),
	);

	const isClockedIn = !!activeShift;

	function exportCSV() {
		const headers =
			"Employee,Shifts,Total Hours,Break Hours,Net Hours,Overtime\n";
		const rows = (summary as Array<Record<string, unknown>>)
			.map(
				(s) =>
					`"${s.userName}",${s.shiftCount},${s.totalHours},${s.breakHours},${s.netHours},${s.overtime}`,
			)
			.join("\n");
		const blob = new Blob([headers + rows], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `timeclock-${dateRange.start}-to-${dateRange.end}.csv`;
		a.click();
	}

	return (
		<div className="flex flex-col gap-6 p-4 md:p-6">
			<div>
				<h1 className="flex items-center gap-2 font-bold text-2xl text-foreground tracking-tight">
					<Clock className="size-6 text-primary" /> Time Clock
				</h1>
				<p className="text-muted-foreground text-sm">
					Clock in and out, view today's shifts, and review hours summaries.
					Export timesheets for payroll.
				</p>
			</div>

			<Tabs defaultValue="clock">
				<TabsList>
					<TabsTrigger value="clock" className="gap-1.5">
						<Timer className="size-3.5" /> My Shift
					</TabsTrigger>
					<TabsTrigger value="today" className="gap-1.5">
						<Clock className="size-3.5" /> Today
					</TabsTrigger>
					<TabsTrigger value="summary" className="gap-1.5">
						<Users className="size-3.5" /> Summary
					</TabsTrigger>
				</TabsList>

				{/* Clock In/Out Tab */}
				<TabsContent value="clock" className="mt-4">
					<Card>
						<CardContent className="flex flex-col items-center gap-6 py-12">
							{loadingShift ? (
								<p className="text-muted-foreground">Loading...</p>
							) : isClockedIn ? (
								<>
									<Badge className="bg-emerald-600 px-4 py-1 text-sm text-white">
										Clocked In
									</Badge>
									<LiveTimer clockIn={activeShift.clockIn} />
									<p className="text-muted-foreground text-sm">
										Since{" "}
										{new Date(activeShift.clockIn).toLocaleTimeString([], {
											hour: "2-digit",
											minute: "2-digit",
										})}
									</p>
									<Button
										size="lg"
										variant="destructive"
										className="gap-2 px-12 py-6 text-lg"
										onClick={() => clockOutMut.mutate({})}
										disabled={clockOutMut.isPending}
									>
										<LogOut className="size-5" />
										Clock Out
									</Button>
								</>
							) : (
								<>
									<Badge variant="secondary" className="px-4 py-1 text-sm">
										Not Clocked In
									</Badge>
									<Clock className="size-16 text-muted-foreground/30" />
									<Button
										size="lg"
										className="gap-2 bg-emerald-600 px-12 py-6 text-lg text-white hover:bg-emerald-700"
										onClick={() => clockInMut.mutate({})}
										disabled={clockInMut.isPending}
									>
										<LogIn className="size-5" />
										Clock In
									</Button>
								</>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				{/* Today's Shifts Tab */}
				<TabsContent value="today" className="mt-4">
					<Card>
						<CardHeader>
							<CardTitle>Today's Shifts</CardTitle>
							<CardDescription>
								{(todayShifts as unknown[]).length} shift
								{(todayShifts as unknown[]).length !== 1 ? "s" : ""} today
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="mb-4">
								<Input
									placeholder="Search by employee name..."
									value={employeeSearch}
									onChange={(e) => setEmployeeSearch(e.target.value)}
									className="max-w-sm"
								/>
							</div>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Employee</TableHead>
										<TableHead>Clock In</TableHead>
										<TableHead>Clock Out</TableHead>
										<TableHead>Duration</TableHead>
										<TableHead>Status</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{(() => {
										const filtered = (
											todayShifts as Array<Record<string, unknown>>
										).filter(
											(shift) =>
												!employeeSearch ||
												String(shift.user_name || "")
													.toLowerCase()
													.includes(employeeSearch.toLowerCase()),
										);
										if (filtered.length === 0)
											return (
												<TableRow>
													<TableCell
														colSpan={5}
														className="py-8 text-center text-muted-foreground"
													>
														{employeeSearch
															? "No matching employees"
															: "No shifts today"}
													</TableCell>
												</TableRow>
											);
										return filtered.map((shift) => {
											const clockInTime = new Date(shift.clock_in as string);
											const clockOutTime = shift.clock_out
												? new Date(shift.clock_out as string)
												: null;
											const duration = clockOutTime
												? formatDuration(
														clockOutTime.getTime() - clockInTime.getTime(),
													)
												: "In progress";
											return (
												<TableRow key={shift.id as string}>
													<TableCell className="font-medium">
														{String(shift.user_name || "Unknown")}
													</TableCell>
													<TableCell className="font-mono text-sm">
														{clockInTime.toLocaleTimeString([], {
															hour: "2-digit",
															minute: "2-digit",
														})}
													</TableCell>
													<TableCell className="font-mono text-sm">
														{clockOutTime
															? clockOutTime.toLocaleTimeString([], {
																	hour: "2-digit",
																	minute: "2-digit",
																})
															: "—"}
													</TableCell>
													<TableCell className="font-mono text-sm">
														{duration}
													</TableCell>
													<TableCell>
														<Badge
															variant={
																shift.clock_out ? "secondary" : "default"
															}
														>
															{shift.clock_out ? "Completed" : "Active"}
														</Badge>
													</TableCell>
												</TableRow>
											);
										});
									})()}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Summary Tab */}
				<TabsContent value="summary" className="mt-4">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between">
							<div>
								<CardTitle>Hours Summary</CardTitle>
								<CardDescription>
									Total hours per employee for the date range.
								</CardDescription>
							</div>
							<div className="flex items-center gap-2">
								<Input
									type="date"
									aria-label="Start date"
									value={dateRange.start}
									onChange={(e) =>
										setDateRange((prev) => ({ ...prev, start: e.target.value }))
									}
									className="w-auto"
								/>
								<span className="text-muted-foreground">to</span>
								<Input
									type="date"
									aria-label="End date"
									value={dateRange.end}
									onChange={(e) =>
										setDateRange((prev) => ({ ...prev, end: e.target.value }))
									}
									className="w-auto"
								/>
								<Button
									variant="outline"
									size="sm"
									className="gap-1.5"
									onClick={exportCSV}
								>
									<Download className="size-3.5" /> Export
								</Button>
							</div>
						</CardHeader>
						<CardContent>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Employee</TableHead>
										<TableHead className="text-right">Shifts</TableHead>
										<TableHead className="text-right">Total Hours</TableHead>
										<TableHead className="text-right">Break Hours</TableHead>
										<TableHead className="text-right">Net Hours</TableHead>
										<TableHead className="text-right">Overtime</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{(summary as unknown[]).length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={6}
												className="py-8 text-center text-muted-foreground"
											>
												No data for selected range
											</TableCell>
										</TableRow>
									) : (
										(summary as Array<Record<string, unknown>>).map((row) => (
											<TableRow key={row.userId as string}>
												<TableCell className="font-medium">
													{String(row.userName)}
												</TableCell>
												<TableCell className="text-right font-mono">
													{String(row.shiftCount)}
												</TableCell>
												<TableCell className="text-right font-mono">
													{String(row.totalHours)}
												</TableCell>
												<TableCell className="text-right font-mono">
													{String(row.breakHours)}
												</TableCell>
												<TableCell className="text-right font-mono">
													{String(row.netHours)}
												</TableCell>
												<TableCell className="text-right font-mono">
													{Number(row.overtime) > 0 ? (
														<span className="font-bold text-amber-600">
															{String(row.overtime)}
														</span>
													) : (
														String(row.overtime)
													)}
												</TableCell>
											</TableRow>
										))
									)}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
