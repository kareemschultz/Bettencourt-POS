import { Check, Clock, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

type KdsItem = {
	id: string;
	productName: string;
	quantity: number;
	notes: string | null;
	modifiers: string | null;
	status: string;
	courseNumber: number | null;
	firedAt: string | Date | null;
	completedAt: string | Date | null;
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
	return Math.max(
		0,
		Math.floor((Date.now() - new Date(from).getTime()) / 60000),
	);
}

function cardTone(minutes: number) {
	if (minutes >= 15) return "border-red-500 bg-red-500/10";
	if (minutes >= 10) return "border-orange-500 bg-orange-500/10";
	if (minutes >= 5) return "border-yellow-500 bg-yellow-500/10";
	return "border-border bg-background";
}

function groupByCourse(items: KdsItem[]) {
	const groups = new Map<number, KdsItem[]>();
	for (const item of items) {
		const course = item.courseNumber ?? 1;
		if (!groups.has(course)) groups.set(course, []);
		groups.get(course)?.push(item);
	}
	return Array.from(groups.entries()).sort(([a], [b]) => a - b);
}

export function KdsOrderCard({
	order,
	onBumpItem,
	onFireCourse,
}: {
	order: KdsOrder;
	onBumpItem: (itemId: string) => void;
	onFireCourse?: (ticketId: string, courseNumber: number) => void;
}) {
	const mins = elapsedMinutes(order.createdAt);
	const courseGroups = groupByCourse(order.items);
	const hasMultipleCourses = courseGroups.length > 1;

	return (
		<div className={`rounded-lg border p-3 ${cardTone(mins)}`}>
			<div className="mb-2 flex items-center justify-between">
				<p className="font-bold text-base">#{order.orderNumber}</p>
				<p className="flex items-center gap-1 text-xs">
					<Clock className="size-3" />
					{mins}m
				</p>
			</div>
			<div className="mb-3 flex items-center gap-2 text-xs">
				{order.tableName ? <span>Table {order.tableName}</span> : null}
				{order.orderType ? (
					<span className="rounded bg-muted px-1.5 py-0.5 uppercase">
						{order.orderType}
					</span>
				) : null}
			</div>
			<div className="space-y-2">
				{courseGroups.map(([courseNum, items]) => {
					const allFired = items.every((i) => i.firedAt);
					const allDone = items.every((i) => i.status === "done");

					return (
						<div key={courseNum}>
							{hasMultipleCourses && (
								<div className="mb-1 flex items-center justify-between">
									<span className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
										Course {courseNum}
									</span>
									{onFireCourse && !allFired && !allDone && (
										<button
											type="button"
											onClick={() => onFireCourse(order.id, courseNum)}
											className="flex items-center gap-1 rounded bg-orange-500 px-2 py-0.5 font-medium text-[10px] text-white hover:bg-orange-600"
										>
											<Flame className="size-3" />
											Fire
										</button>
									)}
									{allDone && (
										<span className="flex items-center gap-1 text-[10px] text-green-600">
											<Check className="size-3" /> Done
										</span>
									)}
								</div>
							)}
							{items.map((item) => (
								<button
									type="button"
									key={item.id}
									onClick={() => onBumpItem(item.id)}
									className={cn(
										"w-full rounded border bg-background px-2 py-1.5 text-left hover:bg-muted/40",
										item.status === "done" && "line-through opacity-40",
										item.firedAt &&
											item.status !== "done" &&
											"border-orange-300 bg-orange-50 dark:bg-orange-950/20",
									)}
								>
									<div className="flex justify-between text-sm">
										<span>{item.productName}</span>
										<span>x{item.quantity}</span>
									</div>
									{item.notes ? (
										<p className="text-[10px] text-amber-600">{item.notes}</p>
									) : null}
								</button>
							))}
						</div>
					);
				})}
			</div>
		</div>
	);
}
