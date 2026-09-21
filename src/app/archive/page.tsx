"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  ConfessionCard,
  ConfessionSkeleton,
  ErrorMessage,
  StateMessage,
  type ConfessionItem,
} from "@/components/site/confession-list"

function dayHeading(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "Unknown date"
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

function groupByDay(items: ConfessionItem[]): [string, ConfessionItem[]][] {
  const groups: [string, ConfessionItem[]][] = []
  for (const item of items) {
    const key = dayHeading(item.createdAt)
    const last = groups[groups.length - 1]
    if (last && last[0] === key) last[1].push(item)
    else groups.push([key, [item]])
  }
  return groups
}

export default function ArchivePage() {
  const [items, setItems] = useState<ConfessionItem[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [loadingMore, setLoadingMore] = useState(false)

  const load = useCallback(
    async (nextCursor: string | null, initial: boolean) => {
      if (initial) setStatus("loading")
      else setLoadingMore(true)
      try {
        const qs = nextCursor
          ? `?cursor=${encodeURIComponent(nextCursor)}`
          : ""
        const res = await fetch(`/api/confessions${qs}`)
        if (!res.ok) throw new Error("Request failed")
        const data = (await res.json()) as {
          confessions: ConfessionItem[]
          nextCursor: string | null
        }
        setItems((prev) =>
          initial ? data.confessions : [...prev, ...data.confessions]
        )
        setCursor(data.nextCursor)
        setStatus("ready")
      } catch {
        if (initial) setStatus("error")
        else setLoadingMore(false)
      } finally {
        setLoadingMore(false)
      }
    },
    []
  )

  useEffect(() => {
    load(null, true)
  }, [load])

  const groups = status === "ready" ? groupByDay(items) : []

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Archive 🗄️</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every confession, day by day. Nothing deleted, nothing forgotten.
        </p>
      </div>

      {status === "loading" && <ConfessionSkeleton />}

      {status === "error" && (
        <ErrorMessage
          description="The archive door is stuck. Try again?"
          onRetry={() => load(null, true)}
        />
      )}

      {status === "ready" && items.length === 0 && (
        <StateMessage
          emoji="🕸️"
          title="The archive is empty"
          description="Dust and echoes. Post something and make history."
        />
      )}

      {groups.map(([day, dayItems]) => (
        <section key={day} className="grid gap-3" aria-label={day}>
          <h2 className="text-sm font-medium text-muted-foreground">{day}</h2>
          <div className="grid gap-4">
            {dayItems.map((item) => (
              <ConfessionCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      ))}

      {status === "ready" && cursor && items.length > 0 && (
        <Button
          variant="outline"
          size="lg"
          disabled={loadingMore}
          onClick={() => load(cursor, false)}
          className="w-full"
        >
          {loadingMore ? "Loading…" : "Load more"}
        </Button>
      )}
    </div>
  )
}
