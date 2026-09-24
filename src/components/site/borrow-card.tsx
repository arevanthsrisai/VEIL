"use client"

import { useState } from "react"
import { toast } from "sonner"
import { CheckIcon, RecycleIcon, XIcon } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { relativeTime } from "@/components/site/format"
import type { BorrowItem } from "@/lib/borrow"

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  AVAILABLE: "default",
  BORROWED: "secondary",
  RETURNED: "outline",
  CLOSED: "outline",
}

export function BorrowCard({
  item,
  onUpdate,
}: {
  item: BorrowItem
  onUpdate: (item: BorrowItem) => void
}) {
  const [busy, setBusy] = useState(false)

  async function act(action: "CLAIM" | "RETURNED" | "CLOSED") {
    setBusy(true)
    try {
      const res = await fetch(`/api/borrow/${encodeURIComponent(item.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (res.status === 401) {
        toast.error("Log in first 🔑")
        return
      }
      if (res.status === 409) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        toast.error(data?.error ?? "Someone beat you to it ⚡")
        return
      }
      if (!res.ok) {
        toast.error("Something went wrong. Try again.")
        return
      }
      const data = (await res.json()) as { item: BorrowItem }
      onUpdate(data.item)
      toast.success(
        action === "CLAIM"
          ? "Marked as borrowed 🤝"
          : action === "RETURNED"
            ? "Marked as returned ♻️"
            : "Listing closed",
      )
    } catch {
      toast.error("Something went wrong. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="gap-2">
        <div className="flex items-center gap-2.5">
          <Avatar size="sm" aria-hidden>
            <AvatarFallback className="text-sm">{item.avatarEmoji}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{item.nickname}</p>
            <p className="text-xs text-muted-foreground">{relativeTime(item.createdAt)}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline">{item.category}</Badge>
            <Badge variant={STATUS_VARIANT[item.status] ?? "outline"}>{item.status}</Badge>
          </div>
        </div>
        <CardTitle className="text-[15px]">{item.title}</CardTitle>
      </CardHeader>
      {item.description && (
        <CardContent>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {item.description}
          </p>
        </CardContent>
      )}
      <CardFooter className="flex-wrap gap-2">
        {item.status === "AVAILABLE" && !item.isMine && (
          <Button size="sm" disabled={busy} aria-label={`Claim ${item.title}`} onClick={() => act("CLAIM")}>
            <CheckIcon data-icon="inline-start" />
            Claim
          </Button>
        )}
        {(item.status === "BORROWED" && item.isMine) && (
          <Button variant="outline" size="sm" disabled={busy} aria-label={`Mark ${item.title} as returned`} onClick={() => act("RETURNED")}>
            <RecycleIcon data-icon="inline-start" />
            Mark returned
          </Button>
        )}
        {item.isMine && item.status !== "CLOSED" && (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            aria-label={`Close listing for ${item.title}`}
            className="ml-auto"
            onClick={() => act("CLOSED")}
          >
            <XIcon data-icon="inline-start" />
            Close listing
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
