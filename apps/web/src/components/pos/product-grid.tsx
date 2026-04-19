import { useVirtualizer } from "@tanstack/react-virtual";
import { Ban, Loader2 } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
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
}

const deptColors: Record<string, string> = {
	Chicken:
		"bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800",
	Fish: "bg-sky-50 border-sky-200 dark:bg-sky-950/30 dark:border-sky-800",
	Beef: "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800",
	Duck: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800",
	Mutton: "bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-800",
	Veg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800",
	Specials:
		"bg-violet-50 border-violet-200 dark:bg-violet-950/30 dark:border-violet-800",
	Pastry: "bg-pink-50 border-pink-200 dark:bg-pink-950/30 dark:border-pink-800",
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

interface ProductCardProps {
	product: Product;
	qty: number;
	is86: boolean;
	onTap: (p: Product) => void;
	onLongPress?: (p: Product) => void;
}

const ProductCard = memo(function ProductCard({
	product,
	qty,
	is86,
	onTap,
	onLongPress,
}: ProductCardProps) {
	const colorClass = is86
		? "bg-muted border-muted-foreground/20 dark:bg-muted/30"
		: deptColors[product.department_name || ""] || "bg-secondary border-border";

	const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	return (
		<button
			onClick={() => {
				if (!is86) onTap(product);
			}}
			onPointerDown={() => {
				if (onLongPress) {
					longPressTimerRef.current = setTimeout(() => {
						onLongPress(product);
						longPressTimerRef.current = null;
					}, 600);
				}
			}}
			onPointerUp={() => {
				if (longPressTimerRef.current) {
					clearTimeout(longPressTimerRef.current);
					longPressTimerRef.current = null;
				}
			}}
			onPointerLeave={() => {
				if (longPressTimerRef.current) {
					clearTimeout(longPressTimerRef.current);
					longPressTimerRef.current = null;
				}
			}}
			className={cn(
				"relative flex flex-col items-start gap-0.5 rounded-lg border p-2.5 text-left",
				"min-h-[68px] touch-manipulation select-none transition-all",
				"hover:shadow-md hover:brightness-105 active:scale-[0.97] sm:min-h-[76px] sm:gap-1 sm:p-3",
				colorClass,
				qty > 0 && !is86 && "ring-2 ring-primary ring-offset-1",
				is86 &&
					"cursor-not-allowed opacity-50 grayscale hover:shadow-none hover:brightness-100 active:scale-100",
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
			<span
				className={cn(
					"line-clamp-2 font-medium text-xs leading-tight sm:text-sm",
					is86 ? "text-muted-foreground line-through" : "text-foreground",
				)}
			>
				{product.name}
			</span>
			<span
				className={cn(
					"font-bold text-sm sm:text-base",
					is86 ? "text-muted-foreground" : "text-foreground",
				)}
			>
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
});

function getNumCols(): number {
	const w = window.innerWidth;
	if (w >= 1536) return 6;
	if (w >= 1280) return 5;
	if (w >= 1024) return 4;
	if (w >= 640) return 3;
	return 2;
}

const ROW_HEIGHT = 100;

export function ProductGrid({
	products,
	isLoading,
	onProductTap,
	onProductLongPress,
	cart,
	eightySixedIds,
}: ProductGridProps) {
	const parentRef = useRef<HTMLDivElement>(null);
	const [numCols, setNumCols] = useState(getNumCols);

	useEffect(() => {
		const handler = () => setNumCols(getNumCols());
		window.addEventListener("resize", handler);
		return () => window.removeEventListener("resize", handler);
	}, []);

	const cartQtyMap = useMemo(() => {
		const map = new Map<string, number>();
		for (const item of cart) {
			map.set(item.product.id, (map.get(item.product.id) ?? 0) + item.quantity);
		}
		return map;
	}, [cart]);

	const rows = useMemo(() => {
		const result: Product[][] = [];
		for (let i = 0; i < products.length; i += numCols) {
			result.push(products.slice(i, i + numCols));
		}
		return result;
	}, [products, numCols]);

	const virtualizer = useVirtualizer({
		count: rows.length,
		getScrollElement: () => parentRef.current,
		estimateSize: () => ROW_HEIGHT,
		overscan: 3,
	});

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
				No products found for this register/department.
			</div>
		);
	}

	return (
		<div ref={parentRef} className="h-full overflow-y-auto">
			<div
				style={{
					height: `${virtualizer.getTotalSize()}px`,
					position: "relative",
				}}
			>
				{virtualizer.getVirtualItems().map((virtualRow) => (
					<div
						key={virtualRow.key}
						data-index={virtualRow.index}
						ref={virtualizer.measureElement}
						style={{
							position: "absolute",
							top: 0,
							left: 0,
							width: "100%",
							transform: `translateY(${virtualRow.start}px)`,
						}}
					>
						<div className="grid grid-cols-2 gap-1.5 p-1 sm:grid-cols-3 sm:gap-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
							{rows[virtualRow.index]!.map((product) => (
								<ProductCard
									key={product.id}
									product={product}
									qty={cartQtyMap.get(product.id) ?? 0}
									is86={eightySixedIds?.has(product.id) ?? false}
									onTap={onProductTap}
									onLongPress={onProductLongPress}
								/>
							))}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
