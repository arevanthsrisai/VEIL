"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { RefreshCwIcon } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { relativeTime } from "@/components/site/format"

type ModConfession = {
  id: string
  title: string | null
  content: string
  createdAt: string
  nickname: string
  avatarEmoji: string
  status: string
}

type ModReport = {
  id: string
  reason: string
  createdAt: string
  confessionId?: string
  confessionStatus: string
  confessionExcerpt?: string
}

type QueueData = {
  confessions: ModConfession[]
  reports: ModReport[]
}

type ActionResult = { ok: true } | { redirect: true } | { error: string }

async function postAction(path: string, body: Record<string, unknown>): Promise<ActionResult> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (res.status === 401) return { redirect: true }
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      return { error: data?.error ?? "Something went wrong. Try again." }
    }
    return { ok: true }
  } catch {
    return { error: "Something went wrong. Try again." }
  }
}

function useModerate(onDone: (id: string) => void) {
  const [busy, setBusy] = useState(false)
  const router = useRouter()

  async function moderate(
    id: string,
    path: string,
    body: Record<string, unknown>,
    successMsg: string
  ) {
    setBusy(true)
    try {
      const result = await postAction(path, body)
      if ("redirect" in result) {
        router.push("/login")
        return
      }
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success(successMsg)
      onDone(id)
    } finally {
      setBusy(false)
    }
  }

  return { moderate, busy }
}

