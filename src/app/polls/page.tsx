"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ConfessionSkeleton,
  ErrorMessage,
  StateMessage,
} from "@/components/site/confession-list"
import { PollCard } from "@/components/site/poll-card"
import type { PollWithResults } from "@/lib/polls"

type PollsData = {
  polls: PollWithResults[]
  closedPolls?: PollWithResults[]
}

export default function PollsPage() {
  const [active, setActive] = useState<PollWithResults[]>([])
  const [closed, setClosed] = useState<PollWithResults[]>([])
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [reloadKey, setReloadKey] = useState(0)
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    fetch("/api/polls")
      .then(async (res) => {
        if (cancelled) return
        if (res.status === 401) {
          router.push("/login")
          return
        }
        if (!res.ok) throw new Error("Request failed")
        const data = (await res.json()) as PollsData
        setActive(data.polls ?? [])
        setClosed(data.closedPolls ?? [])
        setStatus("ready")
      })
      .catch(() => {
        if (!cancelled) setStatus("error")
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey, router])

  function retry() {
    setStatus("loading")
    setReloadKey((key) => key + 1)
  }

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Polls 📊</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Campus questions from VEIL. One vote each, results once you vote.
        </p>
      </div>

      {status === "loading" && <ConfessionSkeleton />}

      {status === "error" && (
        <ErrorMessage description="The polls took a personal day. Try again?" onRetry={retry} />
      )}

      {status === "ready" && active.length === 0 && closed.length === 0 && (
        <StateMessage
          emoji="🗳️"
          title="No polls yet"
          description="Check back soon — new polls drop here."
        />
      )}

      {status === "ready" && active.length > 0 && (
        <section aria-label="Active polls" className="grid gap-4">
          {active.map((poll) => (
            <PollCard key={poll.id} poll={poll} />
          ))}
        </section>
      )}

      {status === "ready" && closed.length > 0 && (
        <section aria-label="Closed polls" className="grid gap-4">
          <h2 className="text-lg font-semibold tracking-tight">Closed</h2>
          {closed.map((poll) => (
            <PollCard key={poll.id} poll={poll} />
          ))}
        </section>
      )}
    </div>
  )
}
