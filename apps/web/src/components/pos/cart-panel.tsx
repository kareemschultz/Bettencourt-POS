import { useMutation } from "@tanstack/react-query";
import {
	Clock,
	Loader2,
	Minus,
	Pause,
	Percent,
	Plus,
	ShoppingBag,
	StickyNote,
	Tag,
	Trash2,
	Truck,
	X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CartItem } from "@/lib/types";
import { formatGYD } from "@/lib/types";
import { orpc } from "@/utils/orpc";

interface CartPanelProps {
	items: CartItem[];
	total: number;
	tax: number;
	grandTotal: number;
	discount: number;
	discountLabel: string;
	onUpdateQuantity: (id: string, delta: number) => void;
	onRemoveItem: (id: string) => void;
	onCheckout: () => void;
	onClearCart: () => void;
	onHoldOrder: () => void;
	onOpenDiscount: () => void;
	canApplyDiscount?: boolean;
	onOpenNotes: (id: string) => void;
	onApplyPromo?: (amount: number, label: string) => void;
	orderMode?: "dine_in" | "pickup" | "delivery";
	customerName?: string;
}

export function CartPanel({
	items,
	total,
	tax,
	grandTotal,
	discount,
	discountLabel,
	onUpdateQuantity,
	onRemoveItem,
	onCheckout,
	onClearCart,
	onHoldOrder,
	onOpenDiscount,
	canApplyDiscount = true,
	onOpenNotes,
	onApplyPromo,
	orderMode,
	customerName,
}: CartPanelProps) {
	const modeLabel =
		orderMode === "pickup"
			? "Pickup"
			: orderMode === "delivery"
				? "Delivery"
				: null;
	const ModeIcon =
		orderMode === "delivery"
			? Truck
			: orderMode === "pickup"
				? Clock
				: ShoppingBag;

	const [promoCode, setPromoCode] = useState("");
	const [appliedPromo, setAppliedPromo] = useState<{
		id: string;
		name: string;
		type: string;
		value: string;
		code: string;
	} | null>(null);

	const validatePromo = useMutation(
		orpc.discounts.validatePromo.mutationOptions({
			onSuccess: (rule) => {
				const discountValue = Number(rule.value);
				let discountAmount = 0;
				let label = "";

				if (rule.type === "percentage") {
					discountAmount = (total * discountValue) / 100;
					label = `Promo: ${rule.name} (${discountValue}% off)`;
				} else if (rule.type === "fixed") {
					discountAmount = Math.min(discountValue, total);
					label = `Promo: ${rule.name} (${formatGYD(discountAmount)} off)`;
				} else {
					discountAmount = discountValue;
					label = `Promo: ${rule.name}`;
				}

				discountAmount = Math.min(Math.max(discountAmount, 0), total);

				if (discountAmount <= 0) {
					toast.error("This promo code does not apply to your order");
					return;
				}

				setAppliedPromo({
					id: rule.id,
					name: rule.name,
					type: rule.type,
					value: rule.value,
					code: promoCode.toUpperCase(),
				});

				if (onApplyPromo) {
					onApplyPromo(discountAmount, label);
				}

				toast.success(`Promo "${rule.name}" applied!`);
				setPromoCode("");
			},
			onError: (error) => {
				toast.error(error.message || "Invalid promo code");
			},
		}),
	);

	function handleApplyPromo() {
		if (promoCode.trim().length === 0) return;
		validatePromo.mutate({ code: promoCode.trim() });
	}

	function handleRemovePromo() {
		setAppliedPromo(null);
		if (onApplyPromo) {
			onApplyPromo(0, "");
		}
	}

	// Compute promo discount display for the totals section
	const _promoDiscount = appliedPromo
		? (() => {
				const discountValue = Number(appliedPromo.value);
				if (appliedPromo.type === "percentage") {
					return Math.min((total * discountValue) / 100, total);
				}
				return Math.min(discountValue, total);
			})()
		: 0;

	return (
		<div className="flex h-full flex-col bg-card">
			{/* Header */}
			<div className="flex items-center justify-between border-border border-b px-4 py-3">
				<div className="flex items-center gap-2">
					<h2 className="font-semibold text-card-foreground">Current Order</h2>
					{modeLabel && (
						<Badge variant="outline" className="gap-1 text-xs">
							<ModeIcon className="size-3" />
							{modeLabel}
						</Badge>
					)}
				</div>
				<span className="text-muted-foreground text-sm">
					{items.reduce((s, i) => s + i.quantity, 0)} items
				</span>
			</div>
			{customerName && modeLabel && (
				<div className="border-border border-b bg-muted/30 px-4 py-1.5 text-muted-foreground text-xs">
					Customer:{" "}
					<span className="font-medium text-foreground">{customerName}</span>
				</div>
			)}

			{/* Items list */}
			<div className="flex-1 overflow-y-auto px-3 py-2">
				{items.length === 0 ? (
					<div className="flex h-full flex-col items-center justify-center gap-2">
						<ShoppingBag className="size-8 text-muted-foreground/30" />
						<p className="text-muted-foreground text-sm">
							Tap a product to add it
						</p>
						<p className="text-muted-foreground/60 text-xs">
							or scan a barcode
						</p>
					</div>
				) : (
					<div className="flex flex-col gap-1.5">
						{items.map((item) => (
							<div
								key={item.id}
								className="flex flex-col gap-1 rounded-md border border-border bg-background p-2"
							>
								<div className="flex items-start justify-between gap-2">
									<div className="min-w-0 flex-1">
										<p className="truncate font-medium text-sm leading-tight">
											{item.product.name}
										</p>
										{item.courseNumber ? (
											<p className="text-[10px] text-muted-foreground">Course {item.courseNumber}</p>
										) : null}
										{item.product.is_combo &&
											(item.product.combo_components ?? []).length > 0 && (
												<ul className="mt-0.5 flex flex-col gap-0">
													{(item.product.combo_components ?? []).map((cc) => (
														<li
															key={cc.id}
															className="truncate text-muted-foreground text-xs"
														>
															· {cc.component_name}
														</li>
													))}
												</ul>
											)}
										{item.modifiers.length > 0 && (
											<p className="truncate text-muted-foreground text-xs">
												{item.modifiers
													.map(
														(m) =>
															`${m.name}${m.price > 0 ? ` +${formatGYD(m.price)}` : ""}`,
													)
													.join(", ")}
											</p>
										)}
										{item.notes && (
											<p className="mt-0.5 truncate text-amber-600 text-xs italic dark:text-amber-400">
												{item.notes}
											</p>
										)}
									</div>
									<p className="shrink-0 font-semibold text-sm">
										{formatGYD(item.line_total)}
									</p>
								</div>
								<div className="flex items-center gap-1">
									<Button
										variant="outline"
										size="icon"
										className="size-11"
										onClick={() => onUpdateQuantity(item.id, -1)}
									>
										<Minus className="size-4" />
										<span className="sr-only">Decrease</span>
									</Button>
									<span className="w-8 text-center font-medium text-sm">
										{item.quantity}
									</span>
									<Button
										variant="outline"
										size="icon"
										className="size-11"
										onClick={() => onUpdateQuantity(item.id, 1)}
									>
										<Plus className="size-4" />
										<span className="sr-only">Increase</span>
									</Button>
									<span className="ml-auto text-muted-foreground text-xs">
										{`@ ${formatGYD(item.product.price)}`}
									</span>
									<Button
										variant="ghost"
										size="icon"
										className="size-11 text-muted-foreground hover:text-foreground"
										onClick={() => onOpenNotes(item.id)}
									>
										<StickyNote className="size-4" />
										<span className="sr-only">Add notes</span>
									</Button>
									<Button
										variant="ghost"
										size="icon"
										className="size-11 text-destructive hover:text-destructive"
										onClick={() => onRemoveItem(item.id)}
									>
										<Trash2 className="size-4" />
										<span className="sr-only">Remove</span>
									</Button>
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			{/* Promo code input */}
			{items.length > 0 && onApplyPromo && (
				<div className="border-border border-t px-4 py-2">
					{appliedPromo ? (
						<div className="flex items-center justify-between rounded-md bg-green-50 px-3 py-1.5 dark:bg-green-900/20">
							<div className="flex items-center gap-1.5 text-xs">
								<Tag className="size-3 text-green-600 dark:text-green-400" />
								<span className="font-medium text-green-700 dark:text-green-400">
									{appliedPromo.code}
								</span>
								<span className="text-green-600/70 dark:text-green-400/70">
									- {appliedPromo.name}
								</span>
							</div>
							<button
								className="rounded-full p-0.5 text-green-600 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-900/40"
								onClick={handleRemovePromo}
							>
								<X className="size-3.5" />
								<span className="sr-only">Remove promo</span>
							</button>
						</div>
					) : (
						<div className="flex gap-1.5">
							<Input
								value={promoCode}
								onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
								placeholder="Promo code"
								className="h-8 flex-1 text-xs uppercase"
								onKeyDown={(e) => {
									if (e.key === "Enter") handleApplyPromo();
								}}
							/>
							<Button
								variant="outline"
								size="sm"
								className="h-8 gap-1 px-2.5 text-xs"
								onClick={handleApplyPromo}
								disabled={
									promoCode.trim().length === 0 || validatePromo.isPending
								}
							>
								{validatePromo.isPending ? (
									<Loader2 className="size-3 animate-spin" />
								) : (
									<Tag className="size-3" />
								)}
								Apply
							</Button>
						</div>
					)}
				</div>
			)}

			{/* Totals + Actions */}
			<div className="border-border border-t px-4 py-3">
				<div className="flex flex-col gap-0.5 text-sm">
					<div className="flex justify-between">
						<span className="text-muted-foreground">Subtotal</span>
						<span>{formatGYD(total)}</span>
					</div>
					{discount > 0 && (
						<div className="flex justify-between text-destructive">
							<span className="truncate text-xs">
								{discountLabel || "Discount"}
							</span>
							<span className="shrink-0 font-medium">
								-{formatGYD(discount)}
							</span>
						</div>
					)}
					{tax > 0 && (
						<div className="flex justify-between">
							<span className="text-muted-foreground">Tax</span>
							<span>{formatGYD(tax)}</span>
						</div>
					)}
					<div className="flex justify-between border-border border-t pt-1 font-bold text-lg">
						<span>Total</span>
						<span>{formatGYD(grandTotal)}</span>
					</div>
				</div>

				<div className="mt-3 flex flex-col gap-2">
					<Button
						className="min-h-[56px] w-full font-bold text-lg"
						onClick={onCheckout}
						disabled={items.length === 0}
					>
						Pay {formatGYD(grandTotal)}
					</Button>
					<div className="flex gap-2">
						{canApplyDiscount && (
							<Button
								variant="outline"
								className="min-h-[44px] flex-1 gap-1.5"
								onClick={onOpenDiscount}
								disabled={items.length === 0}
							>
								<Percent className="size-4" />
								Discount
							</Button>
						)}
						<Button
							variant="outline"
							className="min-h-[44px] flex-1 gap-1.5"
							onClick={onHoldOrder}
							disabled={items.length === 0}
						>
							<Pause className="size-4" />
							Hold
						</Button>
						<Button
							variant="outline"
							className="min-h-[44px] flex-1 gap-1.5"
							onClick={onClearCart}
							disabled={items.length === 0}
						>
							<X className="size-4" />
							Clear
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
