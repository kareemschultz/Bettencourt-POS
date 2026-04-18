import { cn } from "@/lib/utils";

export type FloorPlanTable = {
	id?: string;
	name: string;
	section?: string | null;
	seats: number;
	positionX: number;
	positionY: number;
	width: number;
	height: number;
	shape: "square" | "circle" | "rectangle";
	status: "available" | "occupied" | "reserved" | "cleaning";
	currentOrderId?: string | null;
	currentGuests?: number | null;
};

export function TableShape({
	table,
	selected,
	onPointerDown,
	onClick,
}: {
	table: FloorPlanTable;
	selected: boolean;
	onPointerDown?: (event: React.PointerEvent<HTMLButtonElement>) => void;
	onClick?: () => void;
}) {
	const isCircle = table.shape === "circle";
	const borderColor =
		table.status === "occupied"
			? "border-amber-500"
			: table.status === "reserved"
				? "border-violet-500"
				: table.status === "cleaning"
					? "border-red-500"
					: "border-emerald-500";

	return (
		<button
			type="button"
			className={cn(
				"absolute select-none border-2 bg-background/95 p-1 text-center shadow-sm",
				borderColor,
				isCircle ? "rounded-full" : "rounded-md",
				selected ? "ring-2 ring-primary" : "",
			)}
			style={{
				left: table.positionX,
				top: table.positionY,
				width: table.width,
				height: table.height,
			}}
			onPointerDown={onPointerDown}
			onClick={onClick}
		>
			<p className="truncate font-semibold text-xs">{table.name}</p>
			<p className="text-[10px] text-muted-foreground">
				{table.currentGuests
					? `${table.currentGuests}/${table.seats}`
					: `${table.seats} seats`}
			</p>
		</button>
	);
}
