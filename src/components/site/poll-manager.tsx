"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { PlusIcon, XIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { relativeTime } from "@/components/site/format"
import type { PollWithResults } from "@/lib/polls"

type OptionSlot = { id: string; text: string }

type PollsData = {
  polls: PollWithResults[]
  closedPolls?: PollWithResults[]
}

function newOptionSlot(): OptionSlot {
  return { id: crypto.randomUUID(), text: "" }
}

function PollRow({
  poll,
  busy,
  onClose,
}: {
  poll: PollWithResults
  busy: boolean
  onClose: (id: string) => void
}) {
  const active = poll.status === "ACTIVE"
  return (
    <Card className="items-center gap-3 py-3" size="sm">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{poll.question}</p>
        <p className="truncate text-xs text-muted-foreground">
          {poll.options.map((option) => option.text).join(" · ")}
        </p>
        <p className="text-xs text-muted-foreground">Created {relativeTime(poll.createdAt)}</p>
      </div>
      <Badge variant={active ? "default" : "secondary"}>{poll.status}</Badge>
      <Button
        variant="outline"
        size="sm"
        disabled={busy || !active}
        aria-label={`Close poll: ${poll.question}`}
        onClick={() => onClose(poll.id)}
      >
        Close
      </Button>
    </Card>
  )
}

export function PollManager() {
  const [question, setQuestion] = useState("")
  const [options, setOptions] = useState<OptionSlot[]>(() => [newOptionSlot(), newOptionSlot()])
  const [endsAt, setEndsAt] = useState("")
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [polls, setPolls] = useState<PollWithResults[]>([])
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [reloadKey, setReloadKey] = useState(0)
  const [busyId, setBusyId] = useState<string | null>(null)
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
        setPolls([...(data.polls ?? []), ...(data.closedPolls ?? [])])
        setStatus("ready")
      })
      .catch(() => {
        if (!cancelled) setStatus("error")
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey, router])

  function refresh() {
    setStatus("loading")
    setReloadKey((key) => key + 1)
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = options.map((option) => option.text.trim()).filter((text) => text.length > 0)
    if (question.trim().length === 0 || trimmed.length < 2) {
      setFormError("A poll needs a question and at least 2 options.")
      return
    }
    setCreating(true)
    setFormError(null)
    try {
      const res = await fetch("/api/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          options: trimmed,
          ...(endsAt ? { endsAt: new Date(endsAt).toISOString() } : {}),
        }),
      })
      if (res.status === 401) {
        router.push("/login")
        return
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        setFormError(data?.error ?? "Could not create the poll.")
        return
      }
      setQuestion("")
      setOptions([newOptionSlot(), newOptionSlot()])
      setEndsAt("")
      toast.success("Poll created 📊")
      refresh()
    } catch {
      setFormError("Could not create the poll.")
    } finally {
      setCreating(false)
    }
  }

  async function onClose(id: string) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/polls/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CLOSE" }),
      })
      if (res.status === 401) {
        router.push("/login")
        return
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        toast.error(data?.error ?? "Could not close the poll.")
        return
      }
      toast.success("Poll closed")
      setPolls((prev) =>
        prev.map((poll): PollWithResults =>
          poll.id === id ? { ...poll, status: "CLOSED" } : poll
        )
      )
    } catch {
      toast.error("Could not close the poll.")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Polls 📊</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Create polls and close them once the votes are in.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-[15px]">Create a poll</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCreate} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="poll-question">Question</Label>
              <Input
                id="poll-question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                maxLength={500}
                placeholder="What should the campus decide?"
              />
            </div>
            <div className="grid gap-2">
              <Label>Options</Label>
              <div className="grid gap-2">
                {options.map((option, i) => (
                  <div key={option.id} className="flex items-center gap-2">
                    <Input
                      value={option.text}
                      onChange={(e) =>
                        setOptions((prev) =>
                          prev.map((o) => (o.id === option.id ? { ...o, text: e.target.value } : o))
                        )
                      }
                      maxLength={100}
                      placeholder={`Option ${i + 1}`}
                      aria-label={`Option ${i + 1}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove option ${i + 1}`}
                      disabled={options.length <= 2}
                      onClick={() => setOptions((prev) => prev.filter((o) => o.id !== option.id))}
                    >
                      <XIcon />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="justify-start"
                disabled={options.length >= 6}
                onClick={() => setOptions((prev) => [...prev, newOptionSlot()])}
              >
                <PlusIcon data-icon="inline-start" />
                Add option
              </Button>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="poll-ends-at">Ends at (optional)</Label>
              <Input
                id="poll-ends-at"
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </div>
            {formError && (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            )}
            <Button type="submit" disabled={creating || question.trim().length === 0}>
              {creating ? "Creating…" : "Create poll"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {status === "loading" && (
        <div className="grid gap-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <Card key={i} className="items-center gap-3 py-3" size="sm">
              <div className="flex w-full items-center gap-2.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="ml-auto h-5 w-16 rounded-4xl" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {status === "error" && (
        <Card className="items-center gap-2 py-10 text-center">
          <span className="text-4xl" aria-hidden>
            📡
          </span>
          <p className="font-medium">Polls failed to load</p>
          <Button variant="outline" size="sm" onClick={refresh}>
            Retry
          </Button>
        </Card>
      )}

      {status === "ready" && polls.length === 0 && (
        <Card className="items-center gap-2 py-10 text-center">
          <span className="text-4xl" aria-hidden>
            🗳️
          </span>
          <p className="font-medium">No polls yet</p>
          <p className="text-sm text-muted-foreground">Create the first one above.</p>
        </Card>
      )}

      {status === "ready" && polls.length > 0 && (
        <div className="grid gap-2">
          {polls.map((poll) => (
            <PollRow
              key={poll.id}
              poll={poll}
              busy={busyId === poll.id}
              onClose={(id) => void onClose(id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
