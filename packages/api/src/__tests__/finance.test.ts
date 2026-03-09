import { describe, expect, test } from "bun:test";
import { assertTransition, computeInvoiceStatus } from "../lib/finance-status";

// ── Status Transitions ─────────────────────────────────────────────────────

describe("assertTransition – invoice", () => {
	test("draft → sent is valid", () => {
		expect(() => assertTransition("invoice", "draft", "sent")).not.toThrow();
	});

	test("draft → voided is valid", () => {
		expect(() => assertTransition("invoice", "draft", "voided")).not.toThrow();
	});

	test("sent → partially_paid is valid", () => {
		expect(() =>
			assertTransition("invoice", "sent", "partially_paid"),
		).not.toThrow();
	});

	test("sent → paid is valid", () => {
		expect(() => assertTransition("invoice", "sent", "paid")).not.toThrow();
	});

	test("paid → voided is valid", () => {
		expect(() => assertTransition("invoice", "paid", "voided")).not.toThrow();
	});

	test("draft → paid throws (skipping steps)", () => {
		expect(() => assertTransition("invoice", "draft", "paid")).toThrow();
	});

	test("paid → sent throws (going backwards)", () => {
		expect(() => assertTransition("invoice", "paid", "sent")).toThrow();
	});

	test("voided → paid throws (voided is terminal)", () => {
		expect(() => assertTransition("invoice", "voided", "paid")).toThrow();
	});
});

describe("assertTransition – credit_note", () => {
	test("draft → issued is valid", () => {
		expect(() =>
			assertTransition("credit_note", "draft", "issued"),
		).not.toThrow();
	});

	test("issued → applied is valid", () => {
		expect(() =>
			assertTransition("credit_note", "issued", "applied"),
		).not.toThrow();
	});

	test("applied → voided is valid", () => {
		expect(() =>
			assertTransition("credit_note", "applied", "voided"),
		).not.toThrow();
	});

	test("draft → applied throws (must be issued first)", () => {
		expect(() => assertTransition("credit_note", "draft", "applied")).toThrow();
	});

	test("voided → issued throws (voided is terminal)", () => {
		expect(() => assertTransition("credit_note", "voided", "issued")).toThrow();
	});
});

describe("assertTransition – vendor_bill", () => {
	test("draft → received is valid", () => {
		expect(() =>
			assertTransition("vendor_bill", "draft", "received"),
		).not.toThrow();
	});

	test("received → partially_paid is valid", () => {
		expect(() =>
			assertTransition("vendor_bill", "received", "partially_paid"),
		).not.toThrow();
	});

	test("partially_paid → paid is valid", () => {
		expect(() =>
			assertTransition("vendor_bill", "partially_paid", "paid"),
		).not.toThrow();
	});

	test("draft → paid throws", () => {
		expect(() => assertTransition("vendor_bill", "draft", "paid")).toThrow();
	});
});

// ── computeInvoiceStatus ───────────────────────────────────────────────────

describe("computeInvoiceStatus", () => {
	test("fully paid returns paid", () => {
		expect(computeInvoiceStatus(1000, 1000, null, "sent")).toBe("paid");
	});

	test("overpaid also returns paid (balance ≤ 0)", () => {
		expect(computeInvoiceStatus(1000, 1100, null, "sent")).toBe("paid");
	});

	test("partial payment returns partially_paid", () => {
		expect(computeInvoiceStatus(1000, 500, null, "sent")).toBe(
			"partially_paid",
		);
	});

	test("zero payment with future due date keeps current status", () => {
		const future = new Date(Date.now() + 86400_000); // tomorrow
		expect(computeInvoiceStatus(1000, 0, future, "sent")).toBe("sent");
	});

	test("zero payment with past due date returns overdue (non-draft)", () => {
		const past = new Date(Date.now() - 86400_000); // yesterday
		expect(computeInvoiceStatus(1000, 0, past, "sent")).toBe("overdue");
	});

	test("draft with past due date stays draft (not overdue)", () => {
		const past = new Date(Date.now() - 86400_000);
		expect(computeInvoiceStatus(1000, 0, past, "draft")).toBe("draft");
	});

	test("voided status is preserved regardless of payment", () => {
		expect(computeInvoiceStatus(1000, 1000, null, "voided")).toBe("voided");
	});

	test("partial payment with past due date still shows partially_paid", () => {
		const past = new Date(Date.now() - 86400_000);
		expect(computeInvoiceStatus(1000, 500, past, "sent")).toBe(
			"partially_paid",
		);
	});
});

// ── Payment allocation logic (pure arithmetic) ────────────────────────────

