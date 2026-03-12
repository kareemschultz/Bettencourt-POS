import { describe, expect, it } from "bun:test";
import {
  calculateDiscount,
  calculateInvoiceTotalsFromItems,
  normalizeRecurringTemplateData,
  roundMoney,
} from "../lib/finance-calculations";

describe("finance calculations", () => {
  it("rounds money safely to 2 decimals", () => {
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(10.444)).toBe(10.44);
  });

  it("applies percent and fixed discounts with caps", () => {
    expect(calculateDiscount(100, "percent", 10)).toBe(10);
    expect(calculateDiscount(100, "fixed", 25)).toBe(25);
    expect(calculateDiscount(100, "fixed", 150)).toBe(100);
  });

  it("calculates invoice totals with discounts and tax", () => {
    const totals = calculateInvoiceTotalsFromItems({
      items: [
        { quantity: 2, unitPrice: 50 },
        { quantity: 1, unitPrice: 20 },
      ],
      taxRate: 16.5,
      discountType: "percent",
      discountValue: 10,
      taxMode: "invoice",
    });

    expect(totals.subtotal).toBe(120);
    expect(totals.discountTotal).toBe(12);
    expect(totals.taxTotal).toBe(17.82);
    expect(totals.total).toBe(125.82);
  });

  it("recomputes recurring invoice data after price automation", () => {
    const result = normalizeRecurringTemplateData(
      {
        items: [
          { quantity: 2, unitPrice: 10 },
          { quantity: 1, unitPrice: 20 },
        ],
        discountType: "percent",
        discountValue: 10,
        taxRate: 16.5,
        taxMode: "invoice",
      },
      "invoice",
      "percent_increase",
      10,
    );

    expect(result.subtotal).toBe("44");
    expect(result.taxTotal).toBe("6.53");
    expect(result.total).toBe("46.13");
  });
});
