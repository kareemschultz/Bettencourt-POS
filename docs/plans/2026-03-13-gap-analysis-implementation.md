# Bettencourt POS — Gap Analysis Implementation Plan

**Date**: 2026-03-13
**Author**: Claude Code (Gap Analysis Agent)
**Purpose**: Sprint-by-sprint implementation guide for closing feature gaps identified in the gap analysis

---

## Implementation Roadmap Overview

| Sprint | Focus | Weeks | Key Deliverables |
|--------|-------|-------|-----------------|
| S0 | Foundation & Infrastructure | 1-2 | WebSocket, print service, schema migrations |
| S1 | Core Restaurant Operations | 3-5 | KDS, floor plan, tips, tabs, courses, 86 system |
| S2 | Printing & Multi-Terminal | 6-8 | ESC/POS printing, KOT routing, multi-terminal sync |
| S3 | Offline & Reliability | 9-11 | PWA offline-first, reservations |
| S4 | Customer Experience | 12-13 | QR ordering, kiosk, customer pricing |
| S5 | Polish & Scale | 14-16 | i18n, shift scheduling, auto-reorder |
| S6 | Integrations | 17-18 | Delivery platforms, feedback, optimization |

**MVP**: Sprint 0 + Sprint 1 (5 weeks) — transforms system into a complete restaurant POS

---

## Sprint 0: Foundation & Infrastructure (Week 1-2)

### Task 0.1: WebSocket Infrastructure
**Files to create/modify:**
- `apps/server/src/ws.ts` — WebSocket server with channel pub/sub
- `apps/web/src/hooks/use-websocket.ts` — Client hook with auto-reconnect
- `apps/server/src/index.ts` — Mount WebSocket route

**Implementation Notes:**
```typescript
// Hono WebSocket pattern (Bun adapter):
import { upgradeWebSocket } from 'hono/bun'

// Channels: pos:orders, pos:tables, pos:86, pos:kds, pos:session
// Message format: { channel, event, payload, timestamp, source }
```

**Acceptance Criteria:**
- [ ] WebSocket endpoint at `/ws` accepts connections
- [ ] Messages broadcast to all connected clients on same channel
- [ ] Client auto-reconnects on disconnect with exponential backoff
- [ ] Connection authenticated via session token

---

### Task 0.2: Print Service Abstraction
**Files to create/modify:**
- `apps/web/src/lib/print-service.ts` — Print service with WebUSB, network, and browser fallback
- `packages/db/src/schema/printer.ts` — New schema file (printer, printerRoute tables)
- `packages/db/src/schema/index.ts` — Export new schema

**Schema:**
```typescript
// printer table
const printer = pgTable("printer", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organization.id),
  locationId: uuid("location_id").notNull().references(() => location.id),
  name: text("name").notNull(),
  connectionType: text("connection_type").notNull().default("network"), // network | usb | bluetooth
  address: text("address"), // IP:port for network, null for USB
  paperWidth: text("paper_width").notNull().default("80mm"), // 58mm | 80mm
  isActive: boolean("is_active").notNull().default(true),
  autoCut: boolean("auto_cut").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// printerRoute table - which categories print to which printers
const printerRoute = pgTable("printer_route", {
  id: uuid("id").primaryKey().defaultRandom(),
  printerId: uuid("printer_id").notNull().references(() => printer.id, { onDelete: "cascade" }),
  reportingCategoryId: uuid("reporting_category_id").notNull().references(() => reportingCategory.id),
}, (table) => [
  primaryKey({ columns: [table.printerId, table.reportingCategoryId] }),
]);
```

**Acceptance Criteria:**
- [ ] PrintService interface with `printReceipt()`, `printKOT()`, `printBill()` methods
- [ ] WebUSB adapter connects to USB thermal printer
- [ ] Network adapter sends to IP:port
- [ ] Browser print fallback always works
- [ ] Printer + printerRoute tables created

---

### Task 0.3: Schema Migrations
**Files to modify:**
- `packages/db/src/schema/order.ts` — Add tipAmount to order and payment; add tabName to order
- `packages/db/src/schema/order.ts` — Add courseNumber to orderLineItem
- `packages/db/src/schema/kitchen.ts` — Add floor table; extend tableLayout (floorId, width, height); extend kitchenOrderItem (firedAt, completedAt); extend kitchenOrderTicket (station)

