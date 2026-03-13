import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Armchair,
	CheckCircle2,
	Clock,
	LayoutGrid,
	Loader2,
	Map as MapIcon,
	Pencil,
	Plus,
	Sparkles,
	Timer,
	Trash2,
	Users,
	QrCode,
	UtensilsCrossed,
	X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { FloorPlanEditor } from "@/components/tables/floor-plan-editor";
import type { FloorPlanTable } from "@/components/tables/table-shape";
import { useWebSocket } from "@/hooks/use-websocket";
import { formatGYD } from "@/lib/types";
import { printTableQrCodes } from "@/lib/qr-code";
import { orpc } from "@/utils/orpc";

// ── Status config ────────────────────────────────────────────────────────

const statusConfig: Record<
	string,
	{
		bg: string;
		ring: string;
		badge: string;
		icon: React.ReactNode;
		label: string;
		floorFill: string;
		floorStroke: string;
	}
> = {
	available: {
		bg: "bg-emerald-500/10",
		ring: "",
		badge:
			"bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:text-emerald-400",
		icon: <CheckCircle2 className="size-3.5" />,
		label: "Available",
		floorFill: "fill-emerald-100 dark:fill-emerald-900/40",
		floorStroke: "stroke-emerald-400 dark:stroke-emerald-600",
	},
	occupied: {
		bg: "bg-sky-500/10",
		ring: "ring-1 ring-sky-200 dark:ring-sky-800",
		badge: "bg-sky-500/10 text-sky-600 border-sky-200 dark:text-sky-400",
		icon: <UtensilsCrossed className="size-3.5" />,
		label: "Occupied",
		floorFill: "fill-amber-100 dark:fill-amber-900/40",
		floorStroke: "stroke-amber-500 dark:stroke-amber-600",
	},
	reserved: {
		bg: "bg-amber-500/10",
		ring: "ring-1 ring-amber-200 dark:ring-amber-800",
		badge:
			"bg-amber-500/10 text-amber-600 border-amber-200 dark:text-amber-400",
		icon: <Clock className="size-3.5" />,
		label: "Reserved",
		floorFill: "fill-violet-100 dark:fill-violet-900/40",
		floorStroke: "stroke-violet-400 dark:stroke-violet-600",
	},
	cleaning: {
		bg: "bg-purple-500/10",
		ring: "ring-1 ring-purple-200 dark:ring-purple-800",
		badge:
			"bg-purple-500/10 text-purple-600 border-purple-200 dark:text-purple-400",
		icon: <Sparkles className="size-3.5" />,
		label: "Cleaning",
		floorFill: "fill-red-100 dark:fill-red-900/40",
		floorStroke: "stroke-red-400 dark:stroke-red-600",
	},
};

// ── Types ─────────────────────────────────────────────────────────────────

type TableRow = {
	id: string;
	locationId: string;
	name: string;
	section: string | null;
	seats: number;
	positionX: number;
	positionY: number;
	shape: string;
	status: string;
	currentOrderId: string | null;
	currentGuests: number | null;
	createdAt: Date | null;
	updatedAt: Date | null;
	activeOrderId: string | null;
	activeOrderNumber: string | null;
	activeOrderTotal: string | null;
	orderStatus: string | null;
	orderCreatedAt: Date | null;
};

// ── Helpers ────────────────────────────────────────────────────────────

function elapsedMinutes(from: Date | string | null): string {
	if (!from) return "";
	const ms = Date.now() - new Date(from).getTime();
	const mins = Math.floor(ms / 60000);
	if (mins < 1) return "< 1m";
	if (mins < 60) return `${mins}m`;
	const hrs = Math.floor(mins / 60);
	return `${hrs}h ${mins % 60}m`;
}

// ── Component ────────────────────────────────────────────────────────────

