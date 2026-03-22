import { useMutation, useQuery } from "@tanstack/react-query";
import {
	Check,
	ChevronRight,
	Clock,
	Loader2,
	MapPin,
	Minus,
	Phone,
	Plus,
	ShoppingCart,
	Store,
	Trash2,
	Truck,
	User,
	UtensilsCrossed,
	X,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { formatGYD } from "@/lib/types";
import { orpc } from "@/utils/orpc";

// ── Types ───────────────────────────────────────────────────────────────

interface MenuProduct {
	id: string;
	name: string;
	price: number;
	imageUrl: string | null;
}

interface MenuDepartment {
	id: string | null;
	name: string;
	sortOrder: number;
	products: MenuProduct[];
}

interface CartItem {
	productId: string;
	name: string;
	price: number;
	quantity: number;
	notes: string;
}

type OrderType = "pickup" | "delivery" | "dine_in";
type PageView = "menu" | "checkout" | "confirmation";

// ── Main Component ──────────────────────────────────────────────────────

export default function OnlineOrderPage() {
	const [searchParams] = useSearchParams();
	const tableId = searchParams.get("table");
	const tableName = searchParams.get("tableName");
	const [cart, setCart] = useState<CartItem[]>([]);
	const [cartOpen, setCartOpen] = useState(false);
	const [activeDepartment, setActiveDepartment] = useState<string | null>(null);
	const [view, setView] = useState<PageView>("menu");
	const [orderType, setOrderType] = useState<OrderType>(tableId ? "dine_in" : "pickup");
	const [customerName, setCustomerName] = useState("");
	const [customerPhone, setCustomerPhone] = useState("");
	const [deliveryAddress, setDeliveryAddress] = useState("");
	const [confirmation, setConfirmation] = useState<{
		orderNumber: string;
		total: number;
		estimatedReadyAt: string | null;
	} | null>(null);

	// ── Data Fetching ───────────────────────────────────────────────────

	const { data: departments, isLoading } = useQuery({
		...orpc.onlineOrder.getMenu.queryOptions({ input: undefined }),
		refetchInterval: 120_000,
	});

	const menuDepts = (departments || []) as MenuDepartment[];

	// ── Filtered departments ─────────────────────────────────────────────

	const filteredProducts = useMemo(() => {
		if (!activeDepartment) return menuDepts;
		return menuDepts.filter((d) => d.name === activeDepartment);
	}, [menuDepts, activeDepartment]);

	// ── Cart total ────────────────────────────────────────────────────────

	const cartItemCount = useMemo(
		() => cart.reduce((sum, item) => sum + item.quantity, 0),
		[cart],
	);

	const cartTotal = useMemo(
		() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
		[cart],
	);

	// ── Cart Operations ──────────────────────────────────────────────────

	const addToCart = useCallback((product: MenuProduct) => {
		setCart((prev) => {
			const existing = prev.find((item) => item.productId === product.id);
			if (existing) {
				return prev.map((item) =>
					item.productId === product.id
						? { ...item, quantity: item.quantity + 1 }
						: item,
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
				},
			];
		});
	}, []);

	const updateQuantity = useCallback((productId: string, delta: number) => {
		setCart((prev) => {
			return prev
				.map((item) => {
					if (item.productId !== productId) return item;
					const newQty = item.quantity + delta;
					if (newQty <= 0) return null;
					return { ...item, quantity: newQty };
				})
				.filter((item): item is CartItem => item !== null);
		});
	}, []);

	const updateNotes = useCallback((productId: string, notes: string) => {
		setCart((prev) =>
			prev.map((item) =>
				item.productId === productId ? { ...item, notes } : item,
			),
		);
	}, []);

	const removeFromCart = useCallback((productId: string) => {
		setCart((prev) => prev.filter((item) => item.productId !== productId));
	}, []);

	const clearCart = useCallback(() => {
		setCart([]);
	}, []);

	// ── Place Order Mutation ──────────────────────────────────────────────

	const placeOrderMutation = useMutation({
		...orpc.onlineOrder.placeOrder.mutationOptions(),
		onSuccess: (data) => {
			setConfirmation({
				orderNumber: data.orderNumber,
				total: data.total,
				estimatedReadyAt: data.estimatedReadyAt
					? new Date(data.estimatedReadyAt).toLocaleTimeString("en-US", {
							hour: "numeric",
							minute: "2-digit",
						})
					: null,
			});
			setView("confirmation");
			clearCart();
		},
	});

	const handleSubmitOrder = useCallback(() => {
		if (orderType !== "dine_in" && (!customerName.trim() || !customerPhone.trim())) return;
		if (orderType === "delivery" && !deliveryAddress.trim()) return;
		if (cart.length === 0) return;

		placeOrderMutation.mutate({
			customerName: customerName.trim() || (tableName ? `Table ${tableName}` : "Guest"),
			customerPhone: customerPhone.trim() || "N/A",
			orderType: (orderType === "dine_in" ? "pickup" : orderType) as "delivery" | "pickup",
			deliveryAddress:
				orderType === "delivery" ? deliveryAddress.trim() : undefined,
			items: cart.map((item) => ({
				productId: item.productId,
				quantity: item.quantity,
				notes: item.notes || undefined,
			})),
		});
	}, [
		customerName,
		customerPhone,
		orderType,
		deliveryAddress,
		cart,
		placeOrderMutation,
		tableId,
		tableName,
	]);

	const handleNewOrder = useCallback(() => {
		setView("menu");
		setConfirmation(null);
		setCustomerName("");
		setCustomerPhone("");
		setDeliveryAddress("");
		setOrderType("pickup");
	}, []);

	// ── Render ────────────────────────────────────────────────────────────

	if (view === "confirmation" && confirmation) {
		return (
			<ConfirmationView
				confirmation={confirmation}
				onNewOrder={handleNewOrder}
			/>
		);
	}

	if (view === "checkout") {
		return (
			<CheckoutView
				cart={cart}
				cartTotal={cartTotal}
				orderType={orderType}
				setOrderType={setOrderType}
				customerName={customerName}
				setCustomerName={setCustomerName}
				customerPhone={customerPhone}
				setCustomerPhone={setCustomerPhone}
				deliveryAddress={deliveryAddress}
				setDeliveryAddress={setDeliveryAddress}
				onBack={() => setView("menu")}
				onSubmit={handleSubmitOrder}
				isSubmitting={placeOrderMutation.isPending}
				error={placeOrderMutation.error?.message ?? null}
				updateQuantity={updateQuantity}
				updateNotes={updateNotes}
				removeFromCart={removeFromCart}
			/>
		);
	}

	return (
		<div
			className="flex min-h-screen flex-col"
			style={{ backgroundColor: "#1a1a14" }}
		>
			{/* Header */}
			<header
				className="sticky top-0 z-30 border-b px-4 py-3 sm:px-6"
				style={{ backgroundColor: "#1a1a14", borderColor: "#2a2a20" }}
			>
				<div className="mx-auto flex max-w-7xl items-center justify-between">
					<div className="flex items-center gap-3">
						<UtensilsCrossed
							className="size-7 sm:size-8"
							style={{ color: "#D4A843" }}
						/>
						<div>
							<h1
								className="font-bold text-xl tracking-tight sm:text-2xl"
								style={{ color: "#D4A843" }}
							>
								Bettencourt{"'"}s Food Inc.
							</h1>
							<p className="text-gray-400 text-xs sm:text-sm">Order Online</p>
						</div>
					</div>

					{/* Cart Button (mobile) */}
					<button
						onClick={() => setCartOpen(true)}
						className="relative rounded-full p-2.5 transition-colors lg:hidden"
						style={{ backgroundColor: "#2a2a20" }}
						aria-label={`Open cart, ${cartItemCount} items`}
					>
						<ShoppingCart className="size-6 text-gray-200" />
						{cartItemCount > 0 && (
							<span
								className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full font-bold text-black text-xs"
								style={{ backgroundColor: "#D4A843" }}
							>
								{cartItemCount}
							</span>
						)}
					</button>
				</div>
			</header>

			{/* Department Filter Pills */}
			{menuDepts.length > 0 && (
				<nav
					className="sticky top-[61px] z-20 border-b px-4 py-2 sm:px-6"
					style={{ backgroundColor: "#1a1a14", borderColor: "#2a2a20" }}
					aria-label="Department filter"
				>
					<div className="scrollbar-hide mx-auto flex max-w-7xl gap-2 overflow-x-auto pb-1">
						<button
							onClick={() => setActiveDepartment(null)}
							className="shrink-0 rounded-full px-4 py-1.5 font-medium text-sm transition-colors"
							style={{
								backgroundColor:
									activeDepartment === null ? "#D4A843" : "#2a2a20",
								color: activeDepartment === null ? "#1a1a14" : "#ccc",
							}}
						>
							All
						</button>
						{menuDepts.map((dept) => (
							<button
								key={dept.name}
								onClick={() =>
									setActiveDepartment(
										activeDepartment === dept.name ? null : dept.name,
									)
								}
								className="shrink-0 rounded-full px-4 py-1.5 font-medium text-sm transition-colors"
								style={{
									backgroundColor:
										activeDepartment === dept.name ? "#D4A843" : "#2a2a20",
									color: activeDepartment === dept.name ? "#1a1a14" : "#ccc",
								}}
							>
								{dept.name}
							</button>
						))}
					</div>
				</nav>
			)}

			{/* Main Content */}
			<div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-6 sm:px-6">
				{/* Menu Section */}
				<main className="flex-1">
					{isLoading ? (
						<div className="flex items-center justify-center py-20">
							<Loader2 className="size-8 animate-spin text-gray-400" />
						</div>
					) : filteredProducts.length === 0 ? (
						<div className="py-20 text-center text-gray-500">
							No items available.
						</div>
					) : (
						<div className="flex flex-col gap-8">
							{filteredProducts.map((dept) => (
								<section key={dept.name}>
									<h2
										className="mb-4 border-b pb-2 font-bold text-lg uppercase tracking-wider"
										style={{ color: "#D4A843", borderColor: "#3a3a2e" }}
									>
										{dept.name}
									</h2>
									<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
										{dept.products.map((product) => {
											const inCart = cart.find(
												(c) => c.productId === product.id,
											);
											return (
												<ProductCard
													key={product.id}
													product={product}
													quantity={inCart?.quantity ?? 0}
													onAdd={() => addToCart(product)}
													onIncrement={() => updateQuantity(product.id, 1)}
													onDecrement={() => updateQuantity(product.id, -1)}
												/>
											);
										})}
									</div>
								</section>
							))}
						</div>
					)}
				</main>

				{/* Desktop Cart Sidebar */}
				<aside
					className="sticky top-[120px] hidden h-fit w-80 shrink-0 overflow-hidden rounded-xl border lg:block xl:w-96"
					style={{ borderColor: "#2a2a20", backgroundColor: "#222218" }}
				>
					<CartPanel
						cart={cart}
						cartTotal={cartTotal}
						cartItemCount={cartItemCount}
						updateQuantity={updateQuantity}
						removeFromCart={removeFromCart}
						onCheckout={() => setView("checkout")}
					/>
				</aside>
			</div>

			{/* Mobile Cart Drawer */}
			{cartOpen && (
				<div className="fixed inset-0 z-50 lg:hidden">
					{/* Backdrop */}
					<div
						className="absolute inset-0 bg-black/60"
						onClick={() => setCartOpen(false)}
					/>
					{/* Drawer */}
					<div
						className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col"
						style={{ backgroundColor: "#222218" }}
					>
						<div
							className="flex items-center justify-between border-b px-4 py-3"
							style={{ borderColor: "#2a2a20" }}
						>
							<h2 className="font-bold text-lg text-white">Your Cart</h2>
							<button
								onClick={() => setCartOpen(false)}
								className="rounded-lg p-2 text-gray-400 transition-colors hover:text-white"
								aria-label="Close cart"
							>
								<X className="size-5" />
							</button>
						</div>
						<div className="flex-1 overflow-y-auto">
							<CartPanel
								cart={cart}
								cartTotal={cartTotal}
								cartItemCount={cartItemCount}
								updateQuantity={updateQuantity}
								removeFromCart={removeFromCart}
								onCheckout={() => {
									setCartOpen(false);
									setView("checkout");
								}}
							/>
						</div>
					</div>
				</div>
			)}

			{/* Mobile Bottom Bar (when cart has items) */}
			{cartItemCount > 0 && !cartOpen && (
				<div
					className="sticky bottom-0 z-20 border-t p-3 lg:hidden"
					style={{ backgroundColor: "#1a1a14", borderColor: "#2a2a20" }}
				>
					<button
						onClick={() => setView("checkout")}
						className="flex w-full items-center justify-between rounded-xl px-5 py-3.5 font-bold text-base"
						style={{ backgroundColor: "#D4A843", color: "#1a1a14" }}
					>
						<span className="flex items-center gap-2">
							<ShoppingCart className="size-5" />
							Checkout ({cartItemCount})
						</span>
						<span>{formatGYD(cartTotal)}</span>
					</button>
				</div>
			)}

			{/* Footer */}
			<footer
				className="border-t px-4 py-4 text-center text-gray-500 text-xs sm:px-6"
				style={{ borderColor: "#2a2a20" }}
			>
				Bettencourt{"'"}s Food Inc. &middot; Prices subject to change &middot;
				Pay at pickup
			</footer>
		</div>
	);
}

// ── Product Card ────────────────────────────────────────────────────────

function ProductCard({
	product,
	quantity,
	onAdd,
	onIncrement,
	onDecrement,
}: {
	product: MenuProduct;
	quantity: number;
	onAdd: () => void;
	onIncrement: () => void;
	onDecrement: () => void;
}) {
	return (
		<div
			className="group flex flex-col overflow-hidden rounded-xl border transition-colors"
			style={{
				borderColor: quantity > 0 ? "#D4A843" : "#2a2a20",
				backgroundColor: "#222218",
			}}
		>
			{product.imageUrl && (
				<div className="aspect-[4/3] overflow-hidden bg-gray-800">
					<img
						src={product.imageUrl}
						alt={product.name}
						className="size-full object-cover transition-transform group-hover:scale-105"
						loading="lazy"
					/>
				</div>
			)}
			<div className="flex flex-1 flex-col p-3">
				<h3 className="font-semibold text-sm text-white leading-snug sm:text-base">
					{product.name}
				</h3>
				<p className="mt-1 font-bold text-base" style={{ color: "#D4A843" }}>
					{formatGYD(product.price)}
				</p>
				<div className="mt-auto pt-3">
					{quantity === 0 ? (
						<button
							onClick={onAdd}
							className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2 font-medium text-sm transition-colors"
							style={{ backgroundColor: "#D4A843", color: "#1a1a14" }}
						>
							<Plus className="size-4" />
							Add
						</button>
					) : (
						<div className="flex items-center justify-between">
							<button
								onClick={onDecrement}
								className="flex size-8 items-center justify-center rounded-lg border transition-colors hover:bg-gray-700"
								style={{ borderColor: "#3a3a2e" }}
								aria-label={`Decrease ${product.name} quantity`}
							>
								<Minus className="size-4 text-gray-300" />
							</button>
							<span className="font-bold text-sm" style={{ color: "#D4A843" }}>
								{quantity}
							</span>
							<button
								onClick={onIncrement}
								className="flex size-8 items-center justify-center rounded-lg transition-colors"
								style={{ backgroundColor: "#D4A843", color: "#1a1a14" }}
								aria-label={`Increase ${product.name} quantity`}
							>
								<Plus className="size-4" />
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

// ── Cart Panel (shared by sidebar and mobile drawer) ────────────────────

function CartPanel({
	cart,
	cartTotal,
	cartItemCount,
	updateQuantity,
	removeFromCart,
	onCheckout,
}: {
	cart: CartItem[];
	cartTotal: number;
	cartItemCount: number;
	updateQuantity: (productId: string, delta: number) => void;
	removeFromCart: (productId: string) => void;
	onCheckout: () => void;
}) {
	if (cartItemCount === 0) {
		return (
			<div className="flex flex-col items-center justify-center px-6 py-16 text-gray-500">
				<ShoppingCart className="mb-3 size-12 text-gray-600" />
				<p className="text-sm">Your cart is empty</p>
				<p className="mt-1 text-gray-600 text-xs">
					Add items from the menu to get started
				</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col">
			<div className="border-b px-4 py-3" style={{ borderColor: "#2a2a20" }}>
				<h3 className="font-semibold text-gray-300 text-sm">
					Your Order ({cartItemCount} {cartItemCount === 1 ? "item" : "items"})
				</h3>
			</div>

			<div className="max-h-[50vh] flex-1 overflow-y-auto px-4 py-2">
				{cart.map((item) => (
					<div
						key={item.productId}
						className="flex items-start gap-3 border-b py-3 last:border-b-0"
						style={{ borderColor: "#2a2a20" }}
					>
						<div className="min-w-0 flex-1">
							<p className="truncate font-medium text-sm text-white">
								{item.name}
							</p>
							<p className="text-gray-400 text-xs">
								{formatGYD(item.price)} each
							</p>
						</div>
						<div className="flex items-center gap-2">
							<button
								onClick={() => updateQuantity(item.productId, -1)}
								className="flex size-6 items-center justify-center rounded border text-gray-400 transition-colors hover:text-white"
								style={{ borderColor: "#3a3a2e" }}
								aria-label={`Decrease ${item.name} quantity`}
							>
								<Minus className="size-3" />
							</button>
							<span className="w-5 text-center font-medium text-sm text-white">
								{item.quantity}
							</span>
							<button
								onClick={() => updateQuantity(item.productId, 1)}
								className="flex size-6 items-center justify-center rounded text-sm transition-colors"
								style={{ backgroundColor: "#D4A843", color: "#1a1a14" }}
								aria-label={`Increase ${item.name} quantity`}
							>
								<Plus className="size-3" />
							</button>
							<button
								onClick={() => removeFromCart(item.productId)}
								className="ml-1 flex size-6 items-center justify-center rounded text-gray-500 transition-colors hover:text-red-400"
								aria-label={`Remove ${item.name}`}
							>
								<Trash2 className="size-3.5" />
							</button>
						</div>
					</div>
				))}
			</div>

			<div className="border-t px-4 py-4" style={{ borderColor: "#2a2a20" }}>
				<div className="mb-3 flex items-center justify-between">
					<span className="font-medium text-gray-300 text-sm">Total</span>
					<span className="font-bold text-lg" style={{ color: "#D4A843" }}>
						{formatGYD(cartTotal)}
					</span>
				</div>
				<button
					onClick={onCheckout}
					className="flex w-full items-center justify-center gap-2 rounded-xl py-3 font-bold text-base transition-opacity hover:opacity-90"
					style={{ backgroundColor: "#D4A843", color: "#1a1a14" }}
				>
					Checkout
					<ChevronRight className="size-5" />
				</button>
			</div>
		</div>
	);
}

// ── Checkout View ───────────────────────────────────────────────────────

function CheckoutView({
	cart,
	cartTotal,
	orderType,
	setOrderType,
	customerName,
	setCustomerName,
	customerPhone,
	setCustomerPhone,
	deliveryAddress,
	setDeliveryAddress,
	onBack,
	onSubmit,
	isSubmitting,
	error,
	updateQuantity,
	updateNotes,
	removeFromCart,
}: {
	cart: CartItem[];
	cartTotal: number;
	orderType: OrderType;
	setOrderType: (t: OrderType) => void;
	customerName: string;
	setCustomerName: (v: string) => void;
	customerPhone: string;
	setCustomerPhone: (v: string) => void;
	deliveryAddress: string;
	setDeliveryAddress: (v: string) => void;
	onBack: () => void;
	onSubmit: () => void;
	isSubmitting: boolean;
	error: string | null;
	updateQuantity: (productId: string, delta: number) => void;
	updateNotes: (productId: string, notes: string) => void;
	removeFromCart: (productId: string) => void;
}) {
	const isValid =
		customerName.trim().length > 0 &&
		customerPhone.trim().length > 0 &&
		cart.length > 0 &&
		(orderType === "pickup" || deliveryAddress.trim().length > 0);

	return (
		<div
			className="flex min-h-screen flex-col"
			style={{ backgroundColor: "#1a1a14" }}
		>
			{/* Header */}
			<header
				className="border-b px-4 py-3 sm:px-6"
				style={{ borderColor: "#2a2a20" }}
			>
				<div className="mx-auto flex max-w-3xl items-center gap-3">
					<button
						onClick={onBack}
						className="rounded-lg p-2 text-gray-400 transition-colors hover:text-white"
						style={{ backgroundColor: "#2a2a20" }}
						aria-label="Back to menu"
					>
						<ChevronRight className="size-5 rotate-180" />
					</button>
					<h1 className="font-bold text-xl" style={{ color: "#D4A843" }}>
						Checkout
					</h1>
				</div>
			</header>

			<div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
				<div className="flex flex-col gap-6">
					{/* Order Type Selection */}
					<section
						className="rounded-xl border p-4 sm:p-6"
						style={{ borderColor: "#2a2a20", backgroundColor: "#222218" }}
					>
						<h2 className="mb-4 font-semibold text-gray-400 text-sm uppercase tracking-wider">
							Order Type
						</h2>
						<div className="grid grid-cols-2 gap-3">
							<button
								onClick={() => setOrderType("pickup")}
								className="flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors"
								style={{
									borderColor: orderType === "pickup" ? "#D4A843" : "#2a2a20",
									backgroundColor:
										orderType === "pickup" ? "#D4A84315" : "transparent",
								}}
							>
								<Store
									className="size-7"
									style={{
										color: orderType === "pickup" ? "#D4A843" : "#888",
									}}
								/>
								<span
									className="font-semibold text-sm"
									style={{
										color: orderType === "pickup" ? "#D4A843" : "#ccc",
									}}
								>
									Pickup
								</span>
							</button>
							<button
								onClick={() => setOrderType("delivery")}
								className="flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors"
								style={{
									borderColor: orderType === "delivery" ? "#D4A843" : "#2a2a20",
									backgroundColor:
										orderType === "delivery" ? "#D4A84315" : "transparent",
								}}
							>
								<Truck
									className="size-7"
									style={{
										color: orderType === "delivery" ? "#D4A843" : "#888",
									}}
								/>
								<span
									className="font-semibold text-sm"
									style={{
										color: orderType === "delivery" ? "#D4A843" : "#ccc",
									}}
								>
									Delivery
								</span>
							</button>
						</div>
					</section>

					{/* Customer Information */}
					<section
						className="rounded-xl border p-4 sm:p-6"
						style={{ borderColor: "#2a2a20", backgroundColor: "#222218" }}
					>
						<h2 className="mb-4 font-semibold text-gray-400 text-sm uppercase tracking-wider">
							Your Information
						</h2>
						<div className="flex flex-col gap-4">
							<div>
								<label
									htmlFor="customerName"
									className="mb-1.5 flex items-center gap-2 text-gray-300 text-sm"
								>
									<User className="size-4" />
									Name <span className="text-red-400">*</span>
								</label>
								<input
									id="customerName"
									type="text"
									value={customerName}
									onChange={(e) => setCustomerName(e.target.value)}
									placeholder="Your full name"
									className="w-full rounded-lg border px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition-colors focus:border-[#D4A843]"
									style={{
										borderColor: "#3a3a2e",
										backgroundColor: "#1a1a14",
									}}
								/>
							</div>
							<div>
								<label
									htmlFor="customerPhone"
									className="mb-1.5 flex items-center gap-2 text-gray-300 text-sm"
								>
									<Phone className="size-4" />
									Phone <span className="text-red-400">*</span>
								</label>
								<input
									id="customerPhone"
									type="tel"
									value={customerPhone}
									onChange={(e) => setCustomerPhone(e.target.value)}
									placeholder="e.g. 600-1234"
									className="w-full rounded-lg border px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition-colors focus:border-[#D4A843]"
									style={{
										borderColor: "#3a3a2e",
										backgroundColor: "#1a1a14",
									}}
								/>
							</div>
							{orderType === "delivery" && (
								<div>
									<label
										htmlFor="deliveryAddress"
										className="mb-1.5 flex items-center gap-2 text-gray-300 text-sm"
									>
										<MapPin className="size-4" />
										Delivery Address <span className="text-red-400">*</span>
									</label>
									<textarea
										id="deliveryAddress"
										value={deliveryAddress}
										onChange={(e) => setDeliveryAddress(e.target.value)}
										placeholder="Full delivery address"
										rows={2}
										className="w-full resize-none rounded-lg border px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition-colors focus:border-[#D4A843]"
										style={{
											borderColor: "#3a3a2e",
											backgroundColor: "#1a1a14",
										}}
									/>
								</div>
							)}
						</div>
					</section>

					{/* Order Summary */}
					<section
						className="rounded-xl border p-4 sm:p-6"
						style={{ borderColor: "#2a2a20", backgroundColor: "#222218" }}
					>
						<h2 className="mb-4 font-semibold text-gray-400 text-sm uppercase tracking-wider">
							Order Summary
						</h2>
						<div
							className="flex flex-col divide-y"
							style={{ divideColor: "#2a2a20" } as React.CSSProperties}
						>
							{cart.map((item) => (
								<div
									key={item.productId}
									className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0"
								>
									<div className="flex items-start justify-between gap-3">
										<div className="min-w-0 flex-1">
											<p className="font-medium text-sm text-white">
												{item.name}
											</p>
											<p className="text-gray-400 text-xs">
												{formatGYD(item.price)} x {item.quantity} ={" "}
												{formatGYD(item.price * item.quantity)}
											</p>
										</div>
										<div className="flex items-center gap-1.5">
											<button
												onClick={() => updateQuantity(item.productId, -1)}
												className="flex size-6 items-center justify-center rounded border text-gray-400 hover:text-white"
												style={{ borderColor: "#3a3a2e" }}
												aria-label={`Decrease ${item.name}`}
											>
												<Minus className="size-3" />
											</button>
											<span className="w-5 text-center font-medium text-white text-xs">
												{item.quantity}
											</span>
											<button
												onClick={() => updateQuantity(item.productId, 1)}
												className="flex size-6 items-center justify-center rounded"
												style={{ backgroundColor: "#D4A843", color: "#1a1a14" }}
												aria-label={`Increase ${item.name}`}
											>
												<Plus className="size-3" />
											</button>
											<button
												onClick={() => removeFromCart(item.productId)}
												className="ml-1 text-gray-500 hover:text-red-400"
												aria-label={`Remove ${item.name}`}
											>
												<Trash2 className="size-3.5" />
											</button>
										</div>
									</div>
									<input
										type="text"
										value={item.notes}
										onChange={(e) =>
											updateNotes(item.productId, e.target.value)
										}
										placeholder="Special instructions (optional)"
										className="w-full rounded border px-2.5 py-1.5 text-white text-xs placeholder-gray-600 outline-none focus:border-[#D4A843]"
										style={{
											borderColor: "#3a3a2e",
											backgroundColor: "#1a1a14",
										}}
									/>
								</div>
							))}
						</div>

						<div
							className="mt-4 flex items-center justify-between border-t pt-4"
							style={{ borderColor: "#3a3a2e" }}
						>
							<span className="font-semibold text-gray-300 text-sm">Total</span>
							<span className="font-bold text-xl" style={{ color: "#D4A843" }}>
								{formatGYD(cartTotal)}
							</span>
						</div>
					</section>

					{/* Payment Notice */}
					<section
						className="rounded-xl border p-4 sm:p-6"
						style={{
							borderColor: "#2a2a20",
							backgroundColor: "#222218",
						}}
					>
						<div className="flex items-start gap-3">
							<Store className="mt-0.5 size-5 shrink-0 text-gray-400" />
							<div>
								<p className="font-medium text-sm text-white">Pay at Pickup</p>
								<p className="mt-0.5 text-gray-400 text-xs">
									Payment will be collected when you pick up your order. We
									accept cash and card.
								</p>
							</div>
						</div>
					</section>

					{/* Error */}
					{error && (
						<div
							className="rounded-xl border border-red-800 bg-red-900/30 px-4 py-3 text-red-300 text-sm"
							role="alert"
						>
							{error}
						</div>
					)}

					{/* Submit Button */}
					<button
						onClick={onSubmit}
						disabled={!isValid || isSubmitting}
						className="flex w-full items-center justify-center gap-2 rounded-xl py-4 font-bold text-base transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
						style={{ backgroundColor: "#D4A843", color: "#1a1a14" }}
					>
						{isSubmitting ? (
							<>
								<Loader2 className="size-5 animate-spin" />
								Placing Order...
							</>
						) : (
							<>Place Order &middot; {formatGYD(cartTotal)}</>
						)}
					</button>
				</div>
			</div>
		</div>
	);
}

// ── Confirmation View ───────────────────────────────────────────────────

function ConfirmationView({
	confirmation,
	onNewOrder,
}: {
	confirmation: {
		orderNumber: string;
		total: number;
		estimatedReadyAt: string | null;
	};
	onNewOrder: () => void;
}) {
	return (
		<div
			className="flex min-h-screen flex-col items-center justify-center px-4"
			style={{ backgroundColor: "#1a1a14" }}
		>
			<div
				className="w-full max-w-md rounded-2xl border p-6 text-center sm:p-8"
				style={{ borderColor: "#2a2a20", backgroundColor: "#222218" }}
			>
				{/* Success icon */}
				<div
					className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full"
					style={{ backgroundColor: "#D4A84320" }}
				>
					<Check className="size-8" style={{ color: "#D4A843" }} />
				</div>

				<h1 className="font-bold text-2xl text-white">Order Placed!</h1>
				<p className="mt-2 text-gray-400 text-sm">
					Your order has been received and sent to the kitchen.
				</p>

				{/* Order Details */}
				<div
					className="mt-6 rounded-xl border p-4"
					style={{ borderColor: "#2a2a20", backgroundColor: "#1a1a14" }}
				>
					<div className="flex flex-col gap-3">
						<div className="flex items-center justify-between">
							<span className="text-gray-400 text-sm">Order Number</span>
							<span className="font-bold text-lg" style={{ color: "#D4A843" }}>
								{confirmation.orderNumber}
							</span>
						</div>
						<div className="border-t" style={{ borderColor: "#2a2a20" }} />
						<div className="flex items-center justify-between">
							<span className="text-gray-400 text-sm">Total</span>
							<span className="font-semibold text-base text-white">
								{formatGYD(confirmation.total)}
							</span>
						</div>
						{confirmation.estimatedReadyAt && (
							<>
								<div className="border-t" style={{ borderColor: "#2a2a20" }} />
								<div className="flex items-center justify-between">
									<span className="flex items-center gap-1.5 text-gray-400 text-sm">
										<Clock className="size-4" />
										Estimated Ready
									</span>
									<span className="font-semibold text-base text-white">
										{confirmation.estimatedReadyAt}
									</span>
								</div>
							</>
						)}
					</div>
				</div>

				<p className="mt-5 text-gray-500 text-xs">
					Please save your order number. Payment will be collected at pickup.
				</p>

				<button
					onClick={onNewOrder}
					className="mt-6 w-full rounded-xl py-3 font-semibold text-sm transition-opacity hover:opacity-90"
					style={{ backgroundColor: "#D4A843", color: "#1a1a14" }}
				>
					Place Another Order
				</button>
			</div>
		</div>
	);
}
