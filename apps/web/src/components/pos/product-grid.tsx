import { Ban, Loader2 } from "lucide-react";
import type { CartItem, Product } from "@/lib/types";
import { formatGYD } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ProductGridProps {
	products: Product[];
	isLoading: boolean;
	onProductTap: (product: Product) => void;
	onProductLongPress?: (product: Product) => void;
	cart: CartItem[];
	eightySixedIds?: Set<string>;
	emptyMessage?: string;
}

const deptColors: Record<string, string> = {
	Chicken:
		"bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800",
	Fish: "bg-sky-50 border-sky-200 dark:bg-sky-950/30 dark:border-sky-800",
	Beef: "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800",
	Duck: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800",
	Mutton: "bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-800",
	Veg:
		"bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800",
	Specials:
		"bg-violet-50 border-violet-200 dark:bg-violet-950/30 dark:border-violet-800",
	Pastry:
		"bg-pink-50 border-pink-200 dark:bg-pink-950/30 dark:border-pink-800",
	Snacks:
		"bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800",
	Beverages:
		"bg-cyan-50 border-cyan-200 dark:bg-cyan-950/30 dark:border-cyan-800",
	Sides:
		"bg-stone-50 border-stone-200 dark:bg-stone-950/30 dark:border-stone-800",
	"Local Juice":
		"bg-lime-50 border-lime-200 dark:bg-lime-950/30 dark:border-lime-800",
	Shakes:
		"bg-indigo-50 border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-800",
	"Meat Cookup":
		"bg-orange-50 border-orange-300 dark:bg-orange-950/40 dark:border-orange-700",
	Boxes:
		"bg-slate-50 border-slate-200 dark:bg-slate-950/30 dark:border-slate-800",
};

export function ProductGrid({
	products,
	isLoading,
	onProductTap,
	onProductLongPress,
	cart,
	eightySixedIds,
	emptyMessage = "No products found for this register/department.",
}: ProductGridProps) {
	if (isLoading) {
		return (
			<div className="flex h-64 items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (products.length === 0) {
		return (
			<div className="flex h-64 items-center justify-center text-muted-foreground">
				{emptyMessage}
			</div>
		);
	}

	return (
		<div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
			{products.map((product) => {
				const qty = cart
					.filter((item) => item.product.id === product.id)
					.reduce((sum, item) => sum + item.quantity, 0);

				const is86 = eightySixedIds?.has(product.id) ?? false;
				const colorClass = is86
					? "bg-muted border-muted-foreground/20 dark:bg-muted/30"
					: deptColors[product.department_name || ""] ||
						"bg-secondary border-border";

				let longPressTimer: ReturnType<typeof setTimeout> | null = null;

				return (
					<button
						key={product.id}
						onClick={() => {
							if (!is86) onProductTap(product);
						}}
						onPointerDown={() => {
							if (onProductLongPress) {
								longPressTimer = setTimeout(() => {
									onProductLongPress(product);
									longPressTimer = null;
								}, 600);
							}
						}}
						onPointerUp={() => {
							if (longPressTimer) {
								clearTimeout(longPressTimer);
								longPressTimer = null;
							}
						}}
						onPointerLeave={() => {
							if (longPressTimer) {
								clearTimeout(longPressTimer);
								longPressTimer = null;
							}
						}}
						className={cn(
							"relative flex flex-col items-start gap-0.5 rounded-lg border p-2.5 text-left",
							"min-h-[68px] touch-manipulation select-none transition-all",
							"hover:shadow-md hover:brightness-105 active:scale-[0.97] sm:min-h-[76px] sm:gap-1 sm:p-3",
							colorClass,
							qty > 0 && !is86 && "ring-2 ring-primary ring-offset-1",
							is86 && "cursor-not-allowed opacity-50 grayscale hover:shadow-none hover:brightness-100 active:scale-100",
						)}
					>
						{is86 && (
							<span className="absolute inset-0 flex items-center justify-center">
								<Ban className="h-8 w-8 text-destructive/60" />
							</span>
						)}
						{qty > 0 && !is86 && (
							<span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary font-bold text-[10px] text-primary-foreground sm:h-6 sm:w-6 sm:text-xs">
								{qty}
							</span>
						)}
						<span className={cn(
							"line-clamp-2 font-medium text-xs leading-tight sm:text-sm",
							is86 ? "text-muted-foreground line-through" : "text-foreground",
						)}>
							{product.name}
						</span>
						<span className={cn(
							"font-bold text-sm sm:text-base",
							is86 ? "text-muted-foreground" : "text-foreground",
						)}>
							{formatGYD(product.price)}
						</span>
						{product.department_name && (
							<span className="text-[9px] text-muted-foreground sm:text-[10px]">
								{product.department_name}
							</span>
						)}
						{is86 && (
							<span className="absolute right-1 bottom-1 rounded bg-destructive/80 px-1 py-0.5 font-bold text-[8px] text-destructive-foreground">
								86
							</span>
						)}
					</button>
				);
			})}
		</div>
	);
}
