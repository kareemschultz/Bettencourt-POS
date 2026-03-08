import { useMutation } from "@tanstack/react-query";
import { Check, Copy, Gift } from "lucide-react";
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
import { formatGYD } from "@/lib/types";
import { orpc } from "@/utils/orpc";

interface SellGiftCardDialogProps {
	open: boolean;
	onClose: () => void;
	onComplete: (
		payments: {
			method: "cash" | "card" | "mobile_money" | "gift_card" | "credit";
			amount: number;
			reference?: string;
		}[],
	) => Promise<void>;
}

const QUICK_AMOUNTS = [1000, 2000, 5000, 10000];

type Step = "amount" | "payment" | "success";

export function SellGiftCardDialog({
	open,
	onClose,
	onComplete,
}: SellGiftCardDialogProps) {
	const [step, setStep] = useState<Step>("amount");
	const [amount, setAmount] = useState("");
	const [generatedCode, setGeneratedCode] = useState("");
	const [copied, setCopied] = useState(false);
	const [processing, setProcessing] = useState(false);

	const numericAmount = Number(amount) || 0;

	const createGiftCard = useMutation(
		orpc.giftcards.create.mutationOptions({
			onSuccess: (card) => {
				setGeneratedCode(card.code);
				setStep("payment");
			},
			onError: (error) => {
				toast.error(error.message || "Failed to create gift card");
			},
		}),
	);

	function handleCreateCard() {
		if (numericAmount < 100) {
			toast.error("Minimum gift card amount is $100 GYD");
			return;
		}
		createGiftCard.mutate({ initialBalance: numericAmount });
	}

	async function handleCashPayment() {
		setProcessing(true);
		try {
			await onComplete([
				{
					method: "cash",
					amount: numericAmount,
					reference: `GIFTCARD-${generatedCode}`,
				},
			]);
			setStep("success");
		} catch {
			setProcessing(false);
		}
	}

	async function handleCardPayment() {
		setProcessing(true);
		try {
			await onComplete([
				{
					method: "card",
					amount: numericAmount,
					reference: `GIFTCARD-${generatedCode}`,
				},
			]);
			setStep("success");
		} catch {
			setProcessing(false);
		}
	}

	function handleCopyCode() {
		navigator.clipboard.writeText(generatedCode);
		setCopied(true);
		toast.success("Gift card code copied!");
		setTimeout(() => setCopied(false), 2000);
	}

	function reset() {
		setStep("amount");
		setAmount("");
		setGeneratedCode("");
		setCopied(false);
		setProcessing(false);
	}

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
					<DialogTitle className="flex items-center justify-center gap-2 text-lg">
						<Gift className="size-5" />
						{step === "success" ? "Gift Card Sold" : "Sell Gift Card"}
					</DialogTitle>
				</DialogHeader>

				{step === "amount" && (
					<div className="flex flex-col gap-4 py-2">
						<div className="flex flex-col gap-2">
							<Label>Gift Card Amount (GYD)</Label>
							<Input
								type="number"
								inputMode="numeric"
								step="100"
								min="100"
								value={amount}
								onChange={(e) => setAmount(e.target.value)}
								placeholder="Enter amount"
								className="h-14 touch-manipulation text-center text-2xl"
								autoFocus
							/>
						</div>
						<div className="grid grid-cols-2 gap-2">
							{QUICK_AMOUNTS.map((amt) => (
								<Button
									key={amt}
									variant="outline"
									className="h-11 touch-manipulation text-base"
									onClick={() => setAmount(String(amt))}
								>
									{formatGYD(amt)}
								</Button>
							))}
						</div>
						{numericAmount > 0 && numericAmount < 100 && (
							<p className="text-center text-destructive text-xs">
								Minimum amount is {formatGYD(100)}
							</p>
						)}
						<Button
							className="h-12 touch-manipulation font-bold text-base"
							onClick={handleCreateCard}
							disabled={numericAmount < 100 || createGiftCard.isPending}
						>
							{createGiftCard.isPending
								? "Creating..."
								: `Create ${formatGYD(numericAmount)} Gift Card`}
						</Button>
					</div>
				)}

				{step === "payment" && (
					<div className="flex flex-col gap-4 py-2">
						<div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
							<p className="text-muted-foreground text-xs">Gift Card Code</p>
							<div className="mt-1 flex items-center justify-center gap-2">
								<p className="font-bold font-mono text-2xl tracking-wider">
									{generatedCode}
								</p>
								<Button
									variant="ghost"
									size="icon"
									className="size-8"
									onClick={handleCopyCode}
								>
									{copied ? (
										<Check className="size-4 text-green-600" />
									) : (
										<Copy className="size-4" />
									)}
									<span className="sr-only">Copy code</span>
								</Button>
							</div>
							<p className="mt-2 font-semibold text-lg">
								{formatGYD(numericAmount)}
							</p>
						</div>
						<p className="text-center text-muted-foreground text-sm">
							Collect payment for the gift card
						</p>
						<div className="flex flex-col gap-2">
							<Button
								className="h-12 touch-manipulation font-bold text-base"
								onClick={handleCashPayment}
								disabled={processing}
							>
								{processing ? "Processing..." : "Cash Payment"}
							</Button>
							<Button
								variant="outline"
								className="h-12 touch-manipulation font-bold text-base"
								onClick={handleCardPayment}
								disabled={processing}
							>
								{processing ? "Processing..." : "Card Payment"}
							</Button>
						</div>
					</div>
				)}

				{step === "success" && (
					<div className="flex flex-col items-center gap-4 py-6">
						<div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
							<Check className="size-8 text-green-600 dark:text-green-400" />
						</div>
						<p className="font-bold text-lg">Gift Card Sold!</p>
						<div className="rounded-lg border border-border bg-muted/50 p-3 text-center">
							<p className="text-muted-foreground text-xs">Code</p>
							<p className="font-bold font-mono text-xl tracking-wider">
								{generatedCode}
							</p>
							<p className="mt-1 font-medium text-sm">
								{formatGYD(numericAmount)}
							</p>
						</div>
						<Button
							variant="ghost"
							size="sm"
							className="gap-1.5"
							onClick={handleCopyCode}
						>
							{copied ? (
								<Check className="size-3.5 text-green-600" />
							) : (
								<Copy className="size-3.5" />
							)}
							{copied ? "Copied!" : "Copy Code"}
						</Button>
						<Button
							className="mt-2 h-12 w-full touch-manipulation text-base"
							onClick={() => {
								reset();
								onClose();
							}}
						>
							Done
						</Button>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
