/**
 * Offline Mode Manager
 * Uses IndexedDB for queuing operations when network is unavailable.
 * Provides sync indicator state and retry mechanism.
 */

const DB_NAME = "primeroute_offline"
const DB_VERSION = 2
const STORE_NAME = "pending_operations"
const PRODUCT_STORE = "cached_products"
const DATA_STORE = "cached_data"

interface PendingOperation {
  id: string
  url: string
  method: string
  body?: string
  createdAt: number
  retries: number
  maxRetries: number
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" })
      }
      if (!db.objectStoreNames.contains(PRODUCT_STORE)) {
        db.createObjectStore(PRODUCT_STORE, { keyPath: "id" })
      }
      if (!db.objectStoreNames.contains(DATA_STORE)) {
        db.createObjectStore(DATA_STORE, { keyPath: "key" })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function addOperation(op: PendingOperation): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    tx.objectStore(STORE_NAME).add(op)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function getAllOperations(): Promise<PendingOperation[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const request = tx.objectStore(STORE_NAME).getAll()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function removeOperation(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function updateOperation(op: PendingOperation): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    tx.objectStore(STORE_NAME).put(op)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// === Offline-aware fetch wrapper ===
export async function offlineFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  try {
    const response = await fetch(url, options)
    return response
  } catch {
    // Network error - queue for later if it's a mutation
    if (options.method && options.method !== "GET") {
      const op: PendingOperation = {
        id: crypto.randomUUID(),
        url,
        method: options.method,
        body: options.body as string | undefined,
        createdAt: Date.now(),
        retries: 0,
        maxRetries: 5
      }
      await addOperation(op)
      console.log("[Offline] Queued operation:", op.id)

      // Return a synthetic response
      return new Response(JSON.stringify({ queued: true, operationId: op.id }), {
        status: 202,
        headers: { "Content-Type": "application/json" }
      })
    }
    throw new Error("Network unavailable")
  }
}

// === Sync Engine ===
export async function syncPendingOperations(): Promise<{
  synced: number
  failed: number
  remaining: number
}> {
  const operations = await getAllOperations()
  let synced = 0
  let failed = 0

  for (const op of operations) {
    try {
      const response = await fetch(op.url, {
        method: op.method,
        headers: { "Content-Type": "application/json" },
        body: op.body
      })

      if (response.ok) {
        await removeOperation(op.id)
        synced++
      } else {
        op.retries++
        if (op.retries >= op.maxRetries) {
          await removeOperation(op.id)
          failed++
          console.error("[Offline] Max retries reached for:", op.id)
        } else {
          await updateOperation(op)
          failed++
        }
      }
    } catch {
      // Still offline
      break
    }
  }

  const remaining = (await getAllOperations()).length
  return { synced, failed, remaining }
}

export async function getPendingCount(): Promise<number> {
  const ops = await getAllOperations()
  return ops.length
}

// === Online/Offline Status ===
export function getOnlineStatus(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true
}

export function onStatusChange(callback: (online: boolean) => void): () => void {
  const handleOnline = () => callback(true)
  const handleOffline = () => callback(false)

  window.addEventListener("online", handleOnline)
  window.addEventListener("offline", handleOffline)

  return () => {
    window.removeEventListener("online", handleOnline)
    window.removeEventListener("offline", handleOffline)
  }
}

// === Product Cache ===
export async function cacheProducts(products: Record<string, unknown>[]): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(PRODUCT_STORE, "readwrite")
  const store = tx.objectStore(PRODUCT_STORE)
  // Clear old
  store.clear()
  for (const p of products) {
    store.put(p)
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getCachedProducts(): Promise<Record<string, unknown>[]> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PRODUCT_STORE, "readonly")
      const request = tx.objectStore(PRODUCT_STORE).getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  } catch {
    return []
  }
}

// === Generic Data Cache ===
export async function cacheData(key: string, data: unknown): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(DATA_STORE, "readwrite")
  tx.objectStore(DATA_STORE).put({ key, data, cachedAt: Date.now() })
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getCachedData(key: string): Promise<{ data: unknown; cachedAt: number } | null> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DATA_STORE, "readonly")
      const request = tx.objectStore(DATA_STORE).get(key)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  } catch {
    return null
  }
}
