import { db } from "@Bettencourt-POS/db";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure } from "../index";

// ── getSalesJournal ─────────────────────────────────────────────────────
// Returns a double-entry format journal: date, account, debit, credit.
const getSalesJournal = permissionProcedure("reports.read")
	.input(
		z.object({
			startDate: z.string(),
			endDate: z.string(),
		}),
	)
	.handler(async ({ input }) => {
		// Run all the aggregate queries in parallel
		const [
			cashReceivedResult,
			cardPaymentsResult,
			salesRevenueResult,
			taxCollectedResult,
			discountsGivenResult,
			refundsIssuedResult,
			expensesResult,
		] = await Promise.all([
			// Cash Received (debit)
			db.execute(
				sql`SELECT COALESCE(SUM(p.amount), 0)::numeric as total
				FROM payment p
				JOIN "order" o ON o.id = p.order_id
				WHERE o.status IN ('completed', 'closed')
					AND p.method = 'cash'
					AND o.created_at >= ${input.startDate}::timestamptz
					AND o.created_at <= ${input.endDate}::timestamptz`,
			),

			// Card Payments (debit)
			db.execute(
				sql`SELECT COALESCE(SUM(p.amount), 0)::numeric as total
				FROM payment p
				JOIN "order" o ON o.id = p.order_id
				WHERE o.status IN ('completed', 'closed')
					AND p.method != 'cash'
					AND o.created_at >= ${input.startDate}::timestamptz
					AND o.created_at <= ${input.endDate}::timestamptz`,
			),

			// Sales Revenue (credit) - subtotal (before tax, after discount)
			db.execute(
				sql`SELECT COALESCE(SUM(o.subtotal), 0)::numeric as total
				FROM "order" o
				WHERE o.status IN ('completed', 'closed')
					AND o.created_at >= ${input.startDate}::timestamptz
					AND o.created_at <= ${input.endDate}::timestamptz`,
			),

			// Tax Collected (credit)
			db.execute(
				sql`SELECT COALESCE(SUM(o.tax_total), 0)::numeric as total
				FROM "order" o
				WHERE o.status IN ('completed', 'closed')
					AND o.created_at >= ${input.startDate}::timestamptz
					AND o.created_at <= ${input.endDate}::timestamptz`,
			),

			// Discounts Given (debit - contra revenue)
			db.execute(
				sql`SELECT COALESCE(SUM(o.discount_total), 0)::numeric as total
				FROM "order" o
				WHERE o.status IN ('completed', 'closed')
					AND o.created_at >= ${input.startDate}::timestamptz
					AND o.created_at <= ${input.endDate}::timestamptz`,
			),

			// Refunds Issued (debit)
			db.execute(
				sql`SELECT COALESCE(SUM(r.amount), 0)::numeric as total
				FROM refund r
				JOIN "order" o ON o.id = r.order_id
				WHERE r.created_at >= ${input.startDate}::timestamptz
					AND r.created_at <= ${input.endDate}::timestamptz`,
			),

			// Expenses (debit)
			db.execute(
				sql`SELECT COALESCE(SUM(e.amount), 0)::numeric as total
				FROM expense e
				WHERE e.created_at >= ${input.startDate}::timestamptz
					AND e.created_at <= ${input.endDate}::timestamptz`,
			),
		]);

		const cashReceived = Number(
			(cashReceivedResult.rows[0] as Record<string, unknown>)?.total ?? 0,
		);
		const cardPayments = Number(
			(cardPaymentsResult.rows[0] as Record<string, unknown>)?.total ?? 0,
		);
		const salesRevenue = Number(
			(salesRevenueResult.rows[0] as Record<string, unknown>)?.total ?? 0,
		);
		const taxCollected = Number(
			(taxCollectedResult.rows[0] as Record<string, unknown>)?.total ?? 0,
		);
		const discountsGiven = Number(
			(discountsGivenResult.rows[0] as Record<string, unknown>)?.total ?? 0,
		);
		const refundsIssued = Number(
			(refundsIssuedResult.rows[0] as Record<string, unknown>)?.total ?? 0,
		);
		const expenses = Number(
			(expensesResult.rows[0] as Record<string, unknown>)?.total ?? 0,
		);

		const entries = [
			{ account: "Cash Received", debit: cashReceived, credit: 0 },
			{ account: "Card Payments", debit: cardPayments, credit: 0 },
			{ account: "Discounts Given", debit: discountsGiven, credit: 0 },
			{ account: "Refunds Issued", debit: refundsIssued, credit: 0 },
			{ account: "Expenses", debit: expenses, credit: 0 },
			{ account: "Sales Revenue", debit: 0, credit: salesRevenue },
			{ account: "Tax Collected", debit: 0, credit: taxCollected },
		];

		const totalDebits = entries.reduce((sum, e) => sum + e.debit, 0);
		const totalCredits = entries.reduce((sum, e) => sum + e.credit, 0);

		return {
			startDate: input.startDate,
			endDate: input.endDate,
			entries,
			totalDebits,
			totalCredits,
		};
	});

