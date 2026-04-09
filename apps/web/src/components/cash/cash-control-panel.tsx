import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, DollarSign, Pencil, Printer, Unlock } from "lucide-react";
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
import { printCashSessionReport } from "@/lib/pdf/cash-session-pdf";
import { getOnlineStatus } from "@/lib/offline";
import { formatGYD } from "@/lib/types";
import { orpc } from "@/utils/orpc";

const GYD_DENOMINATIONS = [5000, 2000, 1000, 500, 100, 50, 20] as const;
type DenomMap = Record<number, number>;

interface CashSession {
	id: string;
	registerId: string;
	locationId: string;
	openedBy: string;
	openedAt: Date | string;
	openingFloat: string;
	closedBy: string | null;
	closedAt: Date | string | null;
	closingCount: string | null;
	expectedCash: string | null;
	variance: string | null;
	status: string;
	notes: string | null;
	userName: string | null;
}

interface CashControlPanelProps {
	sessions: CashSession[];
	openSession: CashSession | null;
	locationId: string;
	registerId?: string;
	organizationName?: string;
}

export function CashControlPanel({
	sessions,
	openSession,
	locationId,
	registerId = "c0000000-0000-4000-8000-000000000001",
	organizationName = "Bettencourt's Diner",
}: CashControlPanelProps) {
	const queryClient = useQueryClient();
	const [openShiftDialog, setOpenShiftDialog] = useState(false);
	const [closeShiftDialog, setCloseShiftDialog] = useState(false);
	const [dropDialog, setDropDialog] = useState(false);
	const [payoutDialog, setPayoutDialog] = useState(false);
	const [noSaleDialog, setNoSaleDialog] = useState(false);
	const [editFloatDialog, setEditFloatDialog] = useState(false);
	const [amount, setAmount] = useState("");
	const [reason, setReason] = useState("");
	const [dateFrom, setDateFrom] = useState("");
	const [dateTo, setDateTo] = useState("");
	const [denomCounts, setDenomCounts] = useState<DenomMap>(() =>
		Object.fromEntries(GYD_DENOMINATIONS.map((d) => [d, 0])),
	);

	const totalDenomAmount = Object.entries(denomCounts).reduce(
		(sum, [denom, qty]) => sum + Number(denom) * qty,
		0,
	);

	const invalidateCash = () =>
		queryClient.invalidateQueries({
			queryKey: orpc.cash.getSessions.queryOptions({ input: {} }).queryKey,
		});

	const openShiftMutation = useMutation(
		orpc.cash.openSession.mutationOptions({
			onSuccess: () => {
				setOpenShiftDialog(false);
				setAmount("");
				invalidateCash();
				toast.success("Shift opened");
			},
			onError: (err: unknown) => {
				const orpcErr = err as { code?: string; message?: string };
				if (orpcErr?.code === "CONFLICT") {
					toast.error(
						"A shift is already open for this register. Please close the existing shift first.",
					);
				} else {
					toast.error(
						(orpcErr?.message as string) || "Failed to open shift",
					);
				}
			},
		}),
	);

	const closeShiftMutation = useMutation(
		orpc.cash.closeSession.mutationOptions({
			onSuccess: () => {
				setCloseShiftDialog(false);
				setDenomCounts(Object.fromEntries(GYD_DENOMINATIONS.map((d) => [d, 0])));
				invalidateCash();
				toast.success("Shift closed");
			},
			onError: (err: unknown) => {
				const orpcErr = err as { message?: string };
				toast.error(orpcErr?.message || "Failed to close shift");
			},
		}),
	);

	const dropMutation = useMutation(
		orpc.cash.createDrop.mutationOptions({
			onSuccess: () => {
				setDropDialog(false);
				setAmount("");
				setReason("");
				invalidateCash();
				toast.success("Cash drop recorded");
			},
			onError: (err: Error) => {
				toast.error(err.message || "Failed to record drop");
			},
		}),
	);

	const payoutMutation = useMutation(
		orpc.cash.createPayout.mutationOptions({
			onSuccess: () => {
				setPayoutDialog(false);
				setAmount("");
				setReason("");
				invalidateCash();
				toast.success("Payout recorded");
			},
			onError: (err: Error) => {
				toast.error(err.message || "Failed to record payout");
			},
		}),
	);

	const noSaleMutation = useMutation(
		orpc.cash.logNoSale.mutationOptions({
			onSuccess: () => {
				setNoSaleDialog(false);
				setReason("");
				invalidateCash();
				toast.success("No-sale event recorded");
			},
			onError: (err: Error) => {
				toast.error(err.message || "Failed to log no-sale");
			},
		}),
	);

	const updateSessionMutation = useMutation(
		orpc.cash.updateSession.mutationOptions({
			onSuccess: () => {
				setEditFloatDialog(false);
				setAmount("");
				invalidateCash();
				toast.success("Opening float updated");
			},
			onError: (err: Error) => {
				toast.error(err.message || "Failed to update float");
			},
		}),
	);

	function requireOnline(action: string): boolean {
		if (!getOnlineStatus()) {
			toast.error(`Cannot ${action} while offline — connect to the network first.`);
			return false;
		}
		return true;
	}

	function handleOpenShift() {
		if (!requireOnline("open shift")) return;
		openShiftMutation.mutate({
			openingFloat: String(Number(amount) || 0),
			locationId,
			registerId,
		});
	}

	function handleEditFloat() {
		if (!openSession || !requireOnline("update float")) return;
		updateSessionMutation.mutate({
			sessionId: openSession.id,
			openingFloat: String(Number(amount) || 0),
		});
	}

	function handleCloseShift() {
		if (!openSession || !requireOnline("close shift")) return;
		closeShiftMutation.mutate({
			sessionId: openSession.id,
			actualCash: String(totalDenomAmount),
			expectedCash: openSession.expectedCash || openSession.openingFloat,
		});
	}

	function handleDrop() {
		if (!openSession || !requireOnline("record cash drop")) return;
		dropMutation.mutate({
			cashSessionId: openSession.id,
			amount: String(Number(amount)),
			reason: reason || null,
		});
	}

	function handlePayout() {
		if (!openSession || !requireOnline("record payout")) return;
		payoutMutation.mutate({
			cashSessionId: openSession.id,
			amount: String(Number(amount)),
			reason,
		});
	}

	function handleNoSale() {
		if (!openSession || !requireOnline("log no-sale")) return;
		noSaleMutation.mutate({
			cashSessionId: openSession.id,
			reason: reason || "No reason provided",
		});
	}

	const isLoading =
		openShiftMutation.isPending ||
		closeShiftMutation.isPending ||
		dropMutation.isPending ||
		payoutMutation.isPending ||
		noSaleMutation.isPending ||
		updateSessionMutation.isPending;

	return (
		<div className="flex flex-col gap-6">
			<Card>
				<CardHeader className="flex flex-row items-center justify-between">
					<CardTitle className="flex items-center gap-2">
						<DollarSign className="size-5" />
						Current Shift
					</CardTitle>
					{openSession ? (
						<Badge>Open</Badge>
					) : (
						<Badge variant="secondary">Closed</Badge>
					)}
				</CardHeader>
				<CardContent>
					{openSession ? (
						<div className="flex flex-col gap-4">
							<div className="grid gap-4 sm:grid-cols-3">
								<div>
									<p className="text-muted-foreground text-sm">Opened by</p>
									<p className="font-medium">
										{openSession.userName || "Unknown"}
									</p>
								</div>
								<div>
									<div className="flex items-center gap-2">
										<p className="text-muted-foreground text-sm">Opening Float</p>
										<Button
											variant="ghost"
											size="sm"
											className="h-5 w-5 p-0"
											onClick={() => {
												setAmount("");
												setEditFloatDialog(true);
											}}
										>
											<Pencil className="size-3" />
										</Button>
									</div>
									<p className="font-medium font-mono">
										{formatGYD(Number(openSession.openingFloat))}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground text-sm">Expected Cash</p>
									<p className="font-medium font-mono">
										{formatGYD(
											Number(
												openSession.expectedCash || openSession.openingFloat,
											),
										)}
									</p>
								</div>
							</div>
							<div className="flex flex-wrap gap-2">
								<Button variant="outline" onClick={() => setDropDialog(true)}>
									<ArrowDown className="mr-2 size-4" />
									Cash Drop
								</Button>
								<Button variant="outline" onClick={() => setPayoutDialog(true)}>
									<ArrowUp className="mr-2 size-4" />
									Payout
								</Button>
								<Button
									variant="outline"
									onClick={() => {
										setReason("");
										setNoSaleDialog(true);
									}}
								>
									<Unlock className="mr-2 size-4" />
									No Sale
								</Button>
								<Button
									variant="destructive"
									onClick={() => {
										setAmount("");
										setCloseShiftDialog(true);
									}}
								>
									Close Shift
								</Button>
							</div>
						</div>
					) : (
						<div className="flex flex-col items-center gap-4 py-8">
							<p className="text-muted-foreground">
								No shift is currently open
							</p>
							<Button onClick={() => setOpenShiftDialog(true)}>
								Open Shift
							</Button>
						</div>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Shift History</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="mb-4 flex flex-wrap items-center gap-2">
						<Input
							type="date"
							aria-label="From date"
							value={dateFrom}
							onChange={(e) => setDateFrom(e.target.value)}
							className="w-auto"
						/>
						<span className="text-muted-foreground text-sm">to</span>
						<Input
							type="date"
							aria-label="To date"
							value={dateTo}
							onChange={(e) => setDateTo(e.target.value)}
							className="w-auto"
						/>
						{(dateFrom || dateTo) && (
							<Button
								variant="ghost"
								size="sm"
								onClick={() => {
									setDateFrom("");
									setDateTo("");
								}}
							>
								Clear
							</Button>
						)}
					</div>
					<div className="rounded-lg border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Opened By</TableHead>
									<TableHead>Float</TableHead>
									<TableHead>Expected</TableHead>
									<TableHead>Actual</TableHead>
									<TableHead>Variance</TableHead>
									<TableHead>Status</TableHead>
									<TableHead></TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{sessions
									.filter((s) => {
										if (!dateFrom && !dateTo) return true;
										const sessionDate = new Date(s.openedAt);
										if (dateFrom) {
											const from = new Date(`${dateFrom}T00:00:00`);
											if (sessionDate < from) return false;
										}
										if (dateTo) {
											const to = new Date(`${dateTo}T23:59:59`);
											if (sessionDate > to) return false;
										}
										return true;
									})
									.map((s) => (
										<TableRow key={s.id}>
											<TableCell className="text-sm">
												{s.userName || "Unknown"}
											</TableCell>
											<TableCell className="font-mono text-sm">
												{formatGYD(Number(s.openingFloat))}
											</TableCell>
											<TableCell className="font-mono text-sm">
												{s.expectedCash
													? formatGYD(Number(s.expectedCash))
													: "-"}
											</TableCell>
											<TableCell className="font-mono text-sm">
												{s.closingCount
													? formatGYD(Number(s.closingCount))
													: "-"}
											</TableCell>
											<TableCell className="font-mono text-sm">
												{s.variance != null ? (
													<span
														className={
															Number(s.variance) < 0
																? "text-destructive"
																: "text-foreground"
														}
													>
														{formatGYD(Number(s.variance))}
													</span>
												) : (
													"-"
												)}
											</TableCell>
											<TableCell>
												<Badge
													variant={
														s.status === "open" ? "default" : "secondary"
													}
												>
													{s.status}
												</Badge>
											</TableCell>
											<TableCell>
												{s.status === "closed" && (
													<Button
														size="sm"
														variant="ghost"
														className="gap-1 text-xs"
														onClick={() =>
															printCashSessionReport({
																session: s,
																organizationName,
															})
														}
													>
														<Printer className="size-3" />
														Report
													</Button>
												)}
											</TableCell>
										</TableRow>
									))}
							</TableBody>
						</Table>
					</div>
				</CardContent>
			</Card>

			{/* Dialogs */}
			<Dialog open={openShiftDialog} onOpenChange={setOpenShiftDialog}>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle>Open Shift</DialogTitle>
					</DialogHeader>
					<div className="flex flex-col gap-3 py-2">
						<Label>Opening Float Amount (GYD)</Label>
						<Input
							type="number"
							step="1"
							value={amount}
							onChange={(e) => setAmount(e.target.value)}
							placeholder="0"
							className="h-11 text-base"
						/>
					</div>
					<DialogFooter>
						<Button onClick={handleOpenShift} disabled={isLoading}>
							{isLoading ? "Opening..." : "Open Shift"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={closeShiftDialog}
				onOpenChange={(open) => {
					if (!open) {
						setDenomCounts(Object.fromEntries(GYD_DENOMINATIONS.map((d) => [d, 0])));
					}
					setCloseShiftDialog(open);
				}}
			>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>Close Shift</DialogTitle>
					</DialogHeader>
					<div className="flex flex-col gap-3 py-2">
						<Label>Cash Count by Denomination</Label>
						<div className="rounded-md border">
							<table className="w-full text-sm">
								<thead>
									<tr className="border-b bg-muted/50">
										<th className="px-3 py-2 text-left font-medium">Denomination</th>
										<th className="px-3 py-2 text-center font-medium">Qty</th>
										<th className="px-3 py-2 text-right font-medium">Subtotal</th>
									</tr>
								</thead>
								<tbody>
									{GYD_DENOMINATIONS.map((denom) => (
										<tr key={denom} className="border-b last:border-0">
											<td className="px-3 py-2 font-medium">
												GYD {denom.toLocaleString()}
											</td>
											<td className="px-3 py-2">
												<Input
													type="number"
													min={0}
													className="mx-auto h-8 w-20 text-center"
													value={denomCounts[denom] || ""}
													placeholder="0"
													onChange={(e) => {
														const qty = Math.max(0, parseInt(e.target.value) || 0);
														setDenomCounts((prev) => ({ ...prev, [denom]: qty }));
													}}
												/>
											</td>
											<td className="px-3 py-2 text-right tabular-nums">
												{(denom * (denomCounts[denom] || 0)).toLocaleString()}
											</td>
										</tr>
									))}
								</tbody>
								<tfoot>
									<tr className="bg-muted/50 font-semibold">
										<td className="px-3 py-2" colSpan={2}>Total Cash Count</td>
										<td className="px-3 py-2 text-right tabular-nums">
											GYD {totalDenomAmount.toLocaleString()}
										</td>
									</tr>
								</tfoot>
							</table>
						</div>
					</div>
					<DialogFooter>
						<Button
							variant="destructive"
							onClick={handleCloseShift}
							disabled={isLoading}
						>
							{isLoading ? "Closing..." : "Close Shift"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={dropDialog} onOpenChange={setDropDialog}>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle>Cash Drop</DialogTitle>
					</DialogHeader>
					<div className="flex flex-col gap-3 py-2">
						<Label>Amount (GYD)</Label>
						<Input
							type="number"
							step="1"
							value={amount}
							onChange={(e) => setAmount(e.target.value)}
							className="h-11 text-base"
						/>
						<Label>Reason (optional)</Label>
						<Input
							value={reason}
							onChange={(e) => setReason(e.target.value)}
							className="h-11 text-base"
						/>
					</div>
					<DialogFooter>
						<Button onClick={handleDrop} disabled={isLoading}>
							Record Drop
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={payoutDialog} onOpenChange={setPayoutDialog}>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle>Cash Payout</DialogTitle>
					</DialogHeader>
					<div className="flex flex-col gap-3 py-2">
						<Label>Amount (GYD)</Label>
						<Input
							type="number"
							step="1"
							value={amount}
							onChange={(e) => setAmount(e.target.value)}
							className="h-11 text-base"
						/>
						<Label>Reason</Label>
						<Input
							value={reason}
							onChange={(e) => setReason(e.target.value)}
							className="h-11 text-base"
						/>
					</div>
					<DialogFooter>
						<Button onClick={handlePayout} disabled={isLoading}>
							Record Payout
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={noSaleDialog} onOpenChange={setNoSaleDialog}>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle>No Sale / Open Drawer</DialogTitle>
					</DialogHeader>
					<p className="text-muted-foreground text-sm">
						Record a drawer-open event without a transaction.
					</p>
					<div className="flex flex-col gap-3 py-2">
						<Label>Reason (optional)</Label>
						<Input
							value={reason}
							onChange={(e) => setReason(e.target.value)}
							placeholder="e.g. manager request, coin change"
							className="h-11 text-base"
						/>
					</div>
					<DialogFooter>
						<Button onClick={handleNoSale} disabled={isLoading}>
							{isLoading ? "Logging..." : "Log No Sale"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={editFloatDialog} onOpenChange={setEditFloatDialog}>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle>Edit Opening Float</DialogTitle>
					</DialogHeader>
					<div className="flex flex-col gap-3 py-2">
						<Label>New Opening Float Amount (GYD)</Label>
						<Input
							type="number"
							step="1"
							value={amount}
							onChange={(e) => setAmount(e.target.value)}
							placeholder={openSession?.openingFloat ?? "0"}
							className="h-11 text-base"
						/>
					</div>
					<DialogFooter>
						<Button onClick={handleEditFloat} disabled={isLoading}>
							{isLoading ? "Saving..." : "Save"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