**Specific changes:**

```typescript
// order.ts additions:
// On order table: tipAmount: numeric("tip_amount", { precision: 10, scale: 2 }).default("0")
// On order table: tabName: text("tab_name")
// On payment table: tipAmount: numeric("tip_amount", { precision: 10, scale: 2 }).default("0")
// On orderLineItem: courseNumber: integer("course_number").default(1)

// kitchen.ts additions:
// New floor table:
const floor = pgTable("floor", {
  id: uuid("id").primaryKey().defaultRandom(),
  locationId: uuid("location_id").notNull().references(() => location.id),
  name: text("name").notNull(),
  backgroundImage: text("background_image"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// On tableLayout: floorId: uuid("floor_id").references(() => floor.id)
// On tableLayout: width: integer("width").notNull().default(100)
// On tableLayout: height: integer("height").notNull().default(100)
// On kitchenOrderItem: firedAt: timestamp("fired_at", { withTimezone: true })
// On kitchenOrderItem: completedAt: timestamp("completed_at", { withTimezone: true })
// On kitchenOrderTicket: station: text("station")
```

**Acceptance Criteria:**
- [ ] `bun run db:push` succeeds with no errors
- [ ] All new columns are nullable or have defaults (backward compatible)
- [ ] Existing data is not affected

---

## Sprint 1: Core Restaurant Operations (Week 3-5)

### Task 1.1: KDS Full-Screen Display
**Files to create/modify:**
- `apps/web/src/routes/kds.tsx` — Full-screen KDS route (no sidebar/header)
- `apps/web/src/components/kds/kds-order-card.tsx` — Individual order card component
- `apps/web/src/components/kds/kds-header.tsx` — Station selector, stats bar
- `packages/api/src/routers/kds.ts` — KDS-specific router
- `packages/api/src/routers/index.ts` — Register kds router

**KDS Design:**
- Full-screen grid of order cards (4-8 columns depending on screen width)
- Each card shows: order number, type (dine-in/takeout), table number, elapsed time, items with modifiers
- Color coding: white (0-5 min), yellow (5-10 min), orange (10-15 min), red (15+ min)
- Tap card → bump item (mark as done)
- Station filter dropdown (All, Kitchen, Bar, Grill, etc.)
- Audio chime on new order
- WebSocket subscription to `pos:kds` channel

**Acceptance Criteria:**
- [ ] KDS displays pending orders in real-time
- [ ] New orders appear with audio alert
- [ ] Cards change color based on elapsed time
- [ ] Tap to bump/complete items
- [ ] Station filtering works
- [ ] Works full-screen on TV/tablet

---

### Task 1.2: Floor Plan Visual Editor
**Files to create/modify:**
- `apps/web/src/routes/dashboard.tables.tsx` — Enhance with drag-drop editor
- `apps/web/src/components/tables/floor-plan-editor.tsx` — Canvas-based editor
- `apps/web/src/components/tables/table-shape.tsx` — Individual table shape component
- `packages/api/src/routers/floor-plan.ts` — Floor CRUD + table batch save
- `packages/api/src/routers/index.ts` — Register floor-plan router

**Implementation approach:**
- Use Pointer Events API (no library dependency, works on touch + mouse)
- Edit mode: add tables from palette, drag to position, resize, set properties
- Live mode: real-time status colors via WebSocket subscription to `pos:tables`
- Tap table in live mode → open current order or create new order

**Acceptance Criteria:**
- [ ] Can create floors and add tables with drag-drop
- [ ] Tables show live status (available/occupied/reserved/dirty)
- [ ] Tap occupied table → shows order summary
- [ ] Tap available table → starts new order for that table
- [ ] Layout persists across page reloads

---

### Task 1.3: Order Type Presets
**Files to modify:**
- `apps/web/src/components/pos/pos-terminal.tsx` — Add order type selection flow
- `apps/web/src/components/pos/order-type-selector.tsx` — New component

**Flow:**
1. Start new order → type selector appears (Dine-in | Takeout | Delivery | Quick Sale)
2. Dine-in → floor plan table picker → guest count → POS grid
3. Takeout → customer name + estimated ready time → POS grid
4. Delivery → customer search/add + delivery address → POS grid
5. Quick Sale → straight to POS grid (no table/customer)

