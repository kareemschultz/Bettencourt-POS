export type DiscountType = "percent" | "fixed";
export type TaxMode = "invoice" | "line";

export interface InvoiceLikeItem {
	quantity?: number | string | null;
	unitPrice?: number | string | null;
	taxExempt?: boolean | null;
}

export function roundMoney(value: number): number {
	return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateDiscount(
	subtotal: number,
	discountType: DiscountType,
	discountValue: number,
): number {
	if (!Number.isFinite(subtotal) || subtotal <= 0) return 0;
	if (!Number.isFinite(discountValue) || discountValue <= 0) return 0;

	if (discountType === "percent") {
		return roundMoney((subtotal * discountValue) / 100);
	}

	return roundMoney(Math.min(discountValue, subtotal));
}

export function calculateInvoiceTotalsFromItems(args: {
	items: InvoiceLikeItem[];
	taxRate: number;
	discountType: DiscountType;
	discountValue: number;
	taxMode: TaxMode;
}) {
	const { items, taxRate, discountType, discountValue, taxMode } = args;
	const safeTaxRate = Number.isFinite(taxRate) ? Math.max(taxRate, 0) : 0;

	let subtotal = 0;
	let lineTaxBase = 0;

	const normalizedItems = items.map((item) => {
		const quantity = Number(item.quantity ?? 0);
		const unitPrice = Number(item.unitPrice ?? 0);
		const safeQty = Number.isFinite(quantity) ? Math.max(quantity, 0) : 0;
		const safeUnit = Number.isFinite(unitPrice) ? Math.max(unitPrice, 0) : 0;
		const lineTotal = roundMoney(safeQty * safeUnit);
		subtotal += lineTotal;

		if (!item.taxExempt) {
			lineTaxBase += lineTotal;
		}

		return {
			...item,
			quantity: safeQty,
			unitPrice: safeUnit,
			total: lineTotal,
		};
	});

	subtotal = roundMoney(subtotal);

	const discountTotal = calculateDiscount(
		subtotal,
		discountType,
		discountValue,
	);
	const taxableBase = Math.max(subtotal - discountTotal, 0);

	const taxBase =
		taxMode === "line" ? Math.max(lineTaxBase - discountTotal, 0) : taxableBase;
	const taxTotal = roundMoney((taxBase * safeTaxRate) / 100);
	const total = roundMoney(taxableBase + taxTotal);

	return {
		items: normalizedItems,
		subtotal,
		discountTotal,
		taxTotal,
		total,
	};
}

export function normalizeRecurringTemplateData(
	data: Record<string, unknown>,
	templateType: string,
	mode: string,
	rawValue: number,
): Record<string, unknown> {
	const normalized = JSON.parse(JSON.stringify(data ?? {})) as Record<
		string,
		unknown
	>;

	if (mode === "none" || !Number.isFinite(rawValue) || rawValue === 0) {
		return normalized;
	}

	if (templateType === "expense") {
		const current = Number(normalized.amount ?? 0);
		const next =
			mode === "fixed_update"
				? rawValue
				: roundMoney(current * (1 + rawValue / 100));
		normalized.amount = String(next);
		return normalized;
	}

	const items = Array.isArray(normalized.items)
		? (normalized.items as Array<InvoiceLikeItem>)
		: [];

	const adjustedItems = items.map((item) => {
		const currentUnit = Number(item.unitPrice ?? 0);
		const nextUnit =
			mode === "fixed_update"
				? rawValue
				: roundMoney(currentUnit * (1 + rawValue / 100));
		return {
			...item,
			unitPrice: nextUnit,
		};
	});

	const taxRate = Number(normalized.taxRate ?? 0);
	const discountType =
		normalized.discountType === "fixed"
			? ("fixed" as const)
			: ("percent" as const);
	const discountValue = Number(normalized.discountValue ?? 0);
	const taxMode =
		normalized.taxMode === "line" ? ("line" as const) : ("invoice" as const);

	const totals = calculateInvoiceTotalsFromItems({
		items: adjustedItems,
		taxRate,
		discountType,
		discountValue,
		taxMode,
	});

	normalized.items = totals.items as unknown as Record<string, unknown>[];
	normalized.subtotal = String(totals.subtotal);
	normalized.taxTotal = String(totals.taxTotal);
	normalized.total = String(totals.total);

	return normalized;
}
