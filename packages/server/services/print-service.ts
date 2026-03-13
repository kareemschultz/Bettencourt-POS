import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { and, eq, inArray } from "drizzle-orm";

export type PrintJobType = "kitchen_ticket" | "bar_ticket" | "receipt_preview";

export type PrintableLineItem = {
	id?: string;
	name: string;
	quantity: number;
	courseNumber?: number;
	notes?: string | null;
	modifiers?: string[];
	reportingCategoryName?: string | null;
};

export type PrintJob = {
	type: PrintJobType;
	organizationId: string;
	locationId: string;
	orderId: string;
	orderNumber: string;
	station?: string | null;
	items: PrintableLineItem[];
	timestamp: Date;
};

export type PrinterTarget = {
	printerId: string;
	printerName: string;
	connectionType: string;
	address: string | null;
	paperWidth: string;
	jobType: PrintJobType;
	reason: "category" | "station" | "fallback";
	items: PrintableLineItem[];
};

export interface PrinterAdapter {
	print(target: PrinterTarget, payload: string): Promise<void>;
}

export class MockEscPosAdapter implements PrinterAdapter {
	async print(target: PrinterTarget, payload: string): Promise<void> {
		console.info("[mock-print]", {
			printer: target.printerName,
			jobType: target.jobType,
			reason: target.reason,
			chars: payload.length,
		});
	}
}

function divider() {
	return "----------------------------------------";
}

export function renderKitchenTicket(job: PrintJob): string {
	const rows = job.items
		.map((item) => {
			const notes = item.notes ? `\n  * ${item.notes}` : "";
			const mods = item.modifiers?.length ? `\n  + ${item.modifiers.join(", ")}` : "";
			const course = item.courseNumber ? ` [C${item.courseNumber}]` : "";
			return `${item.quantity}x ${item.name}${course}${mods}${notes}`;
		})
		.join("\n");
	return [
		"KITCHEN TICKET",
		divider(),
		`Order: #${job.orderNumber}`,
		`Station: ${job.station ?? "kitchen"}`,
		`Time: ${job.timestamp.toISOString()}`,
		divider(),
		rows,
		divider(),
	].join("\n");
}

export function renderBarTicket(job: PrintJob): string {
	const rows = job.items
		.map((item) => `${item.quantity}x ${item.name}${item.notes ? `\n  * ${item.notes}` : ""}`)
		.join("\n");
	return [
		"BAR TICKET",
		divider(),
		`Order: #${job.orderNumber}`,
		`Time: ${job.timestamp.toISOString()}`,
		divider(),
		rows,
		divider(),
	].join("\n");
}

export function renderReceiptPreview(job: PrintJob): string {
	const rows = job.items.map((item) => `${item.quantity}x ${item.name}`).join("\n");
	return ["RECEIPT PREVIEW", divider(), `Order: #${job.orderNumber}`, rows, divider()].join(
		"\n",
	);
}

async function getActivePrinters(organizationId: string, locationId: string) {
	return db
		.select({
			id: schema.printer.id,
			name: schema.printer.name,
			connectionType: schema.printer.connectionType,
			address: schema.printer.address,
			paperWidth: schema.printer.paperWidth,
		})
		.from(schema.printer)
		.where(
			and(
				eq(schema.printer.organizationId, organizationId),
				eq(schema.printer.locationId, locationId),
				eq(schema.printer.isActive, true),
			),
		);
}

async function getCategoryRoutes(printerIds: string[]) {
	if (printerIds.length === 0) return [];
	return db
		.select({
			printerId: schema.printerRoute.printerId,
			reportingCategoryName: schema.reportingCategory.name,
		})
		.from(schema.printerRoute)
		.innerJoin(
			schema.reportingCategory,
			eq(schema.printerRoute.reportingCategoryId, schema.reportingCategory.id),
		)
		.where(inArray(schema.printerRoute.printerId, printerIds));
}

export async function resolvePrinterTargets(job: PrintJob): Promise<PrinterTarget[]> {
	const printers = await getActivePrinters(job.organizationId, job.locationId);
	if (printers.length === 0) return [];

	const routes = await getCategoryRoutes(printers.map((p) => p.id));
	const routeMap = new Map<string, Set<string>>();
	for (const route of routes) {
		if (!routeMap.has(route.printerId)) routeMap.set(route.printerId, new Set());
		routeMap.get(route.printerId)?.add((route.reportingCategoryName ?? "").toLowerCase());
	}

	const targets: PrinterTarget[] = [];

	const normalizedStation = (job.station ?? "").toLowerCase();
	if (normalizedStation) {
		const stationPrinter = printers.find((printer) =>
			printer.name.toLowerCase().includes(normalizedStation),
		);
		if (stationPrinter) {
			targets.push({
				printerId: stationPrinter.id,
				printerName: stationPrinter.name,
				connectionType: stationPrinter.connectionType,
				address: stationPrinter.address,
				paperWidth: stationPrinter.paperWidth,
				jobType: job.type,
				reason: "station",
				items: job.items,
			});
			return targets;
		}
	}

	for (const printer of printers) {
		const mappedCategories = routeMap.get(printer.id);
		if (!mappedCategories || mappedCategories.size === 0) continue;

		const matchingItems = job.items.filter((item) =>
			mappedCategories.has((item.reportingCategoryName ?? "").toLowerCase()),
		);
		if (matchingItems.length === 0) continue;

		targets.push({
			printerId: printer.id,
			printerName: printer.name,
			connectionType: printer.connectionType,
			address: printer.address,
			paperWidth: printer.paperWidth,
			jobType: job.type,
			reason: "category",
			items: matchingItems,
		});
	}

	if (targets.length > 0) return targets;

	const fallback = printers[0]!;
	return [
		{
			printerId: fallback.id,
			printerName: fallback.name,
			connectionType: fallback.connectionType,
			address: fallback.address,
			paperWidth: fallback.paperWidth,
			jobType: job.type,
			reason: "fallback",
			items: job.items,
		},
	];
}

function renderByType(target: PrinterTarget, baseJob: PrintJob): string {
	const scopedJob = { ...baseJob, items: target.items };
	if (target.jobType === "bar_ticket") return renderBarTicket(scopedJob);
	if (target.jobType === "receipt_preview") return renderReceiptPreview(scopedJob);
	return renderKitchenTicket(scopedJob);
}

export class PrintService {
	constructor(private adapter: PrinterAdapter = new MockEscPosAdapter()) {}

	async dispatch(job: PrintJob) {
		const targets = await resolvePrinterTargets(job);
		for (const target of targets) {
			const payload = renderByType(target, job);
			await this.adapter.print(target, payload);
		}
		return targets;
	}
}

export const printService = new PrintService();