// ── getExportData ─────────────────────────────────────────────────────
// Returns accounting-export-ready data in csv, qbo (QuickBooks IIF), or xero format.
const getExportData = permissionProcedure("reports.read")
	.input(
		z.object({
			startDate: z.string(),
			endDate: z.string(),
			format: z.enum(["csv", "qbo", "xero"]),
		}),
	)
	.handler(async ({ input }) => {
		// Reuse the same queries as getSalesJournal
		const [
			cashReceivedResult,
			cardPaymentsResult,
			salesRevenueResult,
			taxCollectedResult,
			discountsGivenResult,
			refundsIssuedResult,
			expensesResult,
		] = await Promise.all([
			db.execute(
				sql`SELECT COALESCE(SUM(p.amount), 0)::numeric as total
				FROM payment p
				JOIN "order" o ON o.id = p.order_id
				WHERE o.status IN ('completed', 'closed')
					AND p.method = 'cash'
					AND o.created_at >= ${input.startDate}::timestamptz
					AND o.created_at <= ${input.endDate}::timestamptz`,
			),
			db.execute(
				sql`SELECT COALESCE(SUM(p.amount), 0)::numeric as total
				FROM payment p
				JOIN "order" o ON o.id = p.order_id
				WHERE o.status IN ('completed', 'closed')
					AND p.method != 'cash'
					AND o.created_at >= ${input.startDate}::timestamptz
					AND o.created_at <= ${input.endDate}::timestamptz`,
			),
			db.execute(
				sql`SELECT COALESCE(SUM(o.subtotal), 0)::numeric as total
				FROM "order" o
				WHERE o.status IN ('completed', 'closed')
					AND o.created_at >= ${input.startDate}::timestamptz
					AND o.created_at <= ${input.endDate}::timestamptz`,
			),
			db.execute(
				sql`SELECT COALESCE(SUM(o.tax_total), 0)::numeric as total
				FROM "order" o
				WHERE o.status IN ('completed', 'closed')
					AND o.created_at >= ${input.startDate}::timestamptz
					AND o.created_at <= ${input.endDate}::timestamptz`,
			),
			db.execute(
				sql`SELECT COALESCE(SUM(o.discount_total), 0)::numeric as total
				FROM "order" o
				WHERE o.status IN ('completed', 'closed')
					AND o.created_at >= ${input.startDate}::timestamptz
					AND o.created_at <= ${input.endDate}::timestamptz`,
			),
			db.execute(
				sql`SELECT COALESCE(SUM(r.amount), 0)::numeric as total
				FROM refund r
				JOIN "order" o ON o.id = r.order_id
				WHERE r.created_at >= ${input.startDate}::timestamptz
					AND r.created_at <= ${input.endDate}::timestamptz`,
			),
			db.execute(
				sql`SELECT COALESCE(SUM(e.amount), 0)::numeric as total
				FROM expense e
				WHERE e.created_at >= ${input.startDate}::timestamptz
					AND e.created_at <= ${input.endDate}::timestamptz`,
			),
		]);

		const cashReceived = Number(
			(cashReceivedResult.rows[0] as Record<string, unknown>)?.total ?? 0,
		);
		const cardPayments = Number(
			(cardPaymentsResult.rows[0] as Record<string, unknown>)?.total ?? 0,
		);
		const salesRevenue = Number(
			(salesRevenueResult.rows[0] as Record<string, unknown>)?.total ?? 0,
		);
		const taxCollected = Number(
			(taxCollectedResult.rows[0] as Record<string, unknown>)?.total ?? 0,
		);
		const discountsGiven = Number(
			(discountsGivenResult.rows[0] as Record<string, unknown>)?.total ?? 0,
		);
		const refundsIssued = Number(
			(refundsIssuedResult.rows[0] as Record<string, unknown>)?.total ?? 0,
		);
		const expenses = Number(
			(expensesResult.rows[0] as Record<string, unknown>)?.total ?? 0,
		);

		// Extract date portion for display (MM/DD/YYYY for QBO, YYYY-MM-DD otherwise)
		const dateStr = input.startDate.split("T")[0] ?? input.startDate;
		const dateParts = dateStr.split("-");
		const mmddyyyy = `${dateParts[1]}/${dateParts[2]}/${dateParts[0]}`;
		const memo = `Daily Sales ${dateStr}`;

		if (input.format === "csv") {
			const rows: {
				date: string;
				account: string;
				description: string;
				debit: number;
				credit: number;
				reference: string;
			}[] = [];
			if (cashReceived > 0)
				rows.push({
					date: dateStr,
					account: "Cash on Hand",
					description: "Cash received from sales",
					debit: cashReceived,
					credit: 0,
					reference: memo,
				});
			if (cardPayments > 0)
				rows.push({
					date: dateStr,
					account: "Accounts Receivable - Card",
					description: "Card payments",
					debit: cardPayments,
					credit: 0,
					reference: memo,
				});
			if (salesRevenue > 0)
				rows.push({
					date: dateStr,
					account: "Sales Revenue",
					description: "Sales income",
					debit: 0,
					credit: salesRevenue,
					reference: memo,
				});
			if (taxCollected > 0)
				rows.push({
					date: dateStr,
					account: "Tax Payable",
					description: "Tax collected",
					debit: 0,
					credit: taxCollected,
					reference: memo,
				});
			if (discountsGiven > 0)
				rows.push({
					date: dateStr,
					account: "Discounts",
					description: "Discounts given",
					debit: discountsGiven,
					credit: 0,
					reference: memo,
				});
			if (refundsIssued > 0)
				rows.push({
					date: dateStr,
					account: "Refunds",
					description: "Refunds issued",
					debit: refundsIssued,
					credit: 0,
					reference: memo,
				});
			if (expenses > 0)
				rows.push({
					date: dateStr,
					account: "Operating Expenses",
					description: "Daily expenses",
					debit: expenses,
					credit: 0,
					reference: memo,
				});
			return { format: "csv" as const, rows };
		}

		if (input.format === "qbo") {
			// QuickBooks IIF tab-delimited format
			const lines: string[] = [];
			lines.push("!TRNS\tTRNSTYPE\tDATE\tACCNT\tAMOUNT\tMEMO");
			lines.push("!SPL\tTRNSTYPE\tDATE\tACCNT\tAMOUNT\tMEMO");
			lines.push("!ENDTRNS");

			// Cash received journal entry
			if (cashReceived > 0) {
				lines.push(
					`TRNS\tGENERAL JOURNAL\t${mmddyyyy}\tCash on Hand\t${cashReceived.toFixed(2)}\t${memo}`,
				);
				lines.push(
					`SPL\tGENERAL JOURNAL\t${mmddyyyy}\tSales Income\t${(-salesRevenue).toFixed(2)}\t${memo}`,
				);
				if (taxCollected > 0)
					lines.push(
						`SPL\tGENERAL JOURNAL\t${mmddyyyy}\tTax Payable\t${(-taxCollected).toFixed(2)}\t${memo}`,
					);
				lines.push("ENDTRNS");
			}

			if (cardPayments > 0) {
				lines.push(
					`TRNS\tGENERAL JOURNAL\t${mmddyyyy}\tAccounts Receivable\t${cardPayments.toFixed(2)}\t${memo}`,
				);
				lines.push(
					`SPL\tGENERAL JOURNAL\t${mmddyyyy}\tSales Income\t${(-cardPayments).toFixed(2)}\t${memo}`,
				);
				lines.push("ENDTRNS");
			}

			if (discountsGiven > 0) {
				lines.push(
					`TRNS\tGENERAL JOURNAL\t${mmddyyyy}\tSales Discounts\t${discountsGiven.toFixed(2)}\t${memo}`,
				);
				lines.push(
					`SPL\tGENERAL JOURNAL\t${mmddyyyy}\tSales Income\t${(-discountsGiven).toFixed(2)}\t${memo}`,
				);
				lines.push("ENDTRNS");
			}

			if (refundsIssued > 0) {
				lines.push(
					`TRNS\tGENERAL JOURNAL\t${mmddyyyy}\tSales Returns\t${refundsIssued.toFixed(2)}\t${memo}`,
				);
				lines.push(
					`SPL\tGENERAL JOURNAL\t${mmddyyyy}\tCash on Hand\t${(-refundsIssued).toFixed(2)}\t${memo}`,
				);
				lines.push("ENDTRNS");
			}

			if (expenses > 0) {
				lines.push(
					`TRNS\tGENERAL JOURNAL\t${mmddyyyy}\tOperating Expenses\t${expenses.toFixed(2)}\t${memo}`,
				);
				lines.push(
					`SPL\tGENERAL JOURNAL\t${mmddyyyy}\tCash on Hand\t${(-expenses).toFixed(2)}\t${memo}`,
				);
				lines.push("ENDTRNS");
			}

			return { format: "qbo" as const, rows: lines };
		}

		// Xero manual journal CSV
		const xeroRows: {
			date: string;
			description: string;
			accountCode: string;
			debit: number;
			credit: number;
			taxRate: string;
			reference: string;
		}[] = [];
		if (cashReceived > 0)
			xeroRows.push({
				date: dateStr,
				description: "Cash received from sales",
				accountCode: "090",
				debit: cashReceived,
				credit: 0,
				taxRate: "",
				reference: memo,
			});
		if (cardPayments > 0)
			xeroRows.push({
				date: dateStr,
				description: "Card payments",
				accountCode: "120",
				debit: cardPayments,
				credit: 0,
				taxRate: "",
				reference: memo,
			});
		if (salesRevenue > 0)
			xeroRows.push({
				date: dateStr,
				description: "Sales income",
				accountCode: "200",
				debit: 0,
				credit: salesRevenue,
				taxRate: "",
				reference: memo,
			});
		if (taxCollected > 0)
			xeroRows.push({
				date: dateStr,
				description: "Tax collected",
				accountCode: "820",
				debit: 0,
				credit: taxCollected,
				taxRate: "",
				reference: memo,
			});
		if (discountsGiven > 0)
			xeroRows.push({
				date: dateStr,
				description: "Discounts given",
				accountCode: "260",
				debit: discountsGiven,
				credit: 0,
				taxRate: "",
				reference: memo,
			});
		if (refundsIssued > 0)
			xeroRows.push({
				date: dateStr,
				description: "Refunds issued",
				accountCode: "261",
				debit: refundsIssued,
				credit: 0,
				taxRate: "",
				reference: memo,
			});
		if (expenses > 0)
			xeroRows.push({
				date: dateStr,
				description: "Daily expenses",
				accountCode: "400",
				debit: expenses,
				credit: 0,
				taxRate: "",
				reference: memo,
			});
		return { format: "xero" as const, rows: xeroRows };
	});

