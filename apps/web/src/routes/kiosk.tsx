/**
 * Self-ordering Kiosk Mode (GAP-014)
 * Full-screen customer-facing tablet UI for dine-in ordering.
 * Accessible at /kiosk?tableId=<uuid>
 */
import { useMutation, useQuery } from "@tanstack/react-query";
import {
	ArrowLeft,
	CheckCircle2,
	ChevronRight,
	Loader2,
	Minus,
	Plus,
	ShoppingCart,
	Trash2,
	UtensilsCrossed,
	X,
} from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatGYD } from "@/lib/types";
import { orpc } from "@/utils/orpc";

// ── Types ───────────────────────────────────────────────────────────────

interface CartItem {
	productId: string;
	name: string;
	price: number;
	quantity: number;
	notes: string;
	imageUrl: string | null;
}

type KioskView = "welcome" | "menu" | "cart" | "confirm" | "success";

// ── Component ────────────────────────────────────────────────────────────

export default function KioskPage() {
	const [searchParams] = useSearchParams();
	const tableId = searchParams.get("tableId");
	const [view, setView] = useState<KioskView>("welcome");
	const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
	const [cart, setCart] = useState<CartItem[]>([]);
	const [orderNumber, setOrderNumber] = useState<number | null>(null);

	// Fetch menu data (public endpoint)
	const { data: menu, isLoading } = useQuery(
		orpc.onlineOrder.getMenu.queryOptions({}),
	);

	const categories = menu ?? [];
	const activeCategory = activeCategoryId
		? categories.find((c) => c.id === activeCategoryId)
		: categories[0];

	const cartTotal = cart.reduce(
		(sum, item) => sum + item.price * item.quantity,
		0,
	);
	const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

	const createOrderMutation = useMutation(
		orpc.onlineOrder.placeOrder.mutationOptions({
			onSuccess: (data) => {
				setOrderNumber(
					Number(data.orderNumber) || Math.floor(Math.random() * 900) + 100,
				);
				setCart([]);
				setView("success");
			},
		}),
	);

	function addToCart(product: {
		id: string;
		name: string;
		price: number;
		imageUrl: string | null;
	}) {
		setCart((prev) => {
			const existing = prev.find((i) => i.productId === product.id);
			if (existing) {
				return prev.map((i) =>
					i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i,
				);
			}
			return [
				...prev,
				{
					productId: product.id,
					name: product.name,
					price: product.price,
					quantity: 1,
					notes: "",
					imageUrl: product.imageUrl,
				},
			];
		});
	}

	function updateQuantity(productId: string, delta: number) {
		setCart((prev) =>
			prev
				.map((i) =>
					i.productId === productId
						? { ...i, quantity: i.quantity + delta }
						: i,
				)
				.filter((i) => i.quantity > 0),
		);
	}

	function removeFromCart(productId: string) {
		setCart((prev) => prev.filter((i) => i.productId !== productId));
	}

	function handlePlaceOrder() {
		createOrderMutation.mutate({
			orderType: "pickup",
			items: cart.map((item) => ({
				productId: item.productId,
				quantity: item.quantity,
				notes: item.notes || undefined,
			})),
			customerName: tableId
				? `Table ${tableId.slice(0, 4).toUpperCase()}`
				: "Kiosk Guest",
			customerPhone: "0000000000",
		});
	}

	// ── Welcome Screen ────────────────────────────────────────────────────
	if (view === "welcome") {
		return (
			<div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background p-8">
				<div className="flex flex-col items-center gap-4 text-center">
					<div className="rounded-full bg-primary/10 p-6">
						<UtensilsCrossed className="size-16 text-primary" />
					</div>
					<h1 className="font-bold text-5xl">Welcome</h1>
					<p className="max-w-md text-muted-foreground text-xl">
						Bettencourt's Food Inc.
					</p>
					{tableId && (
						<Badge variant="outline" className="px-4 py-2 text-base">
							Table {tableId.slice(0, 4).toUpperCase()}
						</Badge>
					)}
				</div>
				<Button
					size="lg"
					className="min-h-[72px] min-w-[280px] gap-3 text-xl"
					onClick={() => setView("menu")}
				>
					Start Order
					<ChevronRight className="size-6" />
				</Button>
			</div>
		);
	}

	// ── Success Screen ────────────────────────────────────────────────────
	if (view === "success") {
		return (
			<div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background p-8">
				<div className="flex flex-col items-center gap-4 text-center">
					<CheckCircle2 className="size-24 text-green-500" />
					<h1 className="font-bold text-4xl">Thank You!</h1>
					<p className="text-muted-foreground text-xl">
						Your order has been placed!
					</p>
					{orderNumber && (
						<div className="rounded-xl border-2 border-primary bg-primary/5 px-8 py-4">
							<p className="text-muted-foreground text-sm">
								Order #{orderNumber}
							</p>
						</div>
					)}
					<p className="text-muted-foreground">
						Your order is being prepared
					</p>
					<p className="text-muted-foreground">We'll call your name when it's ready</p>
				</div>
				<Button
					variant="outline"
					size="lg"
					className="min-h-[56px] gap-2"
					onClick={() => {
						setView("welcome");
						setOrderNumber(null);
					}}
				>
					<ArrowLeft className="size-5" />
					Back to Menu
				</Button>
			</div>
		);
	}

	// ── Cart View ─────────────────────────────────────────────────────────
	if (view === "cart") {
		return (
			<div className="flex min-h-screen flex-col bg-background">
				{/* Header */}
				<div className="flex items-center gap-4 border-b px-6 py-4">
					<Button
						variant="ghost"
						size="lg"
						onClick={() => setView("menu")}
						className="min-h-[48px] gap-2"
					>
						<ArrowLeft className="size-5" />
						Back to Menu
					</Button>
					<h1 className="font-bold text-2xl">View Order</h1>
				</div>

				{/* Cart Items */}
				<div className="flex-1 overflow-auto p-6">
					{cart.length === 0 ? (
						<div className="flex h-full flex-col items-center justify-center gap-4 text-center text-muted-foreground">
							<ShoppingCart className="size-16" />
							<p className="text-xl">Your order is empty</p>
							<Button onClick={() => setView("menu")} size="lg">
								Back to Menu
							</Button>
						</div>
					) : (
						<div className="mx-auto max-w-2xl space-y-4">
							{cart.map((item) => (
								<div
									key={item.productId}
									className="flex items-center gap-4 rounded-xl border p-4"
								>
									<div className="flex-1">
										<p className="font-semibold text-lg">{item.name}</p>
										<p className="text-muted-foreground">
											{formatGYD(item.price)} each
										</p>
									</div>
									<div className="flex items-center gap-3">
										<Button
											variant="outline"
											size="icon"
											className="size-11"
											onClick={() => updateQuantity(item.productId, -1)}
										>
											<Minus className="size-5" />
										</Button>
										<span className="w-8 text-center font-bold text-xl">
											{item.quantity}
										</span>
										<Button
											variant="outline"
											size="icon"
											className="size-11"
											onClick={() => updateQuantity(item.productId, 1)}
										>
											<Plus className="size-5" />
										</Button>
										<Button
											variant="ghost"
											size="icon"
											className="size-11 text-destructive"
											onClick={() => removeFromCart(item.productId)}
										>
											<Trash2 className="size-5" />
										</Button>
									</div>
									<div className="w-24 text-right font-semibold text-lg">
										{formatGYD(item.price * item.quantity)}
									</div>
								</div>
							))}
						</div>
					)}
				</div>

				{/* Footer */}
				{cart.length > 0 && (
					<div className="border-t bg-background p-6">
						<div className="mx-auto max-w-2xl">
							<div className="mb-4 flex items-center justify-between font-bold text-2xl">
								<span>Total</span>
								<span>{formatGYD(cartTotal)}</span>
							</div>
							<Button
								size="lg"
								className="min-h-[64px] w-full gap-2 text-xl"
								onClick={handlePlaceOrder}
								disabled={createOrderMutation.isPending}
							>
								{createOrderMutation.isPending ? (
									<Loader2 className="size-5 animate-spin" />
								) : (
									<CheckCircle2 className="size-5" />
								)}
								Place Order
							</Button>
						</div>
					</div>
				)}
			</div>
		);
	}

	// ── Menu View ─────────────────────────────────────────────────────────
	return (
		<div className="flex min-h-screen flex-col bg-background">
			{/* Header */}
			<div className="flex items-center justify-between border-b px-6 py-3">
				<div className="flex items-center gap-3">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => setView("welcome")}
						className="min-h-[44px] gap-2"
					>
						<X className="size-4" />
					</Button>
					<h1 className="font-bold text-xl">Bettencourt's Food Inc.</h1>
				</div>
				<Button
					variant={cartCount > 0 ? "default" : "outline"}
					className="relative min-h-[48px] gap-2"
					onClick={() => setView("cart")}
				>
					<ShoppingCart className="size-5" />
					{cartCount > 0 && (
						<Badge className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full p-0 text-xs">
							{cartCount}
						</Badge>
					)}
					<span className="hidden sm:inline">View Order</span>
					{cartCount > 0 && (
						<span className="font-semibold">{formatGYD(cartTotal)}</span>
					)}
				</Button>
			</div>

			{/* Category Tabs */}
			{isLoading ? (
				<div className="flex flex-1 items-center justify-center">
					<Loader2 className="size-10 animate-spin text-muted-foreground" />
				</div>
			) : (
				<div className="flex flex-1 overflow-hidden">
					{/* Category Sidebar */}
					<div className="w-48 shrink-0 overflow-y-auto border-r bg-muted/30">
						{categories.map((cat) => (
							<button
								key={cat.id ?? cat.name}
								type="button"
								onClick={() => setActiveCategoryId(cat.id)}
								className={`min-h-[56px] w-full px-4 py-4 text-left font-medium text-sm transition-colors ${
									(activeCategoryId ?? categories[0]?.id) === cat.id
										? "bg-primary text-primary-foreground"
										: "hover:bg-muted"
								}`}
							>
								{cat.name}
							</button>
						))}
					</div>

					{/* Products Grid */}
					<div className="flex-1 overflow-y-auto p-4">
						<h2 className="mb-4 font-bold text-2xl">{activeCategory?.name}</h2>
						<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
							{activeCategory?.products.map((product) => {
								const cartItem = cart.find((i) => i.productId === product.id);
								return (
									<button
										key={product.id}
										type="button"
										onClick={() => addToCart(product)}
										className="relative flex min-h-[160px] flex-col overflow-hidden rounded-xl border bg-card text-left transition-all hover:border-primary hover:shadow-md active:scale-95"
									>
										{product.imageUrl ? (
											<img
												src={product.imageUrl}
												alt={product.name}
												className="h-28 w-full object-cover"
											/>
										) : (
											<div className="flex h-28 items-center justify-center bg-muted">
												<UtensilsCrossed className="size-10 text-muted-foreground" />
											</div>
										)}
										<div className="flex flex-1 flex-col justify-between p-3">
											<p className="font-semibold text-sm leading-tight">
												{product.name}
											</p>
											<p className="mt-1 font-bold text-primary">
												{formatGYD(product.price)}
											</p>
										</div>
										{cartItem && (
											<div className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground text-xs">
												{cartItem.quantity}
											</div>
										)}
									</button>
								);
							})}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
