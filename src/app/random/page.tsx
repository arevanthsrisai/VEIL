"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  ConfessionCard,
  ConfessionSkeleton,
  ErrorMessage,
  StateMessage,
  type ConfessionItem,
} from "@/components/site/confession-list"

export default function RandomPage() {
  const [items, setItems] = useState<ConfessionItem[]>([])
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const router = useRouter()

  const load = useCallback(async () => {
    setStatus("loading")
    try {
      const res = await fetch("/api/confessions/random")
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
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Surprise me 🎲</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A random handful from the archive. Roll again for more.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={status === "loading"} className="shrink-0">
          {status === "loading" ? "Shuffling…" : "Shuffle"}
        </Button>
      </div>

      {status === "loading" && <ConfessionSkeleton />}

      {status === "error" && (
        <ErrorMessage
          description="The dice landed off the table. Try again?"
          onRetry={load}
        />
      )}

      {status === "ready" && items.length === 0 && (
        <StateMessage
          emoji="🎲"
          title="Nothing to shuffle yet"
          description="The archive is empty. Post something first."
        />
      )}

      {status === "ready" &&
        items.map((item) => <ConfessionCard key={item.id} item={item} />)}
    </div>
  )
}