function QueueSkeleton() {
  return (
    <div className="grid gap-4" aria-hidden>
      {[0, 1, 2].map((i) => (
        <Card key={i}>
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <Skeleton className="size-6 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-4 w-3/4" />
          </CardHeader>
          <CardContent className="grid gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function EmptyQueue({ hint }: { hint: string }) {
  return (
    <Card className="items-center gap-2 py-10 text-center">
      <span className="text-4xl" aria-hidden>
        ✨
      </span>
      <p className="font-medium">Queue clear</p>
      <p className="text-sm text-muted-foreground">{hint}</p>
    </Card>
  )
}

function AuthorLine({
  nickname,
  avatarEmoji,
  createdAt,
  badge,
}: {
  nickname: string
  avatarEmoji: string
  createdAt: string
  badge?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Avatar size="sm" aria-hidden>
        <AvatarFallback className="text-sm">{avatarEmoji}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{nickname}</p>
        <p className="text-xs text-muted-foreground">{relativeTime(createdAt)}</p>
      </div>
      {badge && <div className="ml-auto">{badge}</div>}
    </div>
  )
}

function ActionButtons({
  busy,
  rejecting,
  onRejectStart,
  onCancel,
  onApprove,
  onReject,
}: {
  busy: boolean
  rejecting: boolean
  onRejectStart: () => void
  onCancel: () => void
  onApprove: () => void
  onReject: () => void
}) {
  if (!rejecting) {
    return (
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" disabled={busy} onClick={onRejectStart}>
          Reject
        </Button>
        <Button size="sm" disabled={busy} onClick={onApprove}>
          Approve
        </Button>
      </div>
    )
  }
  return (
    <div className="flex justify-end gap-2">
      <Button variant="ghost" size="sm" disabled={busy} onClick={onCancel}>
        Cancel
      </Button>
      <Button variant="destructive" size="sm" disabled={busy} onClick={onReject}>
        Confirm reject
      </Button>
    </div>
  )
}

function PendingConfessionCard({
  item,
  onDone,
}: {
  item: ModConfession
  onDone: (id: string) => void
}) {
  const { moderate, busy } = useModerate(onDone)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState("")

  const path = `/api/moderation/confessions/${item.id}`
  const cancel = () => {
    setRejecting(false)
    setReason("")
  }

  return (
    <Card>
      <CardHeader>
        <AuthorLine
          nickname={item.nickname}
          avatarEmoji={item.avatarEmoji}
          createdAt={item.createdAt}
          badge={<Badge variant="secondary">Pending ⏳</Badge>}
        />
        {item.title && <CardTitle className="text-[15px]">{item.title}</CardTitle>}
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
          {item.content}
        </p>
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-2">
        {rejecting && (
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for rejection (sent to the author)"
            aria-label="Rejection reason"
            rows={2}
            maxLength={500}
            autoFocus
          />
        )}
        <ActionButtons
          busy={busy}
          rejecting={rejecting}
          onRejectStart={() => setRejecting(true)}
          onCancel={cancel}
          onApprove={() => void moderate(item.id, path, { action: "APPROVED" }, "Confession approved ✅")}
          onReject={() =>
            void moderate(item.id, path, { action: "REJECTED", reason: reason.trim() }, "Confession rejected ❌")
          }
        />
      </CardFooter>
    </Card>
  )
}

function ReportCard({
  item,
  onDone,
}: {
  item: ModReport
  onDone: (id: string) => void
}) {
  const { moderate, busy } = useModerate(onDone)
  const path = `/api/moderation/reports/${item.id}`
  const targetLabel = "Confession"

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="text-lg">
            🚩
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{item.reason}</p>
            <p className="text-xs text-muted-foreground">{relativeTime(item.createdAt)}</p>
          </div>
          <Badge variant="outline" className="ml-auto">
            {targetLabel}
          </Badge>
        </div>
      </CardHeader>
      {item.confessionExcerpt && (
        <CardContent className="grid gap-2">
          <p className="rounded-lg border border-border/60 bg-muted/40 p-3 text-sm text-foreground/80">
            {item.confessionExcerpt}
          </p>
        </CardContent>
      )}
      <CardFooter className="flex-wrap justify-end gap-2">
        {item.confessionId && (
          <Link
            href={`/post/${item.confessionId}`}
            className="mr-auto text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            View confession →
          </Link>
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void moderate(item.id, path, { action: "DISMISSED" }, "Report dismissed")}
        >
          Dismiss
        </Button>
        <Button
          size="sm"
          disabled={busy}
          onClick={() => void moderate(item.id, path, { action: "RESOLVED" }, "Report resolved")}
        >
          Resolve
        </Button>
      </CardFooter>
    </Card>
  )
}

export function ModerationQueue() {
  const [data, setData] = useState<QueueData | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "forbidden" | "error">("loading")
  const [refreshing, setRefreshing] = useState(false)
  const router = useRouter()

  const load = useCallback(
    async (initial: boolean) => {
      if (initial) setStatus("loading")
      else setRefreshing(true)
      try {
        const res = await fetch("/api/moderation")
        if (res.status === 401) {
          router.push("/login")
          return
        }
        if (res.status === 403) {
          setStatus("forbidden")
          return
        }
        if (!res.ok) throw new Error("Request failed")
        const json = (await res.json()) as Partial<QueueData>
        setData({
          confessions: json.confessions ?? [],
          reports: json.reports ?? [],
        })
        setStatus("ready")
      } catch {
        if (initial) setStatus("error")
        else toast.error("Couldn't refresh the queue.")
      } finally {
        setRefreshing(false)
      }
    },
    [router]
  )

  useEffect(() => {
    load(true)
  }, [load])

  const removeConfession = useCallback(
    (id: string) =>
      setData((prev) =>
        prev ? { ...prev, confessions: prev.confessions.filter((c) => c.id !== id) } : prev
      ),
    []
  )
  const removeReport = useCallback(
    (id: string) =>
      setData((prev) =>
        prev ? { ...prev, reports: prev.reports.filter((r) => r.id !== id) } : prev
      ),
    []
  )

  if (status === "forbidden") {
    return (
      <Card className="items-center gap-2 py-12 text-center">
        <span className="text-4xl" aria-hidden>
          🔒
        </span>
        <p className="font-medium">You don't have permission</p>
        <p className="text-sm text-muted-foreground">
          Moderation tools are for moderators and admins only.
        </p>
      </Card>
    )
  }

  const pending = data?.confessions ?? []
  const reports = data?.reports ?? []

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Moderation 🛡️</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review pending confessions and reports.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={refreshing}
          onClick={() => load(false)}
        >
          <RefreshCwIcon
            data-icon="inline-start"
            className={refreshing ? "animate-spin" : undefined}
          />
          Refresh
        </Button>
      </div>

      {status === "loading" && <QueueSkeleton />}

      {status === "error" && (
        <Card className="items-center gap-2 py-10 text-center">
          <span className="text-4xl" aria-hidden>
            📡
          </span>
          <p className="font-medium">Couldn't load the queue</p>
          <p className="text-sm text-muted-foreground">Something went wrong. Try again?</p>
          <Button variant="outline" size="sm" onClick={() => load(true)}>
            Retry
          </Button>
        </Card>
      )}

      {status === "ready" && (
        <Tabs defaultValue="confessions">
          <TabsList>
            <TabsTrigger value="confessions">
              Confessions{pending.length > 0 ? ` (${pending.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="reports">
              Reports{reports.length > 0 ? ` (${reports.length})` : ""}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="confessions" className="mt-3 grid gap-4">
            {pending.length === 0 ? (
              <EmptyQueue hint="No confessions waiting for review." />
            ) : (
              pending.map((item) => (
                <PendingConfessionCard key={item.id} item={item} onDone={removeConfession} />
              ))
            )}
          </TabsContent>

          <TabsContent value="reports" className="mt-3 grid gap-4">
            {reports.length === 0 ? (
              <EmptyQueue hint="No open reports." />
            ) : (
              reports.map((item) => (
                <ReportCard key={item.id} item={item} onDone={removeReport} />
              ))
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
