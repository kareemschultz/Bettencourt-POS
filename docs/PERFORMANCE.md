# Performance Report

**Date:** 2026-03-07  
**Environment:** Production (https://pos.karetechsolutions.com)  
**Docker image:** 189 MB (distroless/cc-debian12 + bun compiled binary)  
**Protocol:** HTTP/2

---

## Summary

| Metric | Dashboard | POS Terminal | Target | Status |
|--------|-----------|-------------|--------|--------|
| TTFB | 18 ms | 843 ms | < 200 ms | ✅ / ⚠️ |
| First Paint | 264 ms | — | < 1000 ms | ✅ |
| FCP | 1048 ms | 3660 ms | < 1800 ms | ✅ / ⚠️ |
| DOM Interactive | 271 ms | 1282 ms | < 2000 ms | ✅ |
| Load Event | 584 ms | 1662 ms | < 3000 ms | ✅ |
| Total Transfer | 2333 KB | 2055 KB | < 3000 KB | ✅ |
| Resources | 92 | 96 | — | — |
| Long Tasks | 0 | 0 | 0 | ✅ |
| Total Blocking Time | 0 ms | 0 ms | < 200 ms | ✅ |

---

## Dashboard Page

**Measured from cold navigation (authenticated session)**

- **TTFB: 18 ms** — server response is near-instant; Hono/Bun is extremely efficient
- **First Paint: 264 ms** — browser renders the shell quickly
- **FCP: 1048 ms** — first contentful paint under 1.1s; within acceptable range
- **Load Complete: 584 ms** — full page ready in under 600ms

### API Calls
- `settings/getCurrentUser` — ~50 ms
- `locations/listLocations` — ~51 ms  
- Dashboard summary queries — fast (< 100 ms each)

---

## POS Terminal Page

**Most performance-critical page — used during every transaction**

- **TTFB: 843 ms** — higher due to direct navigation (cold auth check + redirect chain)
- **FCP: 3660 ms** — slower first paint due to JS chunk parsing after redirect
- **Load Complete: 1662 ms** — products and UI fully ready in 1.7s
- **Long Tasks: 0** — no main thread blocking; UI stays responsive

### API Response Times (excellent)
| Endpoint | Time | Size |
|----------|------|------|
| `pos/getProducts` | 122 ms | 11 KB |
| `settings/getCurrentUser` | 52 ms | 1 KB |
| `locations/listLocations` | 51 ms | 1 KB |

All API responses are under 200 ms. The POS product catalog loads in 122 ms.

---

## Identified Bottlenecks

### 1. Recharts bundle (351 KB) — loaded on every page
**File:** `CartesianChart-D88a24rG.js` (351 KB, loads in 1.2s)

The Recharts charting library is in the shared chunk and loaded on every page navigation, even when no charts are displayed. It accounts for ~15% of the total transfer size.

**Recommended fix:** Lazy-import Recharts only inside the Reports and Analytics route files:
```typescript
// Instead of: import { LineChart } from "recharts"
const { LineChart } = await import("recharts"); // inside the route component
```

### 2. 50+ tiny icon chunks (each ~0.5 KB, each 500–1300 ms load time)
Individual lucide icon files are split into separate chunks. With HTTP/2 multiplexing this is parallelized, but connection overhead adds up (50+ round-trips).

**Root cause:** Each sidebar icon is imported individually. Since the sidebar renders on every page, all icon chunks load upfront.

**Recommended fix:** Import all sidebar icons from a single barrel import or use a single `lucide-react` bundle entry:
```typescript
// Consolidate in app-sidebar.tsx to encourage bundler merging
import { LayoutGrid, ShoppingCart, ChefHat, ... } from "lucide-react";
```

Alternatively, set a Vite chunk size floor to prevent sub-1KB chunks:
```typescript
// vite.config.ts
build: { rollupOptions: { output: { experimentalMinChunkSize: 2000 } } }
```

### 3. FCP on POS Terminal (3.66s)
The 3.66s FCP on direct POS navigation is caused by the redirect chain (root → login → auth check → /dashboard/pos) each requiring a round-trip. After initial app load, client-side navigation between routes takes < 50ms.

---

## What's Working Well

- **Zero long tasks** — the main thread is never blocked, keeping interactions responsive
- **TTFB 18ms** — Hono + compiled Bun binary is extremely fast at serving requests  
- **HTTP/2** — all assets served over H2 (multiplexed), mitigating the many-chunks issue
- **API performance** — all RPC endpoints respond under 200ms
- **PWA caching** — service worker precaches 164 assets (2881 KB), subsequent visits load instantly from cache
- **Code splitting** — each route has its own chunk; unused routes are never downloaded
- **No layout shift** — CLS is not detected; elements don't jump around during load

---

## Recommendations (Priority Order)

| Priority | Fix | Expected Gain |
|----------|-----|--------------|
| High | Lazy-load Recharts (351 KB) | −350 KB initial transfer, −1.2s for non-report pages |
| Medium | Increase Vite `experimentalMinChunkSize` to 2 KB | Merge 50+ tiny icon chunks → fewer requests |
| Low | Add `<link rel="preconnect">` for the API domain | −10–30ms on first API call |
| Low | Add `modulepreload` hint for `pos-terminal.js` on dashboard | Faster POS navigation |

---

## Conclusion

The app performs well for a production POS system. Server response is near-instant (18ms TTFB), API calls are under 200ms, and there are zero long tasks blocking the UI. The PWA service worker ensures repeat visits load from cache.

The main opportunity is the 351 KB Recharts bundle loading on all pages — lazy-loading this alone would improve initial FCP by ~0.5–1s.
