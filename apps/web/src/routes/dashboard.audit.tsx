import { useQuery } from "@tanstack/react-query";
import { Download, Eye, Shield } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
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
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { orpc } from "@/utils/orpc";

const actionColors: Record<
	string,
	"default" | "secondary" | "destructive" | "outline"
> = {
	create: "default",
	update: "secondary",
	delete: "destructive",
	login: "outline",
	logout: "outline",
	void: "destructive",
	refund: "destructive",
	open_session: "default",
	close_session: "secondary",
};

export default function AuditLogPage() {
	const [entityType, setEntityType] = useState("");
	const [action, setAction] = useState("");
	const [startDate, setStartDate] = useState("");
	const [endDate, setEndDate] = useState("");
	const [page, setPage] = useState(1);
	const [_selectedLog, setSelectedLog] = useState<Record<
		string,
		unknown
	> | null>(null);

	const { data, isLoading } = useQuery(
		orpc.audit.list.queryOptions({
			input: {
				entityType: entityType || undefined,
				actionType: action || undefined,
				startDate: startDate || undefined,
				endDate: endDate || undefined,
				page,
			},
		}),
	);

	const logs = data?.logs || [];
	const total = data?.total || 0;

	function exportCSV() {
		const headers = "Timestamp,User,Action,Entity Type,Entity ID,Details\n";
		const rows = logs
			.map(
				(l) =>
					`"${new Date(l.createdAt as unknown as string).toISOString()}","${l.userName || l.userNameSnapshot || ""}","${l.actionType}","${l.entityType}","${l.entityId || ""}","${JSON.stringify(l.beforeData || {}).replace(/"/g, '""')}"`,
			)
			.join("\n");
		const blob = new Blob([headers + rows], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `audit-log-${new Date().toISOString().split("T")[0]}.csv`;
		a.click();
	}

	return (
		<div className="flex flex-col gap-6 p-4 md:p-6">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="flex items-center gap-2 font-bold text-2xl text-foreground tracking-tight">
						<Shield className="h-6 w-6" /> Audit Log
					</h1>
					<p className="text-muted-foreground">
						Complete history of all system actions with JSON diff tracking.
					</p>
				</div>
				<Button variant="outline" size="sm" onClick={exportCSV}>
					<Download className="mr-2 h-4 w-4" /> Export CSV
				</Button>
			</div>

			<Card>
				<CardContent className="p-4">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-end">
						<div className="flex flex-1 flex-col gap-1.5">
							<Label className="text-xs">Entity Type</Label>
							<Select
								value={entityType || "all"}
								onValueChange={(v) => {
									setEntityType(v === "all" ? "" : v);
									setPage(1);
								}}
							>
								<SelectTrigger className="h-9">
									<SelectValue placeholder="All types" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Types</SelectItem>
									<SelectItem value="order">Order</SelectItem>
									<SelectItem value="product">Product</SelectItem>
									<SelectItem value="inventory">Inventory</SelectItem>
									<SelectItem value="cash_session">Cash Session</SelectItem>
									<SelectItem value="user">User</SelectItem>
									<SelectItem value="setting">Setting</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="flex flex-1 flex-col gap-1.5">
							<Label className="text-xs">Action</Label>
							<Select
								value={action || "all"}
								onValueChange={(v) => {
									setAction(v === "all" ? "" : v);
									setPage(1);
								}}
							>
								<SelectTrigger className="h-9">
									<SelectValue placeholder="All actions" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Actions</SelectItem>
									<SelectItem value="create">Create</SelectItem>
									<SelectItem value="update">Update</SelectItem>
									<SelectItem value="delete">Delete</SelectItem>
									<SelectItem value="void">Void</SelectItem>
									<SelectItem value="refund">Refund</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label className="text-xs">Start Date</Label>
							<Input
								type="date"
								className="h-9"
								value={startDate}
								onChange={(e) => {
									setStartDate(e.target.value);
									setPage(1);
								}}
							/>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label className="text-xs">End Date</Label>
							<Input
								type="date"
								className="h-9"
								value={endDate}
								onChange={(e) => {
									setEndDate(e.target.value);
									setPage(1);
								}}
							/>
						</div>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardContent className="p-0">
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Timestamp</TableHead>
									<TableHead>User</TableHead>
									<TableHead>Action</TableHead>
									<TableHead>Entity</TableHead>
									<TableHead>Details</TableHead>
									<TableHead className="text-right">Diff</TableHead>
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
								) : logs.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={6}
											className="py-8 text-center text-muted-foreground"
										>
											No audit entries found
										</TableCell>
									</TableRow>
								) : (
									logs.map((log) => (
										<TableRow key={log.id}>
											<TableCell className="whitespace-nowrap font-mono text-muted-foreground text-xs">
												{log.createdAt
													? new Date(
															log.createdAt as unknown as string,
														).toLocaleString()
													: ""}
											</TableCell>
											<TableCell className="text-foreground">
												{log.userName || log.userNameSnapshot || "System"}
											</TableCell>
											<TableCell>
												<Badge
													variant={actionColors[log.actionType] || "secondary"}
												>
													{log.actionType}
												</Badge>
											</TableCell>
											<TableCell>
												<span className="text-muted-foreground">
													{log.entityType}
												</span>
												{log.entityId && (
													<span className="block max-w-[120px] truncate font-mono text-muted-foreground text-xs">
														{log.entityId.slice(0, 8)}...
													</span>
												)}
											</TableCell>
											<TableCell className="max-w-[200px] truncate text-muted-foreground text-sm">
												{log.reason || "---"}
											</TableCell>
											<TableCell className="text-right">
												{(log.beforeData != null || log.afterData != null) && (
													<Dialog>
														<DialogTrigger asChild>
															<Button
																variant="ghost"
																size="icon"
																className="h-7 w-7"
																onClick={() =>
																	setSelectedLog(
																		log as unknown as Record<string, unknown>,
																	)
																}
															>
																<Eye className="h-4 w-4" />
																<span className="sr-only">
																	View change details
																</span>
															</Button>
														</DialogTrigger>
														<DialogContent className="max-w-lg">
															<DialogHeader>
																<DialogTitle>Change Details</DialogTitle>
															</DialogHeader>
															<div className="flex max-h-96 flex-col gap-4 overflow-auto">
																{log.beforeData != null && (
																	<div>
																		<h4 className="mb-1 font-medium text-muted-foreground text-sm">
																			Previous Values
																		</h4>
																		<pre className="overflow-auto rounded-md bg-destructive/5 p-3 text-destructive text-xs">
																			{JSON.stringify(log.beforeData, null, 2)}
																		</pre>
																	</div>
																)}
																{log.afterData != null && (
																	<div>
																		<h4 className="mb-1 font-medium text-muted-foreground text-sm">
																			New Values
																		</h4>
																		<pre className="overflow-auto rounded-md bg-emerald-500/5 p-3 text-emerald-600 text-xs">
																			{JSON.stringify(log.afterData, null, 2)}
																		</pre>
																	</div>
																)}
															</div>
														</DialogContent>
													</Dialog>
												)}
											</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</div>
				</CardContent>
			</Card>

			{total > 50 && (
				<div className="flex items-center justify-between">
					<p className="text-muted-foreground text-sm">
						Showing {(page - 1) * 50 + 1}-{Math.min(page * 50, Number(total))}{" "}
						of {String(total)}
					</p>
					<div className="flex gap-2">
						<Button
							variant="outline"
							size="sm"
							disabled={page <= 1}
							onClick={() => setPage((p) => p - 1)}
						>
							Previous
						</Button>
						<Button
							variant="outline"
							size="sm"
							disabled={page * 50 >= Number(total)}
							onClick={() => setPage((p) => p + 1)}
						>
							Next
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