**Acceptance Criteria:**
- [ ] Order type selector shown when starting new order
- [ ] Dine-in flow includes table selection
- [ ] Takeout shows name + time fields
- [ ] Delivery shows customer + address fields
- [ ] register.workflowMode is respected

---

### Task 1.4: 86 System
**Files to modify:**
- `apps/web/src/components/pos/product-grid.tsx` — Show 86'd items as unavailable
- `packages/api/src/routers/products.ts` — Add toggle86 procedure
- WebSocket broadcast on `pos:86` channel

**Acceptance Criteria:**
- [ ] Can mark item as 86'd from POS or kitchen
- [ ] 86'd items appear grayed out with "86" badge on all terminals
- [ ] WebSocket broadcasts change immediately
- [ ] Can un-86 an item

---

### Task 1.5: Tab Management
**Files to modify:**
- `apps/web/src/components/pos/pos-terminal.tsx` — Add "Open Tab" and "Recall Tab" actions
- `apps/web/src/components/pos/tab-list-dialog.tsx` — New component for listing open tabs
- `packages/api/src/routers/orders.ts` — Add tab-specific queries

**Acceptance Criteria:**
- [ ] Can open a tab with a customer name
- [ ] Tab stays open after items are added (no forced payment)
- [ ] Can recall and add items to an existing tab
- [ ] Can close tab (triggers normal payment flow)
- [ ] Tab list shows all open tabs with totals

---

### Task 1.6: Table Transfer & Merge
**Files to modify:**
- `packages/api/src/routers/tables.ts` — Add transfer and merge procedures
- `apps/web/src/routes/dashboard.tables.tsx` — Add transfer/merge UI actions

**Acceptance Criteria:**
- [ ] Can transfer order from table A to table B
- [ ] Table A becomes available, table B becomes occupied
- [ ] Can merge two occupied tables' orders into one
- [ ] Both actions broadcast via WebSocket

---

### Task 1.7: Tip Management
**Files to modify:**
- `apps/web/src/components/pos/payment-dialog.tsx` — Add tip selection UI
- `packages/api/src/routers/orders.ts` — Handle tip in order completion
- `packages/api/src/routers/reports.ts` — Add tip reporting

**Acceptance Criteria:**
- [ ] Tip percentage buttons (10%, 15%, 18%, 20%, custom)
- [ ] Tip amount added to order total
- [ ] Tip appears on receipt
- [ ] Tip report available in dashboard.reports

---

### Task 1.8: Course Management
**Files to modify:**
- `apps/web/src/components/pos/pos-terminal.tsx` — Add course number selector per item
- `apps/web/src/components/pos/cart-panel.tsx` — Group items by course
- `packages/api/src/routers/kitchen.ts` — Fire course creates KOT for specific course only

**Acceptance Criteria:**
- [ ] Can assign items to courses (1, 2, 3...)
- [ ] Cart groups items by course
- [ ] "Fire Course X" button sends only that course's items to KDS/printer
- [ ] KDS shows course number on each order

---

## Sprint 2: Printing & Multi-Terminal (Week 6-8)

### Task 2.1: ESC/POS Receipt Printing
Implement WebUSB and network printing using WebUSBReceiptPrinter + ReceiptPrinterEncoder libraries.

### Task 2.2: KOT Printing with Category Routing
Auto-print KOTs to configured printers based on product category when orders are submitted.

### Task 2.3: Printer Configuration UI
Dashboard page to add/edit/test printers and configure category→printer routing rules.

### Task 2.4: Multi-Terminal Sync
Ensure all order, table, 86, and session events broadcast via WebSocket to all connected terminals.

### Task 2.5: Touch Optimization
Audit all POS screens for 44px minimum touch targets, add swipe gestures where appropriate.

### Task 2.6: Media Upload for Products
Add image upload/crop functionality to product create/edit forms. Store locally or S3.

---

## Sprint 3: Offline & Reliability (Week 9-11)

### Task 3.1: Service Worker + Workbox
Cache-first for static assets, network-first for API data. App shell architecture.