export default function TablesPage() {
	const queryClient = useQueryClient();
	const [viewMode, setViewMode] = useState<"grid" | "floor">("grid");
	const [selectedTable, setSelectedTable] = useState<TableRow | null>(null);
	const [showAddDialog, setShowAddDialog] = useState(false);
	const [editTable, setEditTable] = useState<TableRow | null>(null);
	const [confirmDelete, setConfirmDelete] = useState<TableRow | null>(null);
	const [selectedLocationId, setSelectedLocationId] = useState("");
	const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);
	const [editFloorMode, setEditFloorMode] = useState(false);
	const [draftTables, setDraftTables] = useState<FloorPlanTable[]>([]);
	const [newFloorName, setNewFloorName] = useState("Main Floor");

	// ── Queries ──────────────────────────────────────────────────────────

	const { data: tables = [], isLoading } = useQuery({
		...orpc.tables.list.queryOptions({ input: {} }),
		refetchInterval: 10000,
	});

	const { data: locations = [] } = useQuery(
		orpc.settings.getLocations.queryOptions({ input: {} }),
	);
	const { data: floors = [] } = useQuery({
		...orpc.floorPlan.listFloors.queryOptions({
			input: { locationId: selectedLocationId || defaultLocationId },
		}),
		enabled: !!(selectedLocationId || defaultLocationId),
	});

	const { data: floorTables = [] } = useQuery({
		...orpc.floorPlan.listTables.queryOptions({
			input: {
				locationId: selectedLocationId || defaultLocationId,
				floorId: selectedFloorId,
			},
		}),
		enabled: !!(selectedLocationId || defaultLocationId),
	});

	useEffect(() => {
		setDraftTables(
			floorTables.map((t) => ({
				id: t.id,
				name: t.name,
				section: t.section,
				seats: t.seats,
				positionX: t.positionX,
				positionY: t.positionY,
				width: t.width,
				height: t.height,
				shape: t.shape as FloorPlanTable["shape"],
				status: t.status as FloorPlanTable["status"],
				currentOrderId: t.currentOrderId,
				currentGuests: t.currentGuests,
			})),
		);
	}, [floorTables]);
	useEffect(() => {
		if (!selectedLocationId && defaultLocationId) {
			setSelectedLocationId(defaultLocationId);
		}
	}, [selectedLocationId, defaultLocationId]);

	// ── Mutations ────────────────────────────────────────────────────────

	const invalidate = () => {
		queryClient.invalidateQueries({
			queryKey: orpc.tables.list.queryOptions({ input: {} }).queryKey,
		});
	};

	const updateStatusMut = useMutation(
		orpc.tables.updateStatus.mutationOptions({
			onSuccess: () => {
				invalidate();
				setSelectedTable(null);
				toast.success("Table status updated");
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const clearTableMut = useMutation(
		orpc.tables.clearTable.mutationOptions({
			onSuccess: () => {
				invalidate();
				setSelectedTable(null);
				toast.success("Table cleared");
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const createTableMut = useMutation(
		orpc.tables.create.mutationOptions({
			onSuccess: (data) => {
				invalidate();
				setShowAddDialog(false);
				toast.success(`Table "${data.name}" created`);
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const updateTableMut = useMutation(
		orpc.tables.update.mutationOptions({
			onSuccess: () => {
				invalidate();
				setEditTable(null);
				toast.success("Table updated");
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const deleteTableMut = useMutation(
		orpc.tables.remove.mutationOptions({
			onSuccess: () => {
				invalidate();
				setConfirmDelete(null);
				toast.success("Table removed");
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const createFloorMut = useMutation(
		orpc.floorPlan.createFloor.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.floorPlan.listFloors.queryOptions({
						input: { locationId: selectedLocationId || defaultLocationId },
					}).queryKey,
				});
				toast.success("Floor created");
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const saveFloorLayoutMut = useMutation(
		orpc.floorPlan.saveTableBatch.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.floorPlan.listTables.queryOptions({
						input: {
							locationId: selectedLocationId || defaultLocationId,
							floorId: selectedFloorId,
						},
					}).queryKey,
				});
				toast.success("Floor layout saved");
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	// ── Derived data ─────────────────────────────────────────────────────

	const sections = useMemo(() => {
		const map: Record<string, TableRow[]> = {};
		for (const table of tables as TableRow[]) {
			const section = table.section || "Main";
			if (!map[section]) map[section] = [];
			map[section].push(table);
		}
		return map;
	}, [tables]);

	const counts = useMemo(() => {
		const c: Record<string, number> = {};
		for (const t of tables) {
			c[t.status] = (c[t.status] || 0) + 1;
		}
		return c;
	}, [tables]);


	useWebSocket({
		channels: ["pos:tables"],
		onMessage: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.tables.list.queryOptions({ input: {} }).queryKey,
			});
			if (selectedLocationId || defaultLocationId) {
				queryClient.invalidateQueries({
					queryKey: orpc.floorPlan.listTables.queryOptions({
						input: {
							locationId: selectedLocationId || defaultLocationId,
							floorId: selectedFloorId,
						},
					}).queryKey,
				});
			}
		},
	});

	// ── Render ───────────────────────────────────────────────────────────

	return (
		<div className="flex flex-col gap-6 p-4 md:p-6">
			{/* Header */}
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="font-bold text-foreground text-xl tracking-tight sm:text-2xl">
						Table Management
					</h1>
					<p className="text-muted-foreground text-sm">
						{tables.length} table{tables.length !== 1 ? "s" : ""} &middot;{" "}
						{counts.occupied || 0} occupied &middot; {counts.available || 0}{" "}
						available
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					{/* Status badges */}
					{Object.entries(statusConfig).map(([key, cfg]) => {
						const count = counts[key] || 0;
						if (count === 0) return null;
						return (
							<Badge
								key={key}
								variant="outline"
								className={`gap-1 ${cfg.badge}`}
							>
								{cfg.icon} {count} {cfg.label}
							</Badge>
						);
					})}

					{/* View toggle */}
					<div className="ml-2 flex rounded-lg border p-0.5">
						<Button
							variant={viewMode === "grid" ? "default" : "ghost"}
							size="sm"
							className="h-7 px-2"
							onClick={() => setViewMode("grid")}
						>
							<LayoutGrid className="size-3.5" />
						</Button>
						<Button
							variant={viewMode === "floor" ? "default" : "ghost"}
							size="sm"
							className="h-7 px-2"
							onClick={() => setViewMode("floor")}
						>
							<MapIcon className="size-3.5" />
						</Button>
					</div>

					{/* Add table button */}
					<Button
						variant="outline"
						size="sm"
						className="h-8 gap-1"
						onClick={() => {
							const tableList = (tables as Array<{ id: string; name: string }>).map((t) => ({
								id: t.id,
								name: t.name,
							}));
							printTableQrCodes(tableList, window.location.origin);
						}}
						disabled={!tables || tables.length === 0}
					>
						<QrCode className="size-3.5" /> Print QR Codes
					</Button>
					<Button
						size="sm"
						className="h-8 gap-1"
						onClick={() => setShowAddDialog(true)}
					>
						<Plus className="size-3.5" /> Add Table
					</Button>
				</div>
			</div>

			{/* Content */}
			{isLoading ? (
				<div className="space-y-4">
					<Skeleton className="h-8 w-48" />
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
						{Array.from({ length: 5 }).map((_, i) => (
							<Skeleton key={i} className="h-32 w-full" />
						))}
					</div>
				</div>
			) : tables.length === 0 ? (
				<div className="flex flex-col items-center justify-center gap-3 py-20">
					<Armchair className="size-12 text-muted-foreground/50" />
					<p className="text-muted-foreground">No tables configured</p>
					<Button
						variant="outline"
						size="sm"
						onClick={() => setShowAddDialog(true)}
					>
						<Plus className="mr-1.5 size-3.5" /> Add Your First Table
					</Button>
				</div>
			) : viewMode === "floor" ? (
				<div className="space-y-3">
					<div className="flex flex-wrap items-end gap-2">
						<div className="w-44">
							<Label className="mb-1 block text-xs">Location</Label>
							<Select value={selectedLocationId || defaultLocationId} onValueChange={setSelectedLocationId}>
								<SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
								<SelectContent>
									{locations.map((loc) => (
										<SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="w-44">
							<Label className="mb-1 block text-xs">Floor</Label>
							<Select value={selectedFloorId ?? "__none__"} onValueChange={(v) => setSelectedFloorId(v === "__none__" ? null : v)}>
								<SelectTrigger className="h-8"><SelectValue placeholder="No floor" /></SelectTrigger>
								<SelectContent>
									<SelectItem value="__none__">No floor</SelectItem>
									{floors.map((f) => (
										<SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="flex items-center gap-2">
							<Input className="h-8 w-40" value={newFloorName} onChange={(e)=>setNewFloorName(e.target.value)} placeholder="New floor" />
							<Button size="sm" variant="outline" className="h-8" onClick={() => createFloorMut.mutate({ locationId: selectedLocationId || defaultLocationId, name: newFloorName })} disabled={!newFloorName.trim() || createFloorMut.isPending}>Create floor</Button>
							<Button size="sm" className="h-8" variant={editFloorMode ? "default" : "outline"} onClick={() => setEditFloorMode((v)=>!v)}>{editFloorMode ? "Live mode" : "Edit mode"}</Button>
						</div>
					</div>
					<FloorPlanEditor
						tables={draftTables}
						editable={editFloorMode}
						onTablesChange={setDraftTables}
						onSave={() =>
							saveFloorLayoutMut.mutate({
								locationId: selectedLocationId || defaultLocationId,
								floorId: selectedFloorId,
								tables: draftTables.map((t) => ({
									id: t.id,
									name: t.name,
									section: t.section ?? null,
									seats: t.seats,
									positionX: t.positionX,
									positionY: t.positionY,
									width: t.width,
									height: t.height,
									shape: t.shape,
									status: t.status,
								})),
								removeMissing: false,
							})
						}
						isSaving={saveFloorLayoutMut.isPending}
						onSelect={(t) => {
							const found = (tables as TableRow[]).find((x) => x.id === t.id);
							if (found) setSelectedTable(found);
						}}
					/>
				</div>
			) : (
				/* Grid view */
				Object.entries(sections).map(([section, sectionTables]) => (
					<div key={section}>
						<h2 className="mb-3 font-semibold text-muted-foreground text-sm uppercase tracking-wide">
							{section}
						</h2>
						<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
							{sectionTables.map((table: TableRow) => (
								<TableCard
									key={table.id}
									table={table}
									onSelect={() => setSelectedTable(table)}
									onEdit={() => setEditTable(table)}
								/>
							))}
						</div>
					</div>
				))
			)}

			{/* Table detail sheet */}
			{selectedTable && (
				<TableDetailDialog
					table={selectedTable}
					open={!!selectedTable}
					onClose={() => setSelectedTable(null)}
					onStatusChange={(status) =>
						updateStatusMut.mutate({
							tableId: selectedTable.id,
							status: status as
								| "available"
								| "occupied"
								| "reserved"
								| "cleaning",
						})
					}
					onClear={() => clearTableMut.mutate({ tableId: selectedTable.id })}
					onEdit={() => {
						setEditTable(selectedTable);
						setSelectedTable(null);
					}}
					onDelete={() => {
						setConfirmDelete(selectedTable);
						setSelectedTable(null);
					}}
					isProcessing={updateStatusMut.isPending || clearTableMut.isPending}
				/>
			)}

			{/* Add table dialog */}
			{showAddDialog && (
				<AddEditTableDialog
					open={showAddDialog}
					onClose={() => setShowAddDialog(false)}
					onSubmit={(data) =>
						createTableMut.mutate({ ...data, locationId: defaultLocationId })
					}
					isProcessing={createTableMut.isPending}
				/>
			)}

			{/* Edit table dialog */}
			{editTable && (
				<AddEditTableDialog
					open={!!editTable}
					table={editTable}
					onClose={() => setEditTable(null)}
					onSubmit={(data) =>
						updateTableMut.mutate({ id: editTable.id, ...data })
					}
					isProcessing={updateTableMut.isPending}
				/>
			)}

			{/* Delete confirmation */}
			{confirmDelete && (
				<Dialog
					open={!!confirmDelete}
					onOpenChange={() => setConfirmDelete(null)}
				>
					<DialogContent className="max-w-xs">
						<DialogHeader>
							<DialogTitle>Delete Table</DialogTitle>
							<DialogDescription>
								Are you sure you want to delete{" "}
								<strong>{confirmDelete.name}</strong>? This cannot be undone.
							</DialogDescription>
						</DialogHeader>
						<DialogFooter>
							<Button variant="outline" onClick={() => setConfirmDelete(null)}>
								Cancel
							</Button>
							<Button
								variant="destructive"
								onClick={() => deleteTableMut.mutate({ id: confirmDelete.id })}
								disabled={deleteTableMut.isPending}
							>
								{deleteTableMut.isPending ? (
									<Loader2 className="mr-1.5 size-4 animate-spin" />
								) : (
									<Trash2 className="mr-1.5 size-4" />
								)}
								Delete
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			)}
		</div>
	);
}

// ── Table Card Component ──────────────────────────────────────────────────

function TableCard({
	table,
	onSelect,
	onEdit,
}: {
	table: TableRow;
	onSelect: () => void;
	onEdit: () => void;
}) {
	const config = statusConfig[table.status] || statusConfig.available!;

	return (
		<Card
			className={`group relative cursor-pointer overflow-hidden transition-all hover:shadow-md ${config.ring}`}
			onClick={onSelect}
		>
			<CardContent className="flex flex-col gap-2 p-3">
				<div className="flex items-center justify-between">
					<span className="font-bold text-foreground text-sm">
						{table.name}
					</span>
					<Badge
						variant="outline"
						className={`gap-1 text-[10px] ${config.badge}`}
					>
						{config.icon} {config.label}
					</Badge>
				</div>

				<div className="flex items-center gap-3 text-muted-foreground text-xs">
					<span className="flex items-center gap-1">
						<Users className="size-3" /> {table.currentGuests ?? table.seats}
						{table.currentGuests ? `/${table.seats}` : ""}
					</span>
					<span className="capitalize">{table.shape}</span>
				</div>

				{table.activeOrderId && (
					<div className="mt-1 rounded-md bg-muted/50 p-2 text-xs">
						<div className="flex items-center justify-between">
							<span className="font-medium text-foreground">
								#{String(table.activeOrderNumber ?? "")}
							</span>
							<span className="font-mono text-foreground">
								{formatGYD(Number(table.activeOrderTotal ?? 0))}
							</span>
						</div>
						<div className="mt-1 flex items-center justify-between">
							{table.orderStatus && (
								<Badge variant="secondary" className="text-[10px]">
									{String(table.orderStatus)}
								</Badge>
							)}
							{table.orderCreatedAt && (
								<span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
									<Timer className="size-3" />{" "}
									{elapsedMinutes(table.orderCreatedAt)}
								</span>
							)}
						</div>
					</div>
				)}

				{/* Hover edit button */}
				<button
					type="button"
					className="absolute top-2 right-8 rounded-md p-1 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
					onClick={(e) => {
						e.stopPropagation();
						onEdit();
					}}
					aria-label={`Edit ${table.name}`}
				>
					<Pencil className="size-3 text-muted-foreground" />
				</button>
			</CardContent>
		</Card>
	);
}

// ── Floor Plan Component ──────────────────────────────────────────────────

function FloorPlan({
	tables,
	onSelect,
}: {
	tables: TableRow[];
	onSelect: (t: TableRow) => void;
}) {
	// Calculate bounds for SVG viewBox
	const maxX = Math.max(...tables.map((t) => t.positionX + 120), 800);
	const maxY = Math.max(...tables.map((t) => t.positionY + 120), 600);

	return (
		<div className="overflow-auto rounded-xl border bg-muted/20 p-2">
			<svg
				viewBox={`0 0 ${maxX} ${maxY}`}
				className="min-h-[400px] w-full"
				role="img"
				aria-label="Restaurant floor plan"
			>
				{/* Grid pattern */}
				<defs>
					<pattern
						id="grid"
						width="50"
						height="50"
						patternUnits="userSpaceOnUse"
					>
						<path
							d="M 50 0 L 0 0 0 50"
							fill="none"
							className="stroke-muted-foreground/10"
							strokeWidth="0.5"
						/>
					</pattern>
				</defs>
				<rect width="100%" height="100%" fill="url(#grid)" />

				{tables.map((table) => {
					const config = statusConfig[table.status] || statusConfig.available!;
					const x = table.positionX;
					const y = table.positionY;
					const size =
						table.shape === "rectangle" ? { w: 100, h: 60 } : { w: 80, h: 80 };

					return (
						// biome-ignore lint/a11y/useSemanticElements: SVG <g> cannot be replaced with <button>
						<g
							key={table.id}
							className="cursor-pointer"
							onClick={() => onSelect(table)}
							role="button"
							tabIndex={0}
							aria-label={`${table.name} - ${config.label}`}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") onSelect(table);
							}}
						>
							{table.shape === "circle" ? (
								<circle
									cx={x + 40}
									cy={y + 40}
									r={38}
									className={`${config.floorFill} ${config.floorStroke}`}
									strokeWidth="2"
								/>
							) : (
								<rect
									x={x}
									y={y}
									width={size.w}
									height={size.h}
									rx={table.shape === "square" ? 8 : 12}
									className={`${config.floorFill} ${config.floorStroke}`}
									strokeWidth="2"
								/>
							)}

							{/* Table name */}
							<text
								x={table.shape === "rectangle" ? x + size.w / 2 : x + 40}
								y={table.shape === "rectangle" ? y + size.h / 2 - 6 : y + 36}
								textAnchor="middle"
								className="fill-foreground font-bold text-xs"
								style={{ fontSize: "12px" }}
							>
								{table.name}
							</text>

							{/* Guests / seats */}
							<text
								x={table.shape === "rectangle" ? x + size.w / 2 : x + 40}
								y={table.shape === "rectangle" ? y + size.h / 2 + 10 : y + 52}
								textAnchor="middle"
								className="fill-muted-foreground"
								style={{ fontSize: "10px" }}
							>
								{table.currentGuests
									? `${table.currentGuests}/${table.seats}`
									: `${table.seats} seats`}
							</text>

							{/* Order info */}
							{table.activeOrderNumber && (
								<text
									x={table.shape === "rectangle" ? x + size.w / 2 : x + 40}
									y={table.shape === "rectangle" ? y + size.h / 2 + 24 : y + 66}
									textAnchor="middle"
									className="fill-foreground"
									style={{ fontSize: "9px", fontFamily: "monospace" }}
								>
									#{table.activeOrderNumber}
								</text>
							)}
						</g>
					);
				})}
			</svg>
		</div>
	);
}

// ── Table Detail Dialog ───────────────────────────────────────────────────

function TableDetailDialog({
	table,
	open,
	onClose,
	onStatusChange,
	onClear,
	onEdit,
	onDelete,
	isProcessing,
}: {
	table: TableRow;
	open: boolean;
	onClose: () => void;
	onStatusChange: (status: string) => void;
	onClear: () => void;
	onEdit: () => void;
	onDelete: () => void;
	isProcessing: boolean;
}) {
	const config = statusConfig[table.status] || statusConfig.available!;

	return (
		<Dialog
			open={open}
			onOpenChange={(o) => {
				if (!o) onClose();
			}}
		>
			<DialogContent className="max-w-[calc(100vw-2rem)] rounded-xl sm:max-w-sm">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						{table.name}
						<Badge variant="outline" className={`gap-1 ${config.badge}`}>
							{config.icon} {config.label}
						</Badge>
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					{/* Info */}
					<div className="grid grid-cols-2 gap-3 text-sm">
						<div>
							<span className="text-muted-foreground">Seats</span>
							<p className="font-medium">{table.seats}</p>
						</div>
						<div>
							<span className="text-muted-foreground">Shape</span>
							<p className="font-medium capitalize">{table.shape}</p>
						</div>
						{table.section && (
							<div>
								<span className="text-muted-foreground">Section</span>
								<p className="font-medium">{table.section}</p>
							</div>
						)}
						{table.currentGuests && (
							<div>
								<span className="text-muted-foreground">Guests</span>
								<p className="font-medium">{table.currentGuests}</p>
							</div>
						)}
					</div>

					{/* Active order */}
					{table.activeOrderId && (
						<div className="space-y-2 rounded-lg border bg-muted/30 p-3">
							<p className="font-semibold text-muted-foreground text-xs uppercase">
								Active Order
							</p>
							<div className="flex items-center justify-between">
								<span className="font-bold text-sm">
									#{table.activeOrderNumber}
								</span>
								<span className="font-bold font-mono text-sm">
									{formatGYD(Number(table.activeOrderTotal ?? 0))}
								</span>
							</div>
							<div className="flex items-center justify-between">
								{table.orderStatus && (
									<Badge variant="secondary" className="text-[10px]">
										{table.orderStatus}
									</Badge>
								)}
								{table.orderCreatedAt && (
									<span className="flex items-center gap-1 text-muted-foreground text-xs">
										<Timer className="size-3" />{" "}
										{elapsedMinutes(table.orderCreatedAt)}
									</span>
								)}
							</div>
						</div>
					)}

					{/* Status actions */}
					<div>
						<p className="mb-2 font-semibold text-muted-foreground text-xs uppercase">
							Change Status
						</p>
						<div className="grid grid-cols-2 gap-2">
							{(["available", "occupied", "reserved", "cleaning"] as const).map(
								(s) => {
									const cfg = statusConfig[s]!;
									const isActive = table.status === s;
									return (
										<Button
											key={s}
											variant={isActive ? "default" : "outline"}
											size="sm"
											className={`h-9 gap-1.5 text-xs ${isActive ? "" : ""}`}
											disabled={isActive || isProcessing}
											onClick={() => onStatusChange(s)}
										>
											{cfg.icon} {cfg.label}
										</Button>
									);
								},
							)}
						</div>
					</div>

					{/* Clear table */}
					{(table.status === "occupied" || table.activeOrderId) && (
						<Button
							variant="outline"
							className="h-9 w-full text-xs"
							onClick={onClear}
							disabled={isProcessing}
						>
							{isProcessing ? (
								<Loader2 className="mr-1.5 size-3.5 animate-spin" />
							) : (
								<X className="mr-1.5 size-3.5" />
							)}
							Clear Table
						</Button>
					)}

					{/* Admin actions */}
					<div className="flex gap-2 border-t pt-3">
						<Button
							variant="outline"
							size="sm"
							className="h-8 flex-1 text-xs"
							onClick={onEdit}
						>
							<Pencil className="mr-1 size-3" /> Edit
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="h-8 flex-1 text-destructive text-xs hover:text-destructive"
							onClick={onDelete}
							disabled={!!table.activeOrderId}
						>
							<Trash2 className="mr-1 size-3" /> Delete
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

// ── Add/Edit Table Dialog ──────────────────────────────────────────────────

function AddEditTableDialog({
	open,
	table,
	onClose,
	onSubmit,
	isProcessing,
}: {
	open: boolean;
	table?: TableRow | null;
	onClose: () => void;
	onSubmit: (data: {
		name: string;
		section?: string | null;
		seats: number;
		positionX: number;
		positionY: number;
		shape: "square" | "circle" | "rectangle";
	}) => void;
	isProcessing: boolean;
}) {
	const [name, setName] = useState(table?.name ?? "");
	const [section, setSection] = useState(table?.section ?? "");
	const [seats, setSeats] = useState(String(table?.seats ?? 4));
	const [posX, setPosX] = useState(String(table?.positionX ?? 0));
	const [posY, setPosY] = useState(String(table?.positionY ?? 0));
	const [shape, setShape] = useState<"square" | "circle" | "rectangle">(
		(table?.shape as "square" | "circle" | "rectangle") ?? "square",
	);

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!name.trim()) {
			toast.error("Table name is required");
			return;
		}
		onSubmit({
			name: name.trim(),
			section: section.trim() || null,
			seats: Number(seats) || 4,
			positionX: Number(posX) || 0,
			positionY: Number(posY) || 0,
			shape,
		});
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(o) => {
				if (!o) onClose();
			}}
		>
			<DialogContent className="max-w-[calc(100vw-2rem)] rounded-xl sm:max-w-sm">
				<DialogHeader>
					<DialogTitle>{table ? "Edit Table" : "Add Table"}</DialogTitle>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="table-name">Name</Label>
						<Input
							id="table-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="e.g. Table 1, Booth A"
							autoFocus
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="table-section">Section</Label>
						<Input
							id="table-section"
							value={section}
							onChange={(e) => setSection(e.target.value)}
							placeholder="e.g. Main Floor, Patio"
						/>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-2">
							<Label htmlFor="table-seats">Seats</Label>
							<Input
								id="table-seats"
								type="number"
								inputMode="numeric"
								min="1"
								max="50"
								value={seats}
								onChange={(e) => setSeats(e.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label>Shape</Label>
							<Select
								value={shape}
								onValueChange={(v) => setShape(v as typeof shape)}
							>
								<SelectTrigger className="h-9">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="square">Square</SelectItem>
									<SelectItem value="circle">Circle</SelectItem>
									<SelectItem value="rectangle">Rectangle</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-2">
							<Label htmlFor="table-pos-x">Position X</Label>
							<Input
								id="table-pos-x"
								type="number"
								inputMode="numeric"
								value={posX}
								onChange={(e) => setPosX(e.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="table-pos-y">Position Y</Label>
							<Input
								id="table-pos-y"
								type="number"
								inputMode="numeric"
								value={posY}
								onChange={(e) => setPosY(e.target.value)}
							/>
						</div>
					</div>

					<DialogFooter>
						<Button type="button" variant="outline" onClick={onClose}>
							Cancel
						</Button>
						<Button type="submit" disabled={isProcessing}>
							{isProcessing && (
								<Loader2 className="mr-1.5 size-4 animate-spin" />
							)}
							{table ? "Save Changes" : "Add Table"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
