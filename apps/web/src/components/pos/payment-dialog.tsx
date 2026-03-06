import { useMutation } from "@tanstack/react-query";
import {
	ArrowLeft,
	Banknote,
	Check,
	CreditCard,
	Gift,
	Loader2,
	Search,
	Split,
} from "lucide-react";
import { useState } from "react";
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
	onComplete: (
		payments: { method: string; amount: number; reference?: string }[],
	) => Promise<void>;
}

type PaymentStep = "method" | "cash" | "split_cash" | "gift_card" | "complete";

export function PaymentDialog({
	open,
	total,
	items,
	onClose,
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

	async function handleCashPayment() {
		const tendered = Number(cashTendered) || 0;
		if (tendered < total) return;
		setProcessing(true);
		try {
			await onComplete([{ method: "cash", amount: tendered }]);
			setChange(tendered - total);
			setStep("complete");
		} catch {
			setProcessing(false);
		}
	}

	async function handleCardPayment() {
		setProcessing(true);
		try {
			await onComplete([
				{ method: "card", amount: total, reference: `CARD-${Date.now()}` },
			]);
			setStep("complete");
		} catch {
			setProcessing(false);
		}
	}

	async function handleSplitPayment() {
		const cashPart = Number(splitCashAmount) || 0;
		if (cashPart <= 0 || cashPart >= total) return;
		const cardPart = total - cashPart;
		setProcessing(true);
		try {
			await onComplete([
				{ method: "cash", amount: cashPart },
				{
					method: "card",
					amount: cardPart,
					reference: `SPLIT-CARD-${Date.now()}`,
				},
			]);
			setChange(0);
			setStep("complete");
		} catch {
			setProcessing(false);
		}
	}

	const giftCardBalance = giftCardData
		? Number(giftCardData.currentBalance)
		: 0;
	const giftCardPayAmount = Math.min(giftCardBalance, total);
	const giftCardRemaining = total - giftCardPayAmount;

	async function handleGiftCardFullPayment() {
		if (!giftCardData || giftCardPayAmount <= 0) return;
		setProcessing(true);
		try {
			if (giftCardRemaining <= 0) {
				// Gift card covers full amount
				await onComplete([
					{ method: "gift_card", amount: total, reference: giftCardData.code },
				]);
			} else {
				// Gift card partially covers — remainder on card
				await onComplete([
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
				]);
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
			await onComplete([
				{
					method: "gift_card",
					amount: giftCardPayAmount,
					reference: giftCardData.code,
				},
				{ method: "cash", amount: giftCardRemaining },
			]);
			setChange(0);
			setStep("complete");
		} catch {
			setProcessing(false);
		}
	}

	// GYD quick amounts
	const quickCashAmounts = [
		Math.ceil(total / 100) * 100,
		Math.ceil(total / 500) * 500,
		Math.ceil(total / 1000) * 1000,
		Math.ceil(total / 5000) * 5000,
	].filter((v, i, a) => a.indexOf(v) === i && v >= total);

	const splitCashNum = Number(splitCashAmount) || 0;
	const splitCardRemaining = Math.max(0, total - splitCashNum);

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
			<DialogContent className="max-w-[calc(100vw-2rem)] rounded-xl sm:max-w-sm">
				<DialogHeader>
					<DialogTitle className="text-center text-lg">
						{step === "complete"
							? "Payment Complete"
							: `Payment - ${formatGYD(total)}`}
					</DialogTitle>
				</DialogHeader>

				{step === "method" && (
					<div className="flex flex-col gap-3 py-4">
						<Button
							variant="outline"
							className="flex h-16 touch-manipulation items-center justify-start gap-3 px-5 sm:h-14"
							onClick={() => setStep("cash")}
						>
							<Banknote className="size-6 shrink-0 sm:size-5" />
							<div className="text-left">
								<span className="font-medium text-base">Cash</span>
								<span className="block text-muted-foreground text-xs">
									Full cash payment
								</span>
							</div>
						</Button>
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
							onClick={() => setStep("split_cash")}
						>
							<Split className="size-6 shrink-0 sm:size-5" />
							<div className="text-left">
								<span className="font-medium text-base">Split Payment</span>
								<span className="block text-muted-foreground text-xs">
									Part cash + part card
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
					</div>
				)}

				{step === "cash" && (
					<div className="flex flex-col gap-4 py-2">
						<div className="text-center">
							<p className="text-muted-foreground text-sm">Amount Due</p>
							<p className="font-bold text-3xl sm:text-2xl">
								{formatGYD(total)}
							</p>
						</div>
						<div className="flex flex-col gap-2">
							<Label htmlFor="cash-amount">Cash Tendered (GYD)</Label>
							<Input
								id="cash-amount"
								type="number"
								inputMode="numeric"
								step="100"
								value={cashTendered}
								onChange={(e) => setCashTendered(e.target.value)}
								placeholder="0"
								className="h-16 touch-manipulation text-center text-3xl sm:h-14 sm:text-2xl"
								autoFocus
							/>
						</div>
						<div className="grid grid-cols-2 gap-2">
							{quickCashAmounts.map((amt) => (
								<Button
									key={amt}
									variant="outline"
									className="h-12 touch-manipulation text-base sm:h-11 sm:text-sm"
									onClick={() => setCashTendered(String(amt))}
								>
									{formatGYD(amt)}
								</Button>
							))}
						</div>
						{Number(cashTendered) >= total && (
							<p className="text-center font-semibold text-green-600 text-xl sm:text-lg dark:text-green-400">
								Change: {formatGYD(Number(cashTendered) - total)}
							</p>
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
								onClick={handleCashPayment}
								disabled={processing || Number(cashTendered) < total}
							>
								{processing ? "Processing..." : "Complete"}
							</Button>
						</div>
					</div>
				)}

				{step === "split_cash" && (
					<div className="flex flex-col gap-4 py-2">
						<div className="text-center">
							<p className="text-muted-foreground text-sm">Total Due</p>
							<p className="font-bold text-2xl">{formatGYD(total)}</p>
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
									processing || splitCashNum <= 0 || splitCashNum >= total
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
							<p className="font-bold text-2xl">{formatGYD(total)}</p>
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
												: `Pay ${formatGYD(total)} with Gift Card`}
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

				{step === "complete" && (
					<div className="flex flex-col items-center gap-4 py-6 sm:py-8">
						<div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
							<Check className="size-8 text-green-600 dark:text-green-400" />
						</div>
						<p className="font-bold text-foreground text-lg">
							Payment Successful
						</p>
						{change > 0 && (
							<p className="font-bold text-3xl text-green-600 sm:text-2xl dark:text-green-400">
								Change: {formatGYD(change)}
							</p>
						)}
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
