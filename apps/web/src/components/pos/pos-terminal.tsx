import { useMutation, useQuery } from "@tanstack/react-query";
import {
	Barcode,
	Clock,
	Gift,
	Keyboard,
	ReceiptText,
	ShoppingBag,
	ShoppingCart,
	Star,
	Truck,
	UserSearch,
	X as XIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner";
import { useSupervisorOverride } from "@/hooks/use-supervisor-override";
import type { CartItem, Product } from "@/lib/types";
import { formatGYD } from "@/lib/types";
import { orpc } from "@/utils/orpc";
import { CartPanel } from "./cart-panel";
import { DiscountDialog } from "./discount-dialog";
import { ItemNotesDialog } from "./item-notes-dialog";
import { PaymentDialog } from "./payment-dialog";
import { ProductGrid } from "./product-grid";
import { ReceiptPreview } from "./receipt-preview";
import { SellGiftCardDialog } from "./sell-gift-card-dialog";

const BEVERAGE_REGISTER = "c0000000-0000-4000-8000-000000000003";
const DEFAULT_ORG_ID = "a0000000-0000-4000-8000-000000000001";
const DEFAULT_LOCATION_ID = "b0000000-0000-4000-8000-000000000001";

interface POSTerminalProps {
	userId: string | null;
	userName?: string;
	locationId?: string | null;
	userPermissions?: Record<string, string[]>;
}

export function POSTerminal({
	userId,
	userName = "Cashier",
	locationId: propLocationId,
	userPermissions = {},
}: POSTerminalProps) {
	// Discount permission: only users with discounts.apply can open the discount dialog
	const canApplyDiscount =
		userPermissions.discounts?.includes("apply") ?? false;
	const [cart, setCart] = useState<CartItem[]>([]);
	const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
	const [selectedRegister, setSelectedRegister] = useState<string>(
		"c0000000-0000-4000-8000-000000000001",
	);
	const [paymentOpen, setPaymentOpen] = useState(false);
	const [receiptOpen, setReceiptOpen] = useState(false);
	const [discountOpen, setDiscountOpen] = useState(false);
	const [notesItemId, setNotesItemId] = useState<string | null>(null);
	const [lastOrder, setLastOrder] = useState<Record<string, unknown> | null>(
		null,
	);
	const [lastChange, setLastChange] = useState(0);
	const [lastCartSnapshot, setLastCartSnapshot] = useState<CartItem[]>([]);
	const [heldOrders, setHeldOrders] = useState<CartItem[][]>([]);
	const [mobileCartOpen, setMobileCartOpen] = useState(false);
	const [discount, setDiscount] = useState(0);
	const [discountLabel, setDiscountLabel] = useState("");
	const [showShortcuts, setShowShortcuts] = useState(false);
	const [selectedCustomer, setSelectedCustomer] = useState<{
		id: string;
		name: string;
		phone: string | null;
	} | null>(null);
	const [customerSearchQuery, setCustomerSearchQuery] = useState("");
	const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false);
	const [sellGiftCardOpen, setSellGiftCardOpen] = useState(false);
	const [departmentOverrideActive, setDepartmentOverrideActive] =
		useState(false);
	const [lastOrderMeta, setLastOrderMeta] = useState<{
		placedAt: Date;
		mode: string;
	} | null>(null);

	const { requestOverride, SupervisorDialog } = useSupervisorOverride();

	// Loyalty points for selected customer
	const { data: loyaltyData } = useQuery({
		...orpc.loyalty.getCustomerPoints.queryOptions({
			input: { customerId: selectedCustomer?.id ?? "" },
		}),
		enabled: !!selectedCustomer?.id,
	});

	// Customer search
	const { data: customerResults = [] } = useQuery({
		...orpc.customers.search.queryOptions({
			input: { query: customerSearchQuery },
		}),
		enabled: customerSearchQuery.length >= 2,
	});

	// Pickup / Delivery state (Terminal 3 only)
	const isBeverageTerminal = selectedRegister === BEVERAGE_REGISTER;
	const [orderMode, setOrderMode] = useState<"dine_in" | "pickup" | "delivery">(
		"dine_in",
	);
	const [customerName, setCustomerName] = useState("");
	const [customerPhone, setCustomerPhone] = useState("");
	const [deliveryAddress, setDeliveryAddress] = useState("");
	const [estimatedReady, setEstimatedReady] = useState("15");

	// Resolve effective location: prefer prop from LocationContext, fall back to hardcoded default
	const effectiveLocationId = propLocationId || DEFAULT_LOCATION_ID;

	// Fetch products via oRPC (filtered by location; skip register filter when override active)
	const { data: posData, isLoading } = useQuery(
		orpc.pos.getProducts.queryOptions({
			input: {
				registerId: departmentOverrideActive ? undefined : selectedRegister,
				departmentId:
					selectedDepartment !== "all" ? selectedDepartment : undefined,
				locationId: effectiveLocationId,
			},
		}),
	);

	// Map oRPC camelCase response to frontend Product type
	const departments: { id: string; name: string }[] =
		posData?.departments || [];
	const products: Product[] = (posData?.products || []).map((p) => ({
		id: p.id,
		organization_id: p.organizationId,
		name: p.name,
		reporting_name: p.reportingName,
		department_id: p.reportingCategoryId,
		sku: p.sku,
		price: Number(p.price),
		cost: Number(p.cost || 0),
		tax_rate: Number(p.taxRate || 0),
		is_combo: p.comboComponents.length > 0,
		is_active: p.isActive,
		image_url: p.imageUrl,
		sort_order: p.sortOrder,
		department_name: p.departmentName ?? undefined,
		combo_components: p.comboComponents.map((cc) => ({
			id: cc.id,
			combo_product_id: cc.comboProductId,
			component_name: cc.componentName,
			department_id: "",
			department_name: cc.departmentName ?? undefined,
			allocated_price: Number(cc.allocatedPrice),
		})),
	}));

	// Checkout mutation via oRPC
	const checkoutMutation = useMutation(
		orpc.pos.checkout.mutationOptions({
			onSuccess: (result) => {
				setLastCartSnapshot([...cart]);
				setLastOrder(result.order as Record<string, unknown>);
				setLastChange(result.change || 0);
				setLastOrderMeta({
					placedAt: new Date(),
					mode: isBeverageTerminal ? orderMode : "dine_in",
				});
				setPaymentOpen(false);
				setReceiptOpen(true);
				setMobileCartOpen(false);
				setCart([]);
				setDiscount(0);
				setDiscountLabel("");
				setSelectedCustomer(null);
				resetPickupFields();
			},
			onError: (error) => {
				toast.error(error.message || "Checkout failed");
			},
		}),
	);

	const handleProductTap = useCallback((product: Product) => {
		setCart((prev) => {
			const existing = prev.find(
				(item) =>
					item.product.id === product.id &&
					item.modifiers.length === 0 &&
					!item.notes,
			);
			if (existing) {
				return prev.map((item) =>
					item.id === existing.id
						? {
								...item,
								quantity: item.quantity + 1,
								line_total: (item.quantity + 1) * item.product.price,
							}
						: item,
				);
			}
			return [
				...prev,
				{
					id: crypto.randomUUID(),
					product,
					quantity: 1,
					modifiers: [],
					notes: "",
					line_total: product.price,
				},
			];
		});
	}, []);

	function handleUpdateQuantity(id: string, delta: number) {
		setCart((prev) =>
			prev
				.map((item) =>
					item.id === id
						? {
								...item,
								quantity: Math.max(0, item.quantity + delta),
								line_total:
									Math.max(0, item.quantity + delta) * item.product.price,
							}
						: item,
				)
				.filter((item) => item.quantity > 0),
		);
	}

	function handleRemoveItem(id: string) {
		setCart((prev) => prev.filter((item) => item.id !== id));
	}

	function handleClearCart() {
		setCart([]);
		setDiscount(0);
		setDiscountLabel("");
		setSelectedCustomer(null);
		resetPickupFields();
	}

	function handleHoldOrder() {
		if (cart.length === 0) return;
		setHeldOrders((prev) => [...prev, cart]);
		setCart([]);
		setDiscount(0);
		setDiscountLabel("");
		resetPickupFields();
	}

	function handleRecallOrder(index: number) {
		setCart(heldOrders[index]);
		setHeldOrders((prev) => prev.filter((_, i) => i !== index));
	}

	function handleApplyDiscount(amount: number, label: string) {
		setDiscount(amount);
		setDiscountLabel(label);
	}

	function handleSaveItemNotes(notes: string) {
		if (!notesItemId) return;
		setCart((prev) =>
			prev.map((item) => (item.id === notesItemId ? { ...item, notes } : item)),
		);
		setNotesItemId(null);
	}

	function resetPickupFields() {
		setCustomerName("");
		setCustomerPhone("");
		setDeliveryAddress("");
		setEstimatedReady("15");
		setOrderMode("dine_in");
	}

	const cartItemCount = cart.reduce((s, i) => s + i.quantity, 0);
	const cartTotal = cart.reduce((sum, item) => sum + item.line_total, 0);
	const cartTax = cart.reduce(
		(sum, item) => sum + item.line_total * item.product.tax_rate,
		0,
	);
	const grandTotal = cartTotal + cartTax - discount;

	async function handlePaymentComplete(
		payments: { method: string; amount: number; reference?: string }[],
	) {
		const checkoutItems = cart.map((item) => ({
			productId: item.product.id,
			productName: item.product.name,
			department: item.product.department_name || null,
			quantity: item.quantity,
			unitPrice: item.product.price,
			taxRate: item.product.tax_rate,
			isCombo: item.product.is_combo || false,
			comboComponents: (item.product.combo_components || []).map((cc) => ({
				componentName: cc.component_name,
				departmentName: cc.department_name || "",
				allocatedPrice: cc.allocated_price,
			})),
			modifiers: item.modifiers.map((m) => ({ name: m.name, price: m.price })),
			notes: item.notes || null,
		}));

		if (orderMode === "pickup" && !customerPhone.trim()) {
			toast.error("Phone number required for pickup orders");
			return;
		}
		if (orderMode === "delivery") {
			if (!customerPhone.trim()) {
				toast.error("Phone number required for delivery orders");
				return;
			}
			if (!deliveryAddress.trim()) {
				toast.error("Delivery address required for delivery orders");
				return;
			}
		}

		const isPickupOrDelivery = isBeverageTerminal && orderMode !== "dine_in";
		const estimatedReadyMs = isPickupOrDelivery
			? Number.parseInt(estimatedReady, 10) * 60_000
			: 0;

		checkoutMutation.mutate({
			items: checkoutItems,
			payments,
			userId: userId,
			registerId: selectedRegister,
			locationId: effectiveLocationId,
			organizationId: DEFAULT_ORG_ID,
			orderType: isBeverageTerminal ? orderMode : "dine_in",
			discountTotal: discount,
			customerId: selectedCustomer?.id ?? null,
			customerName: isPickupOrDelivery ? customerName || null : null,
			customerPhone: isPickupOrDelivery ? customerPhone || null : null,
			deliveryAddress:
				isBeverageTerminal && orderMode === "delivery"
					? deliveryAddress || null
					: null,
			estimatedReadyAt: isPickupOrDelivery
				? new Date(Date.now() + estimatedReadyMs).toISOString()
				: null,
			fulfillmentStatus: isPickupOrDelivery ? "pending" : "none",
		});
	}

	// Keyboard shortcuts (F2=Pay, F3=Hold, F4=Clear, F5=Discount, F8=Reprint, F12=Shortcuts)
	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			if (
				e.target instanceof HTMLInputElement ||
				e.target instanceof HTMLTextAreaElement
			)
				return;
			if (e.key === "F2") {
				e.preventDefault();
				if (cart.length > 0) setPaymentOpen(true);
			}
			if (e.key === "F3") {
				e.preventDefault();
				if (cart.length > 0) {
					setHeldOrders((prev) => [...prev, cart]);
					setCart([]);
					setDiscount(0);
					setDiscountLabel("");
				}
			}
			if (e.key === "F4") {
				e.preventDefault();
				setCart([]);
				setDiscount(0);
				setDiscountLabel("");
			}
			if (e.key === "F5") {
				e.preventDefault();
				if (cart.length > 0 && canApplyDiscount) setDiscountOpen(true);
			}
			if (e.key === "F8") {
				e.preventDefault();
				if (lastOrder) setReceiptOpen(true);
			}
			if (e.key === "F12") {
				e.preventDefault();
				setShowShortcuts((s) => !s);
			}
		}
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [cart, lastOrder, canApplyDiscount]);

	useEffect(() => {
		function checkTime() {
			const now = new Date();
			const gyHour = (now.getUTCHours() - 4 + 24) % 24;
			if (gyHour >= 15) {
				setDepartmentOverrideActive(true);
			}
		}
		checkTime();
		const interval = setInterval(checkTime, 60_000);
		return () => clearInterval(interval);
	}, []);

	// Barcode scanner: lookup via API and add to cart
	const lookupBarcode = useMutation(
		orpc.pos.lookupBarcode.mutationOptions({
			onSuccess: (product) => {
				handleProductTap(product as unknown as Product);
			},
			onError: () => {
				toast.error("Product not found for this barcode");
			},
		}),
	);

	useBarcodeScanner(
		(result) => {
			lookupBarcode.mutate({ barcode: result.barcode });
		},
		{ enabled: true },
	);

	const notesItem = cart.find((i) => i.id === notesItemId);

	// Shared cart component
	const cartContent = (
		<CartPanel
			items={cart}
			total={cartTotal}
			tax={cartTax}
			grandTotal={grandTotal}
			discount={discount}
			discountLabel={discountLabel}
			onUpdateQuantity={handleUpdateQuantity}
			onRemoveItem={handleRemoveItem}
			onCheckout={() => {
				setPaymentOpen(true);
				setMobileCartOpen(false);
			}}
			onClearCart={handleClearCart}
			onHoldOrder={handleHoldOrder}
			onOpenDiscount={async () => {
				if (canApplyDiscount) {
					setDiscountOpen(true);
				} else {
					try {
						await requestOverride("discounts.apply");
						setDiscountOpen(true);
					} catch {
						// cancelled — do nothing
					}
				}
			}}
			canApplyDiscount={canApplyDiscount}
			onOpenNotes={(id) => setNotesItemId(id)}
			onApplyPromo={canApplyDiscount ? handleApplyDiscount : undefined}
			orderMode={isBeverageTerminal ? orderMode : undefined}
			customerName={
				selectedCustomer?.name ||
				(isBeverageTerminal ? customerName : undefined)
			}
		/>
	);

	return (
		<div className="flex h-[calc(100dvh-3.5rem)] flex-col">
			{/* Top bar */}
			<div className="flex flex-wrap items-center gap-2 border-border border-b bg-card px-3 py-2 md:gap-3 md:px-4">
				{/* Register selector */}
				<Select
					value={selectedRegister}
					onValueChange={(v) => {
						setSelectedRegister(v);
						setSelectedDepartment("all");
						resetPickupFields();
					}}
				>
					<SelectTrigger className="h-9 w-full shrink-0 text-xs sm:w-44 sm:text-sm">
						<SelectValue placeholder="Select Register" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="c0000000-0000-4000-8000-000000000001">
							Meals POS
						</SelectItem>
						<SelectItem value="c0000000-0000-4000-8000-000000000002">
							Pastry POS
						</SelectItem>
						<SelectItem value="c0000000-0000-4000-8000-000000000003">
							Beverage & Pickup POS
						</SelectItem>
					</SelectContent>
				</Select>

				{/* Department filter */}
				<div className="flex flex-1 items-center gap-1.5 overflow-x-auto py-0.5">
					<Badge
						variant={selectedDepartment === "all" ? "default" : "outline"}
						className="shrink-0 cursor-pointer touch-manipulation px-2.5 py-1 text-xs sm:px-3"
						onClick={() => setSelectedDepartment("all")}
					>
						All
					</Badge>
					{departments.map((dept) => (
						<Badge
							key={dept.id}
							variant={selectedDepartment === dept.id ? "default" : "outline"}
							className="shrink-0 cursor-pointer touch-manipulation px-2.5 py-1 text-xs sm:px-3"
							onClick={() => setSelectedDepartment(dept.id)}
						>
							{dept.name}
						</Badge>
					))}
					{departmentOverrideActive ? (
						<Badge
							variant="outline"
							className="shrink-0 cursor-pointer touch-manipulation border-amber-400 bg-amber-50 px-2.5 py-1 text-amber-700 text-xs sm:px-3 dark:bg-amber-900/20 dark:text-amber-400"
							onClick={() => {
								setDepartmentOverrideActive(false);
								setSelectedDepartment("all");
							}}
						>
							Override Active ✕
						</Badge>
					) : (
						<Badge
							variant="outline"
							className="shrink-0 cursor-pointer touch-manipulation px-2.5 py-1 text-muted-foreground text-xs sm:px-3"
							onClick={async () => {
								try {
									await requestOverride(
										"departments.override",
										"Access All Departments",
									);
									setDepartmentOverrideActive(true);
									setSelectedDepartment("all");
								} catch {
									// cancelled
								}
							}}
						>
							Other Depts
						</Badge>
					)}
				</div>

				{/* Held orders, reprint, shortcuts, user */}
				<div className="flex shrink-0 items-center gap-1.5">
					{heldOrders.map((_held, i) => (
						<button
							key={i}
							className="touch-manipulation rounded border border-primary border-dashed px-2 py-1 font-medium text-primary text-xs hover:bg-primary/10"
							onClick={() => handleRecallOrder(i)}
						>
							Held #{i + 1}
						</button>
					))}
					{/* Customer lookup */}
					<Popover
						open={customerPopoverOpen}
						onOpenChange={setCustomerPopoverOpen}
					>
						<PopoverTrigger asChild>
							{selectedCustomer ? (
								<Button variant="outline" size="sm" className="gap-1.5 text-xs">
									<UserSearch className="size-3.5" />
									{selectedCustomer.name}
									{loyaltyData && (
										<span className="flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 font-semibold text-[10px] text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
											<Star className="size-2.5" />
											{loyaltyData.membership.currentPoints} pts
										</span>
									)}
									<button
										className="ml-1 rounded-full p-0.5 hover:bg-muted"
										onClick={(e) => {
											e.stopPropagation();
											setSelectedCustomer(null);
										}}
									>
										<XIcon className="size-3" />
									</button>
								</Button>
							) : (
								<Button variant="ghost" size="sm" className="gap-1.5 text-xs">
									<UserSearch className="size-3.5" />
									<span className="hidden sm:inline">Customer</span>
								</Button>
							)}
						</PopoverTrigger>
						<PopoverContent className="w-72 p-2" align="end">
							<Input
								placeholder="Search name or phone..."
								value={customerSearchQuery}
								onChange={(e) => setCustomerSearchQuery(e.target.value)}
								className="mb-2 h-8 text-sm"
								autoFocus
							/>
							{customerSearchQuery.length >= 2 && (
								<div className="max-h-48 overflow-y-auto">
									{customerResults.length === 0 ? (
										<p className="py-3 text-center text-muted-foreground text-xs">
											No customers found
										</p>
									) : (
										customerResults.map((c) => (
											<button
												key={c.id}
												className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
												onClick={() => {
													setSelectedCustomer({
														id: c.id,
														name: c.name,
														phone: c.phone,
													});
													setCustomerPopoverOpen(false);
													setCustomerSearchQuery("");
												}}
											>
												<div>
													<span className="font-medium">{c.name}</span>
													{c.phone && (
														<span className="ml-2 text-muted-foreground text-xs">
															{c.phone}
														</span>
													)}
												</div>
												<span className="text-muted-foreground text-xs">
													{c.visitCount} visits
												</span>
											</button>
										))
									)}
								</div>
							)}
						</PopoverContent>
					</Popover>
					<Button
						variant="ghost"
						size="sm"
						className="hidden gap-1.5 text-xs sm:flex"
						onClick={() => setSellGiftCardOpen(true)}
					>
						<Gift className="size-3.5" />
						Sell Gift Card
					</Button>
					{lastOrder && (
						<Button
							variant="ghost"
							size="sm"
							className="hidden gap-1.5 text-xs sm:flex"
							onClick={() => setReceiptOpen(true)}
						>
							<ReceiptText className="size-3.5" />
							Reprint
						</Button>
					)}
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<div className="hidden size-8 items-center justify-center sm:flex">
									<Barcode className="size-3.5 text-muted-foreground" />
									<span className="sr-only">Scanner ready</span>
								</div>
							</TooltipTrigger>
							<TooltipContent side="bottom">Scanner ready</TooltipContent>
						</Tooltip>
					</TooltipProvider>
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="hidden size-8 sm:flex"
									onClick={() => setShowShortcuts((s) => !s)}
								>
									<Keyboard className="size-3.5" />
									<span className="sr-only">Keyboard shortcuts</span>
								</Button>
							</TooltipTrigger>
							<TooltipContent side="bottom">
								Keyboard shortcuts (F12)
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
					<span className="hidden text-muted-foreground text-xs lg:inline">
						{userName}
					</span>
				</div>
			</div>

			{/* Keyboard shortcuts banner */}
			{showShortcuts && (
				<div className="flex flex-wrap items-center gap-3 border-border border-b bg-muted/50 px-4 py-2 text-muted-foreground text-xs">
					<span className="font-medium text-foreground">Shortcuts:</span>
					<span>
						<kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
							F2
						</kbd>{" "}
						Pay
					</span>
					<span>
						<kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
							F3
						</kbd>{" "}
						Hold
					</span>
					<span>
						<kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
							F4
						</kbd>{" "}
						Clear
					</span>
					<span>
						<kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
							F5
						</kbd>{" "}
						Discount
					</span>
					<span>
						<kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
							F8
						</kbd>{" "}
						Reprint
					</span>
					<span>
						<kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
							F12
						</kbd>{" "}
						Toggle this bar
					</span>
					<Button
						variant="ghost"
						size="sm"
						className="ml-auto h-6 text-xs"
						onClick={() => setShowShortcuts(false)}
					>
						Dismiss
					</Button>
				</div>
			)}

			{/* Pickup/Delivery bar (Terminal 3 only) */}
			{isBeverageTerminal && (
				<div className="flex flex-wrap items-end gap-2 border-border border-b bg-muted/30 px-3 py-2 md:gap-3 md:px-4">
					<div className="flex items-center gap-0.5 rounded-lg border border-border bg-background p-0.5">
						<Button
							variant={orderMode === "dine_in" ? "default" : "ghost"}
							size="sm"
							className="h-7 gap-1 px-2 text-xs"
							onClick={() => setOrderMode("dine_in")}
						>
							<ShoppingBag className="size-3" />
							<span className="xs:inline hidden">Walk-in</span>
						</Button>
						<Button
							variant={orderMode === "pickup" ? "default" : "ghost"}
							size="sm"
							className="h-7 gap-1 px-2 text-xs"
							onClick={() => setOrderMode("pickup")}
						>
							<Clock className="size-3" />
							<span className="xs:inline hidden">Pickup</span>
						</Button>
						<Button
							variant={orderMode === "delivery" ? "default" : "ghost"}
							size="sm"
							className="h-7 gap-1 px-2 text-xs"
							onClick={() => setOrderMode("delivery")}
						>
							<Truck className="size-3" />
							<span className="xs:inline hidden">Delivery</span>
						</Button>
					</div>

					{(orderMode === "pickup" || orderMode === "delivery") && (
						<>
							<div className="flex flex-col gap-1">
								<Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
									Customer
								</Label>
								<Input
									value={customerName}
									onChange={(e) => setCustomerName(e.target.value)}
									placeholder="Name"
									className="h-8 w-28 text-sm sm:w-36"
								/>
							</div>
							<div className="flex flex-col gap-1">
								<Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
									Phone
								</Label>
								<Input
									value={customerPhone}
									onChange={(e) => setCustomerPhone(e.target.value)}
									placeholder="+592-..."
									className="h-8 w-24 text-sm sm:w-32"
								/>
							</div>
							<div className="flex flex-col gap-1">
								<Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
									Ready in
								</Label>
								<Select
									value={estimatedReady}
									onValueChange={setEstimatedReady}
								>
									<SelectTrigger className="h-8 w-20 text-sm sm:w-24">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="10">10 min</SelectItem>
										<SelectItem value="15">15 min</SelectItem>
										<SelectItem value="20">20 min</SelectItem>
										<SelectItem value="30">30 min</SelectItem>
										<SelectItem value="45">45 min</SelectItem>
										<SelectItem value="60">60 min</SelectItem>
									</SelectContent>
								</Select>
							</div>
							{orderMode === "delivery" && (
								<div className="flex w-full flex-col gap-1 sm:w-auto">
									<Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
										Address
									</Label>
									<Input
										value={deliveryAddress}
										onChange={(e) => setDeliveryAddress(e.target.value)}
										placeholder="Delivery Address"
										className="h-8 w-full text-sm sm:w-56"
									/>
								</div>
							)}
						</>
					)}

					{/* Order placed / expiry indicator */}
					{lastOrderMeta && lastOrderMeta.mode !== "dine_in" && (
						<div className="ml-auto flex items-center gap-3 text-muted-foreground text-xs">
							<span>
								Last order:{" "}
								{lastOrderMeta.placedAt.toLocaleTimeString("en-GY", {
									hour: "2-digit",
									minute: "2-digit",
									hour12: false,
								})}
							</span>
							{lastOrderMeta?.mode === "pickup" &&
								(() => {
									const expiresAt = new Date(
										lastOrderMeta.placedAt.getTime() + 45 * 60 * 1000,
									);
									const now = new Date();
									const minsLeft = Math.max(
										0,
										Math.round((expiresAt.getTime() - now.getTime()) / 60000),
									);
									return (
										<div
											className={`font-medium text-xs ${minsLeft <= 5 ? "text-red-600" : minsLeft <= 10 ? "text-amber-600" : "text-muted-foreground"}`}
										>
											Pickup expires:{" "}
											{expiresAt.toLocaleTimeString("en-GY", {
												hour: "2-digit",
												minute: "2-digit",
											})}
											{minsLeft > 0 && ` (${minsLeft} min left)`}
										</div>
									);
								})()}
						</div>
					)}
				</div>
			)}

			{/* Main area: product grid + cart */}
			<div className="flex flex-1 overflow-hidden">
				<div className="flex-1 overflow-y-auto p-2 sm:p-3">
					<ProductGrid
						products={products}
						isLoading={isLoading}
						onProductTap={handleProductTap}
						cart={cart}
					/>
				</div>
				<div className="hidden h-full w-72 shrink-0 border-border border-l md:block lg:w-80 xl:w-96">
					{cartContent}
				</div>
			</div>

			{/* Mobile floating cart button */}
			<div className="fixed right-4 bottom-4 z-30 md:hidden">
				<Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
					<SheetTrigger asChild>
						<Button size="lg" className="h-14 w-14 rounded-full shadow-lg">
							<ShoppingCart className="size-5" />
							{cartItemCount > 0 && (
								<span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-destructive font-bold text-destructive-foreground text-xs">
									{cartItemCount}
								</span>
							)}
							<span className="sr-only">Open cart</span>
						</Button>
					</SheetTrigger>
					<SheetContent side="bottom" className="h-[85dvh] rounded-t-2xl p-0">
						<SheetHeader className="sr-only">
							<SheetTitle>Cart</SheetTitle>
						</SheetHeader>
						<div className="flex h-full flex-col">
							<div className="flex justify-center py-2">
								<div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
							</div>
							{cartContent}
						</div>
					</SheetContent>
				</Sheet>
			</div>

			{/* Mobile bottom bar */}
			{cartItemCount > 0 && (
				<div className="flex items-center justify-between border-border border-t bg-card px-4 py-2.5 md:hidden">
					<div>
						<p className="text-muted-foreground text-xs">
							{cartItemCount} items
						</p>
						<p className="font-bold text-base text-foreground">
							{formatGYD(grandTotal)}
						</p>
					</div>
					<Button
						size="sm"
						className="h-10 gap-1.5 px-5 font-semibold text-sm"
						onClick={() => setMobileCartOpen(true)}
					>
						<ShoppingCart className="size-4" />
						View Cart
					</Button>
				</div>
			)}

			{/* Dialogs */}
			<PaymentDialog
				open={paymentOpen}
				onClose={() => setPaymentOpen(false)}
				total={grandTotal}
				items={cart}
				onComplete={handlePaymentComplete}
			/>
			<ReceiptPreview
				open={receiptOpen}
				onOpenChange={setReceiptOpen}
				order={lastOrder}
				items={lastCartSnapshot}
				change={lastChange}
				userName={userName}
			/>
			<DiscountDialog
				open={discountOpen}
				onClose={() => setDiscountOpen(false)}
				subtotal={cartTotal}
				onApply={handleApplyDiscount}
			/>
			{notesItem && (
				<ItemNotesDialog
					open={!!notesItemId}
					onClose={() => setNotesItemId(null)}
					productName={notesItem.product.name}
					currentNotes={notesItem.notes}
					onSave={handleSaveItemNotes}
				/>
			)}
			<SellGiftCardDialog
				open={sellGiftCardOpen}
				onClose={() => setSellGiftCardOpen(false)}
				onComplete={handlePaymentComplete}
			/>
			{SupervisorDialog}
		</div>
	);
}
