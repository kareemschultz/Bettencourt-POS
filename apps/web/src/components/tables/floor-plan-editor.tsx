import { Plus, Save } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { TableShape, type FloorPlanTable } from "./table-shape";

export function FloorPlanEditor({
	tables,
	editable,
	onTablesChange,
	onSave,
	isSaving,
	onSelect,
}: {
	tables: FloorPlanTable[];
	editable: boolean;
	onTablesChange: (tables: FloorPlanTable[]) => void;
	onSave: () => void;
	isSaving?: boolean;
	onSelect?: (table: FloorPlanTable) => void;
}) {
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const dragRef = useRef<{
		id: string;
		offsetX: number;
		offsetY: number;
	} | null>(null);

	const viewSize = useMemo(() => {
		const maxX = Math.max(1200, ...tables.map((t) => t.positionX + t.width + 40));
		const maxY = Math.max(700, ...tables.map((t) => t.positionY + t.height + 40));
		return { width: maxX, height: maxY };
	}, [tables]);

	function addTable() {
		const index = tables.length + 1;
		onTablesChange([
			...tables,
			{
				id: undefined,
				name: `T${index}`,
				section: "Main",
				seats: 4,
				positionX: 80 + (index % 8) * 110,
				positionY: 80 + Math.floor(index / 8) * 110,
				width: 90,
				height: 90,
				shape: "square",
				status: "available",
			},
		]);
	}

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between gap-2">
				<div className="text-sm text-muted-foreground">
					{editable ? "Edit mode: drag tables, then save layout" : "Live floor plan"}
				</div>
				<div className="flex items-center gap-2">
					{editable && (
						<>
							<Button size="sm" variant="outline" onClick={addTable}>
								<Plus className="mr-1 size-3.5" /> Add table
							</Button>
							<Button size="sm" onClick={onSave} disabled={isSaving}>
								<Save className="mr-1 size-3.5" />
								{isSaving ? "Saving..." : "Save layout"}
							</Button>
						</>
					)}
				</div>
			</div>

			<div
				className="relative overflow-auto rounded-xl border bg-muted/20"
				onPointerMove={(event) => {
					if (!editable || !dragRef.current) return;
					const parent = event.currentTarget.getBoundingClientRect();
					const x = Math.max(0, Math.round(event.clientX - parent.left - dragRef.current.offsetX));
					const y = Math.max(0, Math.round(event.clientY - parent.top - dragRef.current.offsetY));
					onTablesChange(
						tables.map((table) => {
							const id = table.id ?? table.name;
							if (id !== dragRef.current?.id) return table;
							return { ...table, positionX: x, positionY: y };
						}),
					);
				}}
				onPointerUp={() => {
					dragRef.current = null;
				}}
				onPointerLeave={() => {
					dragRef.current = null;
				}}
			>
				<div
					className="relative"
					style={{
						width: viewSize.width,
						height: viewSize.height,
						backgroundImage:
							"radial-gradient(circle at 1px 1px, hsl(var(--muted-foreground)/0.2) 1px, transparent 0)",
						backgroundSize: "24px 24px",
					}}
				>
					{tables.map((table) => {
						const id = table.id ?? table.name;
						return (
							<TableShape
								key={id}
								table={table}
								selected={selectedId === id}
								onClick={() => {
									setSelectedId(id);
									onSelect?.(table);
								}}
								onPointerDown={(event) => {
									if (!editable) return;
									event.preventDefault();
									const rect = event.currentTarget.getBoundingClientRect();
									dragRef.current = {
										id,
										offsetX: event.clientX - rect.left,
										offsetY: event.clientY - rect.top,
									};
								}}
							/>
						);
					})}
				</div>
			</div>
		</div>
	);
}
