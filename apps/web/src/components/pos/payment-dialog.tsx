import { useMutation } from "@tanstack/react-query";
import {
	ArrowLeft,
	Banknote,
	Check,
	CreditCard,
	Delete,
	FileText,
	Gift,
	Loader2,
	Search,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CartItem } from "@/lib/types";
import { formatGYD } from "@/lib/types";
import { orpc } from "@/utils/orpc";

interface PaymentDialogProps {
	open: boolean;
	total: number;
	items: CartItem[];
	onClose: () => void;
	initialCashAmount?: number;
	onComplete: (
		payments: {
			method: "cash" | "card" | "mobile_money" | "gift_card" | "credit";
			amount: number;
			reference?: string;
		}[],
		meta?: { tipAmount?: number },
	) => Promise<void>;
}

type PaymentStep =
	| "method"
	| "cash"
	| "split_cash"
	| "gift_card"
	| "credit"
	| "complete";

export function PaymentDialog({
	open,
	total,
	items: _items,
	onClose,
	initialCashAmount,
	onComplete,
}: PaymentDialogProps) {
	const [step, setStep] = useState<PaymentStep>("method");
	const [cashTendered, setCashTendered] = useState("");
	const [splitCashAmount, setSplitCashAmount] = useState("");
	const [processing, setProcessing] = useState(false);
	const [change, setChange] = useState(0);

	// Gift card state
	const [giftCardCode, setGiftCardCode] = useState("");
	const [giftCardData, setGiftCardData] = useState<{
		id: string;
		code: string;
		currentBalance: string;
		isActive: boolean;
	} | null>(null);
	const [_giftCardApplied, setGiftCardApplied] = useState(false);

	useEffect(() => {
		if (!open) {
			setStep("method");
			setCashTendered("");
			setSplitCashAmount("");
			setProcessing(false);
			setChange(0);
			setGiftCardCode("");
			setGiftCardData(null);
			setGiftCardApplied(false);
		} else if (initialCashAmount != null && initialCashAmount > 0) {
			setStep("cash");
			setCashTendered(String(Math.ceil(initialCashAmount)));
		}
	}, [open, initialCashAmount]);

	const lookupGiftCard = useMutation(
		orpc.giftcards.lookup.mutationOptions({
			onSuccess: (data) => {
				if (!data.isActive) {
					toast.error("This gift card is inactive");
					setGiftCardData(null);
					return;
				}
				if (Number(data.currentBalance) <= 0) {
					toast.error("This gift card has no remaining balance");
					setGiftCardData(null);
					return;
				}
				setGiftCardData({
					id: data.id,
					code: data.code,
					currentBalance: data.currentBalance,
					isActive: data.isActive,
				});
			},
			onError: (error) => {
				toast.error(error.message || "Gift card not found");
				setGiftCardData(null);
			},
		}),
	);

	function reset() {
		setStep("method");
		setCashTendered("");
		setSplitCashAmount("");
		setProcessing(false);
		setChange(0);
		setGiftCardCode("");
		setGiftCardData(null);
		setGiftCardApplied(false);
	}

	const tipAmount = 0;
	const totalWithTip = total;

	async function handleCashPayment(tenderedOverride?: number) {
		const tendered = tenderedOverride ?? (Number(cashTendered) || totalWithTip);
		setProcessing(true);
		try {
			await onComplete([{ method: "cash", amount: tendered }], { tipAmount });
			setChange(tendered - totalWithTip);
			setStep("complete");
		} catch {
			setProcessing(false);
		}
	}

	async function handleCardPayment() {
		setProcessing(true);
		try {
			await onComplete(
				[
					{
						method: "card",
						amount: totalWithTip,
						reference: `CARD-${Date.now()}`,
					},
				],
				{ tipAmount },
			);
			setStep("complete");
		} catch {
			setProcessing(false);
		}
	}

	async function handleSplitPayment() {
		const cashPart = Number(splitCashAmount) || 0;
		if (cashPart <= 0 || cashPart >= totalWithTip) return;
		const cardPart = totalWithTip - cashPart;
		setProcessing(true);
		try {
			await onComplete(
				[
					{ method: "cash", amount: cashPart },
					{
						method: "card",
						amount: cardPart,
						reference: `SPLIT-CARD-${Date.now()}`,
					},
				],
				{ tipAmount },
			);
			setChange(0);
			setStep("complete");
		} catch {
			setProcessing(false);
		}
	}

	const giftCardBalance = giftCardData
		? Number(giftCardData.currentBalance)
		: 0;
	const giftCardPayAmount = Math.min(giftCardBalance, totalWithTip);
	const giftCardRemaining = totalWithTip - giftCardPayAmount;

	async function handleGiftCardFullPayment() {
		if (!giftCardData || giftCardPayAmount <= 0) return;
		setProcessing(true);
		try {
			if (giftCardRemaining <= 0) {
				// Gift card covers full amount
				await onComplete(
					[
						{
							method: "gift_card",
							amount: totalWithTip,
							reference: giftCardData.code,
						},
					],
					{ tipAmount },
				);
			} else {
				// Gift card partially covers — remainder on card
				await onComplete(
					[
						{
							method: "gift_card",
							amount: giftCardPayAmount,
							reference: giftCardData.code,
						},
						{
							method: "card",
							amount: giftCardRemaining,
							reference: `GC-SPLIT-CARD-${Date.now()}`,
						},
					],
					{ tipAmount },
				);
			}
			setChange(0);
			setStep("complete");
		} catch {
			setProcessing(false);
		}
	}

	async function handleGiftCardCashSplit() {
		if (!giftCardData || giftCardPayAmount <= 0) return;
		setProcessing(true);
		try {
			// Gift card portion + cash for the rest
			await onComplete(
				[
					{
						method: "gift_card",
						amount: giftCardPayAmount,
						reference: giftCardData.code,
					},
					{ method: "cash", amount: giftCardRemaining },
				],
				{ tipAmount },
			);
			setChange(0);
			setStep("complete");
		} catch {
			setProcessing(false);
		}
	}

	async function handleCreditPayment() {
		setProcessing(true);
		try {
			await onComplete([{ method: "credit", amount: totalWithTip }], {
				tipAmount,
			});
			setStep("complete");
		} catch {
			setProcessing(false);
		}
	}

	// GYD denominations (notes only, largest first)
	const GYD_NOTES = [5000, 2000, 1000, 500, 100, 50, 20];

	function calcDenominations(
		amount: number,
	): { denom: number; count: number }[] {
		const result: { denom: number; count: number }[] = [];
		let remaining = Math.round(amount);
		for (const denom of GYD_NOTES) {
			if (remaining >= denom) {
				const count = Math.floor(remaining / denom);
				result.push({ denom, count });
				remaining -= count * denom;
			}
		}
		return result;
	}

	// Quick tender amounts: next round-up to each GYD note boundary above total
	const quickCashAmounts = Array.from(
		new Set(
			GYD_NOTES.slice()
				.reverse()
				.map((d) => Math.ceil(totalWithTip / d) * d)
				.filter((v) => v >= totalWithTip),
		),
	)
		.sort((a, b) => a - b)
		.slice(0, 4);

	const splitCashNum = Number(splitCashAmount) || 0;
	const splitCardRemaining = Math.max(0, totalWithTip - splitCashNum);

	return (
		<Dialog
			open={open}
			onOpenChange={(o) => {
				if (!o) {
					reset();
					onClose();
				}
			}}
		>
			<DialogContent
				aria-describedby={undefined}
				className="max-w-[calc(100vw-2rem)] rounded-xl sm:max-w-sm"
			>
				<DialogHeader>
					<DialogTitle className="text-center text-lg">
						{step === "complete"
							? "Payment Complete"
							: `Payment - ${formatGYD(totalWithTip)}`}
					</DialogTitle>
				</DialogHeader>

				{step === "method" && (
					<div className="flex flex-col gap-3 py-4">
						<div className="flex flex-col gap-1.5">
							<Button
								className="flex h-16 touch-manipulation items-center justify-start gap-3 px-5 sm:h-14"
								onClick={() => handleCashPayment()}
								disabled={processing}
							>
								<Banknote className="size-6 shrink-0 sm:size-5" />
								<div className="text-left">
									<span className="font-medium text-base">
										{processing ? "Processing..." : "Cash — Exact"}
									</span>
									<span className="block text-xs opacity-75">
										{formatGYD(totalWithTip)}
									</span>
								</div>
							</Button>
							{quickCashAmounts.filter((a) => a > totalWithTip).length > 0 && (
								<div className="grid grid-cols-4 gap-1.5">
									{quickCashAmounts
										.filter((a) => a > totalWithTip)
										.map((amt) => (
											<Button
												key={amt}
												variant="outline"
												className="h-10 touch-manipulation px-1 font-medium text-xs"
												disabled={processing}
												onClick={() => handleCashPayment(amt)}
											>
												{formatGYD(amt)}
											</Button>
										))}
								</div>
							)}
							<button
								type="button"
								className="self-end pr-1 text-muted-foreground text-xs underline-offset-2 hover:text-foreground hover:underline"
								onClick={() => setStep("cash")}
							>
								Custom amount →
							</button>
						</div>
						<Button
							variant="outline"
							className="flex h-16 touch-manipulation items-center justify-start gap-3 px-5 sm:h-14"
							onClick={handleCardPayment}
							disabled={processing}
						>
							<CreditCard className="size-6 shrink-0 sm:size-5" />
							<div className="text-left">
								<span className="font-medium text-base">
									{processing ? "Processing..." : "Card"}
								</span>
								<span className="block text-muted-foreground text-xs">
									Full card payment
								</span>
							</div>
						</Button>

						<Button
							variant="outline"
							className="flex h-16 touch-manipulation items-center justify-start gap-3 px-5 sm:h-14"
							onClick={() => setStep("gift_card")}
						>
							<Gift className="size-6 shrink-0 sm:size-5" />
							<div className="text-left">
								<span className="font-medium text-base">Gift Card</span>
								<span className="block text-muted-foreground text-xs">
									Pay with gift card balance
								</span>
							</div>
						</Button>
						<Button
							variant="outline"
							className="flex h-16 touch-manipulation items-center justify-start gap-3 px-5 sm:h-14"
							onClick={() => setStep("credit")}
						>
							<FileText className="size-6 shrink-0 sm:size-5" />
							<div className="text-left">
								<span className="font-medium text-base">Credit / Invoice</span>
								<span className="block text-muted-foreground text-xs">
									Record as credit, auto-create invoice
								</span>
							</div>
						</Button>
					</div>
				)}

				{step === "cash" &&
					(() => {
						const tendered = Number(cashTendered) || totalWithTip;
						const changeAmt = tendered - totalWithTip;
						const breakdown =
							tendered >= totalWithTip ? calcDenominations(changeAmt) : [];

						function padDigit(d: string) {
							if (cashTendered === "0" || cashTendered === "") {
								setCashTendered(d);
							} else {
								setCashTendered((prev) => prev + d);
							}
						}
						function backspace() {
							setCashTendered((prev) =>
								prev.length <= 1 ? "" : prev.slice(0, -1),
							);
						}

						return (
							<div className="flex flex-col gap-3 py-1">
								{/* Due + Tendered display */}
								<div className="grid grid-cols-2 gap-2 text-center">
									<div className="rounded-lg bg-muted/50 p-2">
										<p className="text-muted-foreground text-xs">Due</p>
										<p className="font-bold text-lg">
											{formatGYD(totalWithTip)}
										</p>
									</div>
									<div
										className={`rounded-lg p-2 ${tendered >= totalWithTip ? "bg-green-50 dark:bg-green-950/30" : "bg-primary/5"}`}
									>
										<p className="text-muted-foreground text-xs">Tendered</p>
										<p
											className={`font-bold text-lg ${tendered >= totalWithTip ? "text-green-700 dark:text-green-400" : ""}`}
										>
											{tendered > 0 ? formatGYD(tendered) : "—"}
										</p>
									</div>
								</div>

								{/* Quick denomination buttons */}
								<div className="grid grid-cols-4 gap-1.5">
									{quickCashAmounts.map((amt) => (
										<Button
											key={amt}
											variant="outline"
											className="h-10 touch-manipulation px-1 font-medium text-xs"
											onClick={() => setCashTendered(String(amt))}
										>
											{formatGYD(amt)}
										</Button>
									))}
								</div>

								{/* On-screen numpad */}
								<div className="grid grid-cols-3 gap-1.5">
									{["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
										<Button
											key={d}
											variant="outline"
											className="h-12 touch-manipulation font-semibold text-lg"
											onClick={() => padDigit(d)}
										>
											{d}
										</Button>
									))}
									<Button
										variant="outline"
										className="h-12 touch-manipulation text-muted-foreground text-sm"
										onClick={() => setCashTendered("")}
									>
										C
									</Button>
									<Button
										variant="outline"
										className="h-12 touch-manipulation font-semibold text-lg"
										onClick={() => padDigit("0")}
									>
										0
									</Button>
									<Button
										variant="outline"
										className="h-12 touch-manipulation"
										onClick={backspace}
										disabled={!cashTendered}
									>
										<Delete className="size-4" />
									</Button>
								</div>

								{/* Change breakdown */}
								{tendered >= totalWithTip && (
									<div className="rounded-lg border border-green-200 bg-green-50 p-2.5 dark:border-green-800 dark:bg-green-950/30">
										<p className="mb-1.5 text-center font-bold text-green-700 text-lg dark:text-green-400">
											Change: {formatGYD(changeAmt)}
										</p>
										{breakdown.length > 0 && (
											<div className="flex flex-wrap justify-center gap-1.5">
												{breakdown.map(({ denom, count }) => (
													<span
														key={denom}
														className="rounded-md bg-green-100 px-2 py-1 font-medium text-green-800 text-xs dark:bg-green-900/50 dark:text-green-300"
													>
														{count > 1 ? `${count}×` : ""}
														{formatGYD(denom)}
													</span>
												))}
											</div>
										)}
									</div>
								)}

								<div className="flex gap-2">
									<Button
										variant="outline"
										className="h-12 flex-1 touch-manipulation"
										onClick={() => setStep("method")}
									>
										<ArrowLeft className="mr-1.5 size-4" /> Back
									</Button>
									<Button
										className="h-12 flex-1 touch-manipulation font-bold text-base"
										onClick={() => handleCashPayment()}
										disabled={processing || tendered < totalWithTip}
									>
										{processing ? "Processing..." : "Complete"}
									</Button>
								</div>
							</div>
						);
					})()}

				{step === "split_cash" && (
					<div className="flex flex-col gap-4 py-2">
						<div className="text-center">
							<p className="text-muted-foreground text-sm">Total Due</p>
							<p className="font-bold text-2xl">{formatGYD(totalWithTip)}</p>
						</div>
						<div className="flex flex-col gap-2">
							<Label>Cash Portion (GYD)</Label>
							<Input
								type="number"
								inputMode="numeric"
								step="100"
								value={splitCashAmount}
								onChange={(e) => setSplitCashAmount(e.target.value)}
								placeholder="Enter cash amount"
								className="h-14 touch-manipulation text-center text-2xl"
								autoFocus
							/>
						</div>
						<div className="rounded-lg bg-muted/50 p-3">
							<div className="flex justify-between text-sm">
								<span className="flex items-center gap-1.5 text-muted-foreground">
									<Banknote className="size-3.5" /> Cash
								</span>
								<span className="font-medium">{formatGYD(splitCashNum)}</span>
							</div>
							<div className="mt-1 flex justify-between text-sm">
								<span className="flex items-center gap-1.5 text-muted-foreground">
									<CreditCard className="size-3.5" /> Card
								</span>
								<span className="font-medium">
									{formatGYD(splitCardRemaining)}
								</span>
							</div>
						</div>
						<div className="flex gap-2">
							<Button
								variant="outline"
								className="h-12 flex-1 touch-manipulation"
								onClick={() => setStep("method")}
							>
								<ArrowLeft className="mr-1.5 size-4" /> Back
							</Button>
							<Button
								className="h-12 flex-1 touch-manipulation font-bold text-base"
								onClick={handleSplitPayment}
								disabled={
									processing ||
									splitCashNum <= 0 ||
									splitCashNum >= totalWithTip
								}
							>
								{processing ? "Processing..." : "Complete Split"}
							</Button>
						</div>
					</div>
				)}

				{step === "gift_card" && (
					<div className="flex flex-col gap-4 py-2">
						<div className="text-center">
							<p className="text-muted-foreground text-sm">Amount Due</p>
							<p className="font-bold text-2xl">{formatGYD(totalWithTip)}</p>
						</div>
						<div className="flex flex-col gap-2">
							<Label htmlFor="gc-code">Gift Card Code</Label>
							<div className="flex gap-2">
								<Input
									id="gc-code"
									value={giftCardCode}
									onChange={(e) => {
										setGiftCardCode(e.target.value.toUpperCase());
										setGiftCardData(null);
									}}
									placeholder="GC-XXXX-XXXX"
									className="h-12 flex-1 touch-manipulation text-center font-mono text-lg uppercase tracking-wider"
									autoFocus
								/>
								<Button
									variant="outline"
									className="h-12 touch-manipulation gap-1.5 px-4"
									onClick={() => lookupGiftCard.mutate({ code: giftCardCode })}
									disabled={giftCardCode.length < 3 || lookupGiftCard.isPending}
								>
									{lookupGiftCard.isPending ? (
										<Loader2 className="size-4 animate-spin" />
									) : (
										<Search className="size-4" />
									)}
									Look Up
								</Button>
							</div>
						</div>

						{giftCardData && (
							<div className="rounded-lg border border-border bg-muted/50 p-3">
								<div className="flex items-center justify-between">
									<span className="font-medium text-sm">
										{giftCardData.code}
									</span>
									<span className="font-bold text-green-600 text-sm dark:text-green-400">
										Balance: {formatGYD(giftCardBalance)}
									</span>
								</div>
								<div className="mt-2 space-y-1 text-sm">
									<div className="flex justify-between">
										<span className="text-muted-foreground">
											Gift card pays
										</span>
										<span className="font-medium">
											{formatGYD(giftCardPayAmount)}
										</span>
									</div>
									{giftCardRemaining > 0 && (
										<div className="flex justify-between text-amber-600 dark:text-amber-400">
											<span>Remaining to pay</span>
											<span className="font-medium">
												{formatGYD(giftCardRemaining)}
											</span>
										</div>
									)}
								</div>

								<div className="mt-3 flex flex-col gap-2">
									{giftCardRemaining <= 0 ? (
										<Button
											className="h-12 w-full touch-manipulation font-bold text-base"
											onClick={handleGiftCardFullPayment}
											disabled={processing}
										>
											{processing
												? "Processing..."
												: `Pay ${formatGYD(totalWithTip)} with Gift Card`}
										</Button>
									) : (
										<>
											<Button
												className="h-11 w-full touch-manipulation font-bold"
												onClick={handleGiftCardFullPayment}
												disabled={processing}
											>
												{processing
													? "Processing..."
													: `Gift Card + Card (${formatGYD(giftCardRemaining)} on card)`}
											</Button>
											<Button
												variant="outline"
												className="h-11 w-full touch-manipulation font-bold"
												onClick={handleGiftCardCashSplit}
												disabled={processing}
											>
												{processing
													? "Processing..."
													: `Gift Card + Cash (${formatGYD(giftCardRemaining)} cash)`}
											</Button>
										</>
									)}
								</div>
							</div>
						)}

						<Button
							variant="outline"
							className="h-12 touch-manipulation"
							onClick={() => {
								setStep("method");
								setGiftCardCode("");
								setGiftCardData(null);
							}}
						>
							<ArrowLeft className="mr-1.5 size-4" /> Back
						</Button>
					</div>
				)}

				{step === "credit" && (
					<div className="flex flex-col gap-4 py-2">
						<div className="text-center">
							<p className="text-muted-foreground text-sm">Amount Due</p>
							<p className="font-bold text-3xl sm:text-2xl">
								{formatGYD(totalWithTip)}
							</p>
						</div>
						<div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800 text-sm dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
							<p className="mb-1 font-medium">Credit Sale</p>
							<p className="text-xs">
								This order will be recorded as credit. A draft invoice will be
								auto-created. Petty cash will be used to balance the till for
								the day.
							</p>
						</div>
						<div className="flex gap-2">
							<Button
								variant="outline"
								className="h-12 flex-1 touch-manipulation"
								onClick={() => setStep("method")}
							>
								<ArrowLeft className="mr-1.5 size-4" /> Back
							</Button>
							<Button
								className="h-12 flex-1 touch-manipulation font-bold text-base"
								onClick={handleCreditPayment}
								disabled={processing}
							>
								{processing ? "Processing..." : "Confirm / Complete"}
							</Button>
						</div>
					</div>
				)}

				{step === "complete" && (
					<div className="flex flex-col items-center gap-4 py-6 sm:py-8">
						<div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
							<Check className="size-8 text-green-600 dark:text-green-400" />
						</div>
						<p className="font-bold text-foreground text-lg">
							Payment Successful
						</p>
						{change > 0 &&
							(() => {
								const breakdown = calcDenominations(change);
								return (
									<div className="w-full rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/30">
										<p className="mb-3 text-center font-bold text-3xl text-green-700 sm:text-2xl dark:text-green-400">
											Change: {formatGYD(change)}
										</p>
										{breakdown.length > 0 && (
											<div className="flex flex-wrap justify-center gap-2">
												{breakdown.map(({ denom, count }) => (
													<span
														key={denom}
														className="rounded-lg bg-green-100 px-3 py-1.5 font-semibold text-base text-green-800 dark:bg-green-900/50 dark:text-green-300"
													>
														{count > 1 ? `${count}×` : ""}
														{formatGYD(denom)}
													</span>
												))}
											</div>
										)}
									</div>
								);
							})()}
						<Button
							className="mt-2 h-14 w-full touch-manipulation text-base sm:h-12"
							onClick={() => {
								reset();
								onClose();
							}}
						>
							New Order
						</Button>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
