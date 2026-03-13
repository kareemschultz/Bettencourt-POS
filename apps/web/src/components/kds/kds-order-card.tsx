import { Clock } from "lucide-react";

type KdsItem = {
	id: string;
	productName: string;
	quantity: number;
	notes: string | null;
	modifiers: string | null;
	status: string;
};

type KdsOrder = {
	id: string;
	orderNumber: string;
	orderType: string | null;
	tableName: string | null;
	createdAt: string | Date;
	items: KdsItem[];
};

function elapsedMinutes(from: string | Date) {
	return Math.max(0, Math.floor((Date.now() - new Date(from).getTime()) / 60000));
}

function cardTone(minutes: number) {
	if (minutes >= 15) return "border-red-500 bg-red-500/10";
	if (minutes >= 10) return "border-orange-500 bg-orange-500/10";
	if (minutes >= 5) return "border-yellow-500 bg-yellow-500/10";
	return "border-border bg-background";
}

export function KdsOrderCard({
	order,
	onBumpItem,
}: {
	order: KdsOrder;
	onBumpItem: (itemId: string) => void;
}) {
	const mins = elapsedMinutes(order.createdAt);
	return (
		<div className={`rounded-lg border p-3 ${cardTone(mins)}`}>
			<div className="mb-2 flex items-center justify-between">
				<p className="font-bold text-base">#{order.orderNumber}</p>
				<p className="flex items-center gap-1 text-xs"><Clock className="size-3" />{mins}m</p>
			</div>
			<div className="mb-3 flex items-center gap-2 text-xs">
				{order.tableName ? <span>Table {order.tableName}</span> : null}
				{order.orderType ? <span className="rounded bg-muted px-1.5 py-0.5 uppercase">{order.orderType}</span> : null}
			</div>
			<div className="space-y-2">
				{order.items.map((item) => (
					<button
						type="button"
						key={item.id}
						onClick={() => onBumpItem(item.id)}
						className="w-full rounded border bg-background px-2 py-1.5 text-left hover:bg-muted/40"
					>
						<div className="flex justify-between text-sm">
							<span>{item.productName}</span>
							<span>x{item.quantity}</span>
						</div>
						{item.notes ? <p className="text-[10px] text-amber-600">{item.notes}</p> : null}
					</button>
				))}
			</div>
		</div>
	);
}
