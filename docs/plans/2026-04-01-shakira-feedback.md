# Shakira Feedback — 2026-04-01

## Source
Telegram screenshots, ~2026-04-01

## Feedback Items

### BUG-01: Shift Open/Close Not Working (CRITICAL)
"I trying to open and close shift and it can't open"
**Root cause**: `openSession` handler throws CONFLICT if a session is already open for the register (partial unique index `uq_cash_session_open_register` on registerId WHERE status='open'). Likely stale open session in DB.
**Fix**: 
1. Check DB for orphaned open sessions: `SELECT id, opened_at, status FROM cash_session WHERE status = 'open'`
2. UI: show clear "A shift is already open" error message instead of silent failure
3. Add "Force Close" option for managers when a stale session exists

### UI-01: Hide Unused Navigation Items
Shakira flagged these items as unused and cluttering the sidebar:
- Tables (`/dashboard/tables`) 
- Reservations (`/dashboard/reservations`)
- Tips Report (`/dashboard/tips`)
**Fix**: Set `hidden: true` on these items in `apps/web/src/lib/modules.ts`

### UI-02: Denomination Breakdown in Close Shift
Shakira wants to count cash by GYD note denominations when closing a shift:
- Notes: $5000, $1000, $500, $100, $20
- System calculates total from denomination quantities
- Total feeds into the existing `closingCount` field
**Fix**: Replace single "Cash Count" input in Close Shift dialog with denomination grid

### UI-03: Open Price Restriction
"Open Price" should be restricted to Bonita (executive role) and admins only.
**Status**: Deferred — need to confirm which UI element this refers to (likely a price override or custom price field in the POS screen). Leave as TODO.

### UI-04: Receipt Header
Correct business name and address on receipts. Current state unclear.
**Status**: Deferred — Master Kareem to confirm: "Bettencourt's Food Inc." vs "Bettencourts Diner", and "Lot 12 Robb St" vs "ZZ 22 Durban St, Bourda".

## Implementation Plan
- [x] Document feedback
- [ ] BUG-01: Fix shift open error handling in cash-control-panel.tsx
- [ ] UI-01: Hide Tables, Reservations, Tips Report in modules.ts
- [ ] UI-02: Add denomination breakdown grid to Close Shift dialog
- [ ] Rebuild + redeploy kt-bettencourt-pos
- [ ] Push to GitHub