describe("Payment allocation: amountPaid computation", () => {
	function sumPayments(amounts: number[]): number {
		return amounts.reduce((acc, v) => acc + v, 0);
	}

	test("single payment equals full total → paid", () => {
		const total = 5000;
		const payments = [5000];
		const paid = sumPayments(payments);
		expect(computeInvoiceStatus(total, paid, null, "sent")).toBe("paid");
	});

	test("two partial payments summing to total → paid", () => {
		const total = 5000;
		const payments = [2000, 3000];
		const paid = sumPayments(payments);
		expect(computeInvoiceStatus(total, paid, null, "sent")).toBe("paid");
	});

	test("reversal reduces total paid (append-only ledger)", () => {
		const total = 5000;
		// Record 5000, then reverse 5000 (reversal = negative entry)
		const payments = [5000, -5000];
		const paid = sumPayments(payments);
		expect(paid).toBe(0);
		expect(computeInvoiceStatus(total, paid, null, "sent")).not.toBe("paid");
	});

	test("reversal of partial payment leaves remaining balance", () => {
		const total = 5000;
		const payments = [3000, 2000, -2000]; // recorded 3000+2000, reversed 2000
		const paid = sumPayments(payments);
		expect(paid).toBe(3000);
		expect(computeInvoiceStatus(total, paid, null, "sent")).toBe(
			"partially_paid",
		);
	});
});

// ── Aging bucket computation ───────────────────────────────────────────────

describe("Aging bucket assignment", () => {
	function agingBucket(dueDateMs: number, nowMs: number): string {
		const daysOverdue = Math.floor((nowMs - dueDateMs) / (1000 * 60 * 60 * 24));
		if (daysOverdue <= 0) return "current";
		if (daysOverdue <= 30) return "1-30";
		if (daysOverdue <= 60) return "31-60";
		if (daysOverdue <= 90) return "61-90";
		return "90+";
	}

	const now = Date.now();

	test("future due date → current", () => {
		const future = now + 5 * 86400_000;
		expect(agingBucket(future, now)).toBe("current");
	});

	test("due today → current (0 days)", () => {
		expect(agingBucket(now, now)).toBe("current");
	});

	test("15 days overdue → 1-30 bucket", () => {
		const past = now - 15 * 86400_000;
		expect(agingBucket(past, now)).toBe("1-30");
	});

	test("45 days overdue → 31-60 bucket", () => {
		const past = now - 45 * 86400_000;
		expect(agingBucket(past, now)).toBe("31-60");
	});

	test("75 days overdue → 61-90 bucket", () => {
		const past = now - 75 * 86400_000;
		expect(agingBucket(past, now)).toBe("61-90");
	});

	test("100 days overdue → 90+ bucket", () => {
		const past = now - 100 * 86400_000;
		expect(agingBucket(past, now)).toBe("90+");
	});
});

// ── Tax summary computation ────────────────────────────────────────────────

describe("Tax summary: net liability", () => {
	function netTaxLiability(collected: number, paid: number): number {
		return collected - paid;
	}

	test("collected > paid → positive liability (owe tax)", () => {
		expect(netTaxLiability(50000, 20000)).toBe(30000);
	});

	test("collected < paid → negative liability (refund due)", () => {
		expect(netTaxLiability(10000, 20000)).toBe(-10000);
	});

	test("collected = paid → zero liability", () => {
		expect(netTaxLiability(15000, 15000)).toBe(0);
	});
});

// ── Credit note application ───────────────────────────────────────────────

describe("Credit note application: invoice balance reduction", () => {
	function applyCredit(
		invoiceTotal: number,
		alreadyPaid: number,
		creditAmount: number,
	): { newAmountPaid: number; balance: number } {
		const newAmountPaid = alreadyPaid + creditAmount;
		const balance = Math.max(0, invoiceTotal - newAmountPaid);
		return { newAmountPaid, balance };
	}

	test("full credit wipes out invoice balance", () => {
		const { balance } = applyCredit(1000, 0, 1000);
		expect(balance).toBe(0);
	});

	test("partial credit reduces balance proportionally", () => {
		const { balance } = applyCredit(1000, 0, 400);
		expect(balance).toBe(600);
	});

	test("credit on partially paid invoice reduces remaining balance", () => {
		const { balance } = applyCredit(1000, 600, 400);
		expect(balance).toBe(0);
	});

	test("credit exceeding balance capped at 0", () => {
		const { balance } = applyCredit(1000, 0, 1200);
		expect(balance).toBe(0);
	});

	test("status after full credit application", () => {
		const { newAmountPaid } = applyCredit(1000, 0, 1000);
		expect(computeInvoiceStatus(1000, newAmountPaid, null, "sent")).toBe(
			"paid",
		);
	});

	test("status after partial credit application", () => {
		const { newAmountPaid } = applyCredit(1000, 0, 500);
		expect(computeInvoiceStatus(1000, newAmountPaid, null, "sent")).toBe(
			"partially_paid",
		);
	});
});
