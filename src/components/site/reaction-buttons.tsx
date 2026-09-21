"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const EMOJIS = ["🔥", "😂", "❤️", "😮", "😢", "👍"] as const

type ReactionButtonsProps = {
  confessionId: string
  initialCounts: Record<string, number>
  initialReacted?: string[]
}

export function ReactionButtons({ confessionId, initialCounts, initialReacted }: ReactionButtonsProps) {
  const [counts, setCounts] = useState<Record<string, number>>(initialCounts)
  const [mine, setMine] = useState<ReadonlySet<string>>(() => new Set(initialReacted ?? []))
  const [pending, setPending] = useState(false)
  const router = useRouter()

  async function toggle(emoji: (typeof EMOJIS)[number]) {
    if (pending) return
    const wasMine = mine.has(emoji)
    const prevCounts = counts
    const prevMine = mine
    setCounts((prev) => ({
      ...prev,
      [emoji]: Math.max(0, (prev[emoji] ?? 0) + (wasMine ? -1 : 1)),
    }))
    setMine((prev) => {
      const next = new Set(prev)
      if (wasMine) next.delete(emoji)
      else next.add(emoji)
      return next
    })
    setPending(true)
    try {
      const res = await fetch("/api/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confessionId, emoji }),
      })
      if (res.status === 401) {
        toast.error("Log in to react 🔑")
        router.push("/login")
        return
      }
      if (res.status === 429) {
        toast.error("Slow down 🐢")
        setCounts(prevCounts)
        setMine(prevMine)
        return
      }
      if (!res.ok) {
        setCounts(prevCounts)
        setMine(prevMine)
        return
      }
      const data = (await res.json()) as {
        reacted: boolean
        counts: Record<string, number>
      }
      setCounts(data.counts)
      setMine((prev) => {
        const next = new Set(prev)
        if (data.reacted) next.add(emoji)
        else next.delete(emoji)
        return next
      })
    } catch {
      setCounts(prevCounts)
      setMine(prevMine)
    } finally {
      setPending(false)
    }
  }

  return (
    <div role="group" aria-label="Reactions" className="flex flex-wrap gap-1.5">
      {EMOJIS.map((emoji) => {
        const active = mine.has(emoji)
        const count = counts[emoji] ?? 0
        return (
          <Button
            key={emoji}
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={active}
            disabled={pending}
            onClick={() => toggle(emoji)}
            className={cn(
              "gap-1 px-2.5 tabular-nums transition-colors",
              active && "border-primary/50 bg-primary/15"
            )}
          >
            <span aria-hidden>{emoji}</span>
            {count > 0 ? count : null}
          </Button>
        )
      })}
    </div>
  )
}