// ── getProfitAndLoss ──────────────────────────────────────────────────
// Returns a complete P&L statement with previous-period comparison.
const getProfitAndLoss = permissionProcedure("reports.read")
	.input(
		z.object({
			startDate: z.string(),
			endDate: z.string(),
		}),
	)
	.handler(async ({ input }) => {
		// Calculate previous period (same duration, immediately before)
		const startMs = new Date(input.startDate).getTime();
		const endMs = new Date(input.endDate).getTime();
		const durationMs = endMs - startMs;
		const prevStart = new Date(startMs - durationMs).toISOString();
		const prevEnd = input.startDate;

		async function fetchPeriod(start: string, end: string) {
			const [
				grossSalesResult,
				discountsResult,
				refundsResult,
				cogsResult,
				expensesByCategoryResult,
				laborResult,
			] = await Promise.all([
				// Gross Sales
				db.execute(
					sql`SELECT COALESCE(SUM(o.subtotal), 0)::numeric as total
					FROM "order" o
					WHERE o.status IN ('completed', 'closed')
						AND o.created_at >= ${start}::timestamptz
						AND o.created_at <= ${end}::timestamptz`,
				),
				// Discounts
				db.execute(
					sql`SELECT COALESCE(SUM(o.discount_total), 0)::numeric as total
					FROM "order" o
					WHERE o.status IN ('completed', 'closed')
						AND o.created_at >= ${start}::timestamptz
						AND o.created_at <= ${end}::timestamptz`,
				),
				// Refunds
				db.execute(
					sql`SELECT COALESCE(SUM(r.amount), 0)::numeric as total
					FROM refund r
					JOIN "order" o ON o.id = r.order_id
					WHERE r.created_at >= ${start}::timestamptz
						AND r.created_at <= ${end}::timestamptz`,
				),
				// COGS: quantity * product.cost for completed orders
				db.execute(
					sql`SELECT COALESCE(SUM(li.quantity * COALESCE(p.cost, 0)), 0)::numeric as total
					FROM order_line_item li
					JOIN "order" o ON o.id = li.order_id
					LEFT JOIN product p ON p.id = li.product_id
					WHERE o.status IN ('completed', 'closed')
						AND li.voided = false
						AND o.created_at >= ${start}::timestamptz
						AND o.created_at <= ${end}::timestamptz`,
				),
				// Expenses by category
				db.execute(
					sql`SELECT e.category, COALESCE(SUM(e.amount), 0)::numeric as total
					FROM expense e
					WHERE e.created_at >= ${start}::timestamptz
						AND e.created_at <= ${end}::timestamptz
					GROUP BY e.category
					ORDER BY total DESC`,
				),
				// Labor: hours from time_entry with hourly_rate from user
				db.execute(
					sql`SELECT
						COALESCE(SUM(
							EXTRACT(EPOCH FROM (COALESCE(te.clock_out, NOW()) - te.clock_in)) / 3600.0
							- COALESCE(te.break_minutes::numeric, 0) / 60.0
						), 0)::numeric as hours,
						COALESCE(SUM(
							(EXTRACT(EPOCH FROM (COALESCE(te.clock_out, NOW()) - te.clock_in)) / 3600.0
							 - COALESCE(te.break_minutes::numeric, 0) / 60.0)
							* COALESCE(u.hourly_rate, 150)
						), 0)::numeric as cost
					FROM time_entry te
					JOIN "user" u ON u.id = te.user_id
					WHERE te.clock_in >= ${start}::timestamptz
						AND te.clock_in <= ${end}::timestamptz`,
				),
			]);

			const grossSales = Number(
				(grossSalesResult.rows[0] as Record<string, unknown>)?.total ?? 0,
			);
			const discounts = Number(
				(discountsResult.rows[0] as Record<string, unknown>)?.total ?? 0,
			);
			const refunds = Number(
				(refundsResult.rows[0] as Record<string, unknown>)?.total ?? 0,
			);
			const cogs = Number(
				(cogsResult.rows[0] as Record<string, unknown>)?.total ?? 0,
			);
			const laborHours = Number(
				(laborResult.rows[0] as Record<string, unknown>)?.hours ?? 0,
			);
			const laborCost = Number(
				(laborResult.rows[0] as Record<string, unknown>)?.cost ?? 0,
			);

			const expenseItems = (
				expensesByCategoryResult.rows as Record<string, unknown>[]
			).map((row) => ({
				category: String(row.category ?? "Other"),
				amount: Number(row.total ?? 0),
			}));
			const totalExpenses = expenseItems.reduce((sum, e) => sum + e.amount, 0);

			const netRevenue = grossSales - discounts - refunds;
			const grossProfit = netRevenue - cogs;
			const grossMarginPercent =
				netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;
			const netProfit = grossProfit - totalExpenses - laborCost;
			const netProfitPercent =
				netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;

			return {
				grossSales,
				discounts,
				refunds,
				netRevenue,
				cogs,
				grossProfit,
				grossMarginPercent,
				expenseItems,
				totalExpenses,
				laborHours,
				laborCost,
				netProfit,
				netProfitPercent,
			};
		}

		const [current, previous] = await Promise.all([
			fetchPeriod(input.startDate, input.endDate),
			fetchPeriod(prevStart, prevEnd),
		]);

		return {
			period: { start: input.startDate, end: input.endDate },
			revenue: {
				grossSales: current.grossSales,
				discounts: current.discounts,
				refunds: current.refunds,
				netRevenue: current.netRevenue,
			},
			cogs: {
				total: current.cogs,
				grossProfit: current.grossProfit,
				grossMarginPercent: current.grossMarginPercent,
			},
			expenses: {
				items: current.expenseItems,
				total: current.totalExpenses,
			},
			labor: {
				hours: current.laborHours,
				cost: current.laborCost,
			},
			netProfit: current.netProfit,
			netProfitPercent: current.netProfitPercent,
			previousPeriod: {
				netRevenue: previous.netRevenue,
				cogs: previous.cogs,
				expenses: previous.totalExpenses,
				labor: previous.laborCost,
				netProfit: previous.netProfit,
				grossSales: previous.grossSales,
				discounts: previous.discounts,
				refunds: previous.refunds,
				grossProfit: previous.grossProfit,
				grossMarginPercent: previous.grossMarginPercent,
				totalExpenses: previous.totalExpenses,
				laborHours: previous.laborHours,
				laborCost: previous.laborCost,
				netProfitPercent: previous.netProfitPercent,
			},
		};
	});

export const journalRouter = {
	getSalesJournal,
	getExportData,
	getProfitAndLoss,
};