### Task 3.2: IndexedDB Local Store
Mirror critical tables (products, categories, modifiers, floor plan, PIN hashes) in Dexie.js.

### Task 3.3: Offline Order Creation
Write orders to IndexedDB first, sync to server when online. Idempotent mutations via client-generated UUIDs.

### Task 3.4: Conflict Resolution
LWW (last-write-wins) for status fields, merge for order items. Manager review for conflicts.

### Task 3.5: Sync Status UI
Enhance sync-indicator.tsx with pending sync count, force sync button, online/syncing/offline states.

### Task 3.6: Reservation System
New reservation schema + booking UI integrated with floor plan.

---

## Sprint 4: Customer Experience (Week 12-13)

### Task 4.1: QR Code Table Ordering
Generate unique QR code per table. Customer scans → sees menu → places order → goes to KDS.

### Task 4.2: Self-Ordering Kiosk
Full-screen customer-facing UI optimized for dine-in kiosks. Large images, simple navigation.

### Task 4.3: Customer-Specific Pricing
New pricelist + pricelistItem tables. Apply customer's pricelist when linked to order.

---

## Sprint 5: Polish & Scale (Week 14-16)

### Task 5.1: i18n Framework
Integrate react-i18next or similar. Extract all strings. Start with English + Spanish.

### Task 5.2: Shift Scheduling
New shift schema + calendar-style scheduling UI.

### Task 5.3: Auto-Reorder PO Generation
Background check of min levels → auto-generate draft POs for items below threshold.

### Task 5.4: Void/Comp Report
Dedicated void/comp report page with reason analysis.

### Task 5.5: Customer Analytics
Frequency, retention, CLV metrics dashboard.

### Task 5.6: Waitlist Management
Simple queue management with estimated wait times.

---

## Sprint 6: Integrations & Future (Week 17-18)

### Task 6.1: Delivery Platform Hooks
API stubs for UberEats/DoorDash order ingestion.

### Task 6.2: Customer Feedback
Post-order feedback flow (QR code on receipt → rating + comment).

### Task 6.3: Performance Optimization
Query optimization, code splitting, lazy loading for dashboard pages.

### Task 6.4: Documentation Update
Update fumadocs with new features and API documentation.

### Task 6.5: Security Audit
Rate limiting review, CSRF protection, input sanitization.

---

## Key Technical Decisions

### WebSocket vs SSE
**Decision**: WebSocket (bidirectional needed for KDS bump actions, 86 toggles)
**Library**: Hono's built-in WebSocket helper with Bun adapter

### Floor Plan Rendering
**Decision**: Pointer Events API (native, no library, works on touch)
**Alternative considered**: react-konva (heavier but more features)

### Offline Storage
**Decision**: Dexie.js (IndexedDB wrapper with sync support)
**Alternative considered**: PouchDB (too heavy, CouchDB dependency)

### Print Library
**Decision**: WebUSBReceiptPrinter + ReceiptPrinterEncoder
**Alternative considered**: node-escpos (server-side, less flexible for web)

### Conflict Resolution
**Decision**: LWW (Last-Write-Wins) with manager review for conflicts
**Alternative considered**: CRDTs (overkill for POS use case)

---

## Dependencies Graph

```
GAP-002 (WebSocket) ──→ GAP-001 (KDS)
                    ──→ GAP-008 (86 System)
                    ──→ GAP-012 (Multi-Terminal)
                    ──→ GAP-003 (Floor Plan live status)

GAP-005 (Print Service) ──→ GAP-015 (Printer Routing)

GAP-006 (Offline) depends on all Sprint 0-1 features being stable

GAP-014 (QR/Kiosk) ──→ GAP-001 (KDS for order display)
```

---

## Risk Assessment

| Sprint | Risk | Mitigation |
|--------|------|-----------|
| S0 | WebSocket may not work with existing Hono/Bun setup | Test early, fallback to SSE |
| S1 | Floor plan editor complexity | Start with basic positioning, add resize/shapes later |
| S2 | WebUSB browser support limited | Provide network printer fallback, browser print fallback |
| S3 | Offline sync conflicts | Use simple LWW, avoid complex merge scenarios initially |
| S4 | QR ordering security | Rate limiting, order validation, optional payment requirement |
| S5 | i18n scope creep | Start with POS-only screens, expand later |
