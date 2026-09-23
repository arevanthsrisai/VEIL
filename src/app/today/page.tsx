"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ConfessionCard,
  ConfessionSkeleton,
  ErrorMessage,
  StateMessage,
  type ConfessionItem,
} from "@/components/site/confession-list"

export default function TodayPage() {
  const [items, setItems] = useState<ConfessionItem[]>([])
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const router = useRouter()

  const load = useCallback(async () => {
    setStatus("loading")
    try {
      const res = await fetch("/api/confessions/today")
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
        <h1 className="text-2xl font-semibold tracking-tight">Today 📅</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything posted since midnight, freshest first.
        </p>
      </div>

      {status === "loading" && <ConfessionSkeleton />}

      {status === "error" && (
        <ErrorMessage
          description="Today's page went quiet. Try again?"
          onRetry={load}
        />
      )}

      {status === "ready" && items.length === 0 && (
        <StateMessage
          emoji="🌅"
          title="Nothing posted today yet"
          description="Be the first — the day is still young."
        />
      )}

      {status === "ready" &&
        items.map((item) => <ConfessionCard key={item.id} item={item} />)}
    </div>
  )
}
