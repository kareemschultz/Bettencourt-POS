import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Wifi, WifiOff, RefreshCw, CloudOff, Check } from "lucide-react"
import { getOnlineStatus, onStatusChange, syncPendingOperations, getPendingCount } from "@/lib/offline"

export function SyncIndicator() {
  const [online, setOnline] = useState(true)
  const [pending, setPending] = useState(0)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    setOnline(getOnlineStatus())
    const cleanup = onStatusChange(setOnline)

    const checkPending = async () => {
      try {
        const count = await getPendingCount()
        setPending(count)
      } catch {
        // IndexedDB not available
      }
    }

    checkPending()
    const interval = setInterval(checkPending, 10000)

    return () => {
      cleanup()
      clearInterval(interval)
    }
  }, [])

  // Auto-sync when coming back online
  useEffect(() => {
    if (online && pending > 0) {
      handleSync()
    }
  }, [online])

  async function handleSync() {
    if (syncing) return
    setSyncing(true)
    try {
      const result = await syncPendingOperations()
      setPending(result.remaining)
    } catch {
      // Sync failed
    }
    setSyncing(false)
  }

  if (online && pending === 0) {
    return (
      <Badge variant="outline" className="gap-1.5 bg-emerald-500/10 text-emerald-600 border-emerald-200">
        <Wifi className="h-3 w-3" />
        <span className="hidden sm:inline">Online</span>
      </Badge>
    )
  }

  if (!online) {
    return (
      <Badge variant="outline" className="gap-1.5 bg-amber-500/10 text-amber-600 border-amber-200">
        <WifiOff className="h-3 w-3" />
        <span className="hidden sm:inline">Offline</span>
        {pending > 0 && <span className="font-mono">({pending})</span>}
      </Badge>
    )
  }

  return (
    <Button variant="outline" size="sm" className="gap-1.5 h-7" onClick={handleSync} disabled={syncing}>
      {syncing ? (
        <RefreshCw className="h-3 w-3 animate-spin" />
      ) : (
        <CloudOff className="h-3 w-3" />
      )}
      {pending} pending
    </Button>
  )
}
