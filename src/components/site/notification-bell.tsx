"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { BellIcon, CheckCheckIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { relativeTime } from "@/components/site/format"

type Notification = {
  id: string
  type: string
  confessionId?: string | null
  read: boolean
  createdAt: string
}

const TYPE_META: Record<string, { emoji: string; label: string }> = {
  confession_approved: { emoji: "✅", label: "Confession approved" },
  confession_rejected: { emoji: "❌", label: "Confession rejected" },
}

function metaFor(type: string) {
  return TYPE_META[type] ?? { emoji: "🔔", label: "Notification" }
}

export function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([])
  const [loaded, setLoaded] = useState(false)
  const router = useRouter()

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications")
      if (!res.ok) return
      const data = (await res.json()) as { notifications: Notification[] }
      setItems(data.notifications ?? [])
    } catch {
      // bell is best-effort; stay quiet on failure
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const unread = items.filter((n) => !n.read).length

  async function markRead(ids?: string[]) {
    setItems((prev) =>
      prev.map((n) => (!ids || ids.includes(n.id) ? { ...n, read: true } : n))
    )
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ids ? { action: "read", ids } : { action: "read" }),
      })
    } catch {
      // ignore; server will catch up next fetch
    }
  }

  function onItemClick(n: Notification) {
    if (!n.read) void markRead([n.id])
    if (n.confessionId) router.push(`/post/${n.confessionId}`)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
            className="relative"
          >
            <BellIcon />
            {unread > 0 && (
              <span
                aria-hidden
                className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground"
              >
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)]">
        <div className="flex items-center justify-between px-1.5 py-1">
          <p className="text-xs font-medium text-muted-foreground">Notifications</p>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => void markRead()}
              className="gap-1 text-muted-foreground"
            >
              <CheckCheckIcon data-icon="inline-start" />
              Mark all read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator className="my-0" />
        {loaded && items.length === 0 && (
          <p className="px-1.5 py-6 text-center text-sm text-muted-foreground">
            All caught up ✨
          </p>
        )}
        {!loaded && (
          <div className="grid gap-1 p-1.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-9 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        )}
        <div className="max-h-80 overflow-y-auto">
          {items.map((n) => {
            const meta = metaFor(n.type)
            return (
              <DropdownMenuItem
                key={n.id}
                onClick={() => onItemClick(n)}
                className={`items-start gap-2 py-1.5 ${
                  n.read ? "opacity-70" : "bg-muted/40 font-medium"
                }`}
              >
                <span aria-hidden className="mt-0.5 shrink-0 text-base">
                  {meta.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm leading-snug">{meta.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {relativeTime(n.createdAt)}
                  </span>
                </span>
                {!n.read && (
                  <span
                    aria-hidden
                    className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
                  />
                )}
              </DropdownMenuItem>
            )
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
