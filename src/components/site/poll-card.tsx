"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { relativeTime } from "@/components/site/format"
import type { PollWithResults } from "@/lib/polls"

function endsIn(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (Number.isNaN(diff) || diff <= 0) return ""
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "ends any moment"
  if (mins < 60) return `ends in ${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `ends in ${hours}h`
  return `ends in ${Math.floor(hours / 24)}d`
}

export function PollCard({ poll }: { poll: PollWithResults }) {
  const [counts, setCounts] = useState<Record<string, number>>(poll.counts)
  const [myVote, setMyVote] = useState<string | null>(poll.myVote)
  const [pending, setPending] = useState(false)
  const router = useRouter()

  const closed = poll.status === "CLOSED"
  const showResults = closed || myVote !== null
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0)
  const votesLabel = showResults ? `${total} ${total === 1 ? "vote" : "votes"}` : null
  const endsLabel = closed || !poll.endsAt ? null : endsIn(poll.endsAt)

  async function vote(optionId: string) {
    if (pending || closed || myVote !== null) return
    const prevCounts = counts
    const prevVote = myVote
    setCounts((prev) => ({ ...prev, [optionId]: (prev[optionId] ?? 0) + 1 }))
    setMyVote(optionId)
    setPending(true)
    try {
      const res = await fetch(`/api/polls/${poll.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId }),
      })
      if (res.status === 401) {
        toast.error("Log in to vote 🔑")
        router.push("/login")
        setCounts(prevCounts)
        setMyVote(prevVote)
        return
      }
      if (res.status === 429) {
        toast.error("Slow down 🐢")
        setCounts(prevCounts)
        setMyVote(prevVote)
        return
      }
      if (!res.ok) {
        setCounts(prevCounts)
        setMyVote(prevVote)
        return
      }
      const data = (await res.json()) as {
        voted: boolean
        counts: Record<string, number>
        myVote: string | null
      }
      setCounts(data.counts)
      setMyVote(data.myVote)
    } catch {
      setCounts(prevCounts)
      setMyVote(prevVote)
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <Avatar size="sm" aria-hidden>
            <AvatarFallback className="text-sm">🎭</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">VEIL</p>
            <p className="text-xs text-muted-foreground">{relativeTime(poll.createdAt)}</p>
          </div>
          {closed && (
            <div className="ml-auto">
              <Badge variant="secondary">Closed</Badge>
            </div>
          )}
        </div>
        <CardTitle className="text-[15px]">{poll.question}</CardTitle>
      </CardHeader>
      <CardContent>
        <div role="group" aria-label={`Poll options: ${poll.question}`} className="grid gap-2">
          {poll.options.map((option) => {
            const mine = myVote === option.id
            const count = counts[option.id] ?? 0
            const pct = total > 0 ? Math.round((count / total) * 100) : 0
            return (
              <Button
                key={option.id}
                type="button"
                variant="outline"
                aria-pressed={mine}
                aria-label={
                  showResults
                    ? `${option.text} — ${count} of ${total} votes (${pct}%)${mine ? ", your vote" : ""}`
                    : `Vote ${option.text}`
                }
                disabled={pending || closed || myVote !== null}
                onClick={() => vote(option.id)}
                className={cn(
                  "relative h-auto w-full justify-start overflow-hidden px-3 py-2.5",
                  mine && "border-primary/60"
                )}
              >
                {showResults && (
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 bg-primary/15"
                    style={{ width: `${pct}%` }}
                  />
                )}
                <span className="relative flex w-full items-center justify-between gap-2">
                  <span className="truncate">
                    {option.text}
                    {mine && <span aria-hidden className="text-primary"> ✓</span>}
                  </span>
                  {showResults && (
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {pct}%
                    </span>
                  )}
                </span>
              </Button>
            )
          })}
        </div>
      </CardContent>
      {(votesLabel || endsLabel) && (
        <CardFooter className="justify-between">
          {votesLabel && <p className="text-xs text-muted-foreground">{votesLabel}</p>}
          {endsLabel && <p className="text-xs text-muted-foreground">⏳ {endsLabel}</p>}
        </CardFooter>
      )}
    </Card>
  )
}
