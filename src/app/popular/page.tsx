"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  ConfessionCard,
  ConfessionSkeleton,
  ErrorMessage,
  StateMessage,
  type ConfessionItem,
} from "@/components/site/confession-list"

function RankBadge({ rank }: { rank: number }) {
  const top = rank <= 3
  return (
    <span
      aria-label={`Rank ${rank}`}
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
        top
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground"
      )}
    >
      {rank}
    </span>
  )
}

export default function PopularPage() {
  const [items, setItems] = useState<ConfessionItem[]>([])
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const router = useRouter()

  const load = useCallback(async () => {
    setStatus("loading")
    try {
      const res = await fetch("/api/confessions/popular")
      if (res.status === 401) {
        router.push("/login")
        return
      }
      if (!res.ok) throw new Error("Request failed")
      const data = (await res.json()) as { confessions: ConfessionItem[] }
      setItems(data.confessions)
      setStatus("ready")
    } catch {
      setStatus("error")
    }
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Trending 🔥</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The confessions campus can't stop reacting to.
        </p>
      </div>

      {status === "loading" && <ConfessionSkeleton />}

      {status === "error" && (
        <ErrorMessage
          description="The leaderboard took a personal day. Try again?"
          onRetry={load}
        />
      )}

      {status === "ready" && items.length === 0 && (
        <StateMessage
          emoji="📉"
          title="Nothing's trending yet"
          description="Reactions make the chart. Go react to something."
        />
      )}

      {status === "ready" &&
        items.map((item, i) => (
          <ConfessionCard
            key={item.id}
            item={item}
            leading={<RankBadge rank={i + 1} />}
          />
        ))}
    </div>
  )
}
