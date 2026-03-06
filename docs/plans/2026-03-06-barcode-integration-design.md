# Barcode Integration Design — Bettencourt POS

**Date:** 2026-03-06
**Approach:** HID Scanner + Browser Camera (Hybrid)

## Overview

Add barcode scanning, lookup, and label printing to Bettencourt POS. Supports USB/Bluetooth HID scanners at registers, camera scanning on mobile for inventory, multi-barcode per product, and enhanced label printing with Code128/EAN-13/UPC-A formats.

## Architecture

### 1. Database: Multi-Barcode Support

New junction table `product_barcode` allows multiple barcodes per product (e.g., manufacturer UPC + internal SKU + weight-embedded PLU).

```
product_barcode
├── id (uuid PK)
├── product_id (FK → product.id)
├── barcode (varchar, unique index)
├── format (enum: code128, ean13, upca, code39, internal)
├── is_primary (boolean, default false)
├── created_at (timestamp)
```

Also add `barcode` column directly to `product` table for backward compatibility with existing SKU field (the `sku` field stays, `barcode` is the scannable code).

### 2. API: Barcode Lookup Endpoint

New oRPC endpoint `pos.lookupBarcode`:
- Input: `{ barcode: string }`
- Checks `product_barcode.barcode` first, then falls back to `product.sku`
- Returns product with price, department, active status
- Used by both POS scan-to-sell and inventory scanning

Additional endpoints:
- `products.addBarcode` — Link a barcode to a product
- `products.removeBarcode` — Unlink a barcode
- `products.getBarcodes` — List all barcodes for a product

### 3. POS Terminal: HID Scanner Integration

USB/Bluetooth barcode scanners emit keystrokes. Detection logic:
- Track keystroke timing globally via `keydown` listener
- If characters arrive < 50ms apart and end with Enter → barcode scan event
- Buffer resets after 300ms of inactivity
- Route scanned barcode to `pos.lookupBarcode` → add to cart

Implementation: `useBarcodeScanner(callback)` hook that:
1. Listens for rapid keystrokes on `window`
2. Buffers characters until Enter or timeout
3. Calls `pos.lookupBarcode` with the buffered string
4. Fires callback with the matched product (or shows "not found" toast)

### 4. Camera Scanning (Mobile/Tablet)

For inventory counting and mobile scanning:
- Use `@aspect-software/barcode-reader` or inline WASM decoder
- `<BarcodeScannerDialog>` component with camera viewfinder
- Accessible from: POS terminal (fallback), Inventory page, Labels page
- Decodes Code128, EAN-13, UPC-A, QR codes

### 5. Enhanced Label Printing

Upgrade existing `dashboard.labels.tsx`:
- Add EAN-13 and UPC-A barcode encoding (currently only Code128B)
- Support custom barcode text (use product barcode if set, fall back to SKU)
- Add label size presets: shelf (2.25"x1.25"), price tag (1.5"x1"), receipt-width
- Batch quantity per product (print N copies of each label)

### 6. Inventory Barcode Scanning

New "Scan to Count" mode on inventory page:
- Scan barcode → lookup product → increment count
- Running tally with product names and quantities
- Submit as stock count when done

## Implementation Files

| Component | File(s) |
|-----------|---------|
| Schema | `packages/db/src/schema/product.ts` (add productBarcode table) |
| API | `packages/api/src/routers/pos.ts` (lookupBarcode endpoint) |
| API | `packages/api/src/routers/products.ts` (barcode CRUD) |
| Hook | `apps/web/src/hooks/use-barcode-scanner.ts` |
| POS | `apps/web/src/components/pos/pos-terminal.tsx` (integrate hook) |
| Labels | `apps/web/src/routes/dashboard.labels.tsx` (enhance) |
| Inventory | `apps/web/src/routes/dashboard.inventory.tsx` (scan-to-count) |

## Not In Scope (Future)

- GS1 weight-embedded barcode parsing (requires scale integration)
- Zebra ZPL/EPL direct printer support (requires Tauri)
- Barcode generation from sequential counters (manual entry for now)
