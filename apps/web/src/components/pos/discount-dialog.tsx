import { DollarSign, Percent } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatGYD } from "@/lib/types";

interface DiscountDialogProps {
	open: boolean;
	onClose: () => void;
	subtotal: number;
	onApply: (amount: number, label: string) => void;
}

export function DiscountDialog({
	open,
	onClose,
	subtotal,
	onApply,
}: DiscountDialogProps) {
	const [mode, setMode] = useState<"percent" | "fixed">("percent");
	const [value, setValue] = useState("");
	const [reason, setReason] = useState("");

	const numericValue = Number(value) || 0;
	const discountAmount =
		mode === "percent" ? (subtotal * numericValue) / 100 : numericValue;
	const clampedDiscount = Math.min(Math.max(discountAmount, 0), subtotal);

	function handleApply() {
		if (clampedDiscount <= 0) return;
		const label =
			mode === "percent"
				? `${numericValue}% off`
				: `${formatGYD(clampedDiscount)} off`;
		onApply(clampedDiscount, reason ? `${label} - ${reason}` : label);
		setValue("");
		setReason("");
		onClose();
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(o) => {
				if (!o) onClose();
			}}
		>
			<DialogContent
				aria-describedby={undefined}
				className="max-w-xs sm:max-w-sm"
			>
				<DialogHeader>
					<DialogTitle>Apply Discount</DialogTitle>
				</DialogHeader>

				<div className="flex flex-col gap-4 py-2">
					{/* Mode toggle */}
					<div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
						<Button
							variant={mode === "percent" ? "default" : "ghost"}
							size="sm"
							className="flex-1 gap-1.5 text-sm"
							onClick={() => setMode("percent")}
						>
							<Percent className="size-3.5" />
							Percentage
						</Button>
						<Button
							variant={mode === "fixed" ? "default" : "ghost"}
							size="sm"
							className="flex-1 gap-1.5 text-sm"
							onClick={() => setMode("fixed")}
						>
							<DollarSign className="size-3.5" />
							Fixed Amount
						</Button>
					</div>

					{/* Value input */}
					<div className="flex flex-col gap-2">
						<Label>
							{mode === "percent" ? "Discount %" : "Discount Amount (GYD)"}
						</Label>
						<Input
							type="number"
							inputMode="numeric"
							value={value}
							onChange={(e) => setValue(e.target.value)}
							placeholder={mode === "percent" ? "e.g. 10" : "e.g. 500"}
							className="h-12 text-center text-xl"
							autoFocus
							min="0"
							max={mode === "percent" ? "100" : String(subtotal)}
						/>
					</div>

					{/* Quick percent buttons */}
					{mode === "percent" && (
						<div className="grid grid-cols-4 gap-2">
							{[5, 10, 15, 20].map((pct) => (
								<Button
									key={pct}
									variant="outline"
									size="sm"
									className="text-sm"
									onClick={() => setValue(String(pct))}
								>
									{pct}%
								</Button>
							))}
						</div>
					)}

					{/* Reason */}
					<div className="flex flex-col gap-2">
						<Label>Reason (optional)</Label>
						<Input
							value={reason}
							onChange={(e) => setReason(e.target.value)}
							placeholder="e.g. Loyal customer, Staff meal"
						/>
					</div>

					{/* Preview */}
					{clampedDiscount > 0 && (
						<div className="rounded-lg bg-muted/50 p-3 text-center">
							<p className="text-muted-foreground text-xs">Discount Amount</p>
							<p className="font-bold text-destructive text-xl">
								-{formatGYD(clampedDiscount)}
							</p>
							<p className="text-muted-foreground text-xs">
								New total: {formatGYD(subtotal - clampedDiscount)}
							</p>
						</div>
					)}
				</div>

				<DialogFooter className="gap-2 sm:gap-0">
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button onClick={handleApply} disabled={clampedDiscount <= 0}>
						Apply Discount
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
