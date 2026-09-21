"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { relativeTime } from "@/components/site/format"
import {
  ConfessionCard,
  ConfessionSkeleton,
  StateMessage,
  type ConfessionItem,
} from "@/components/site/confession-list"

type ActivityConfession = ConfessionItem & {
  status: string
  rejectionReason?: string
}

const STATUS_META: Record<
  string,
  { label: string; variant: "secondary" | "default" | "destructive" }
> = {
  PENDING: { label: "Pending ⏳", variant: "secondary" },
  APPROVED: { label: "Approved", variant: "default" },
  REJECTED: { label: "Rejected", variant: "destructive" },
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? {
    label: status,
    variant: "secondary" as const,
  }
  return <Badge variant={meta.variant}>{meta.label}</Badge>
}

export default function ActivityPage() {
  const [confessions, setConfessions] = useState<ActivityConfession[]>([])
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const router = useRouter()

  const load = useCallback(async () => {
    setStatus("loading")
    try {
      const res = await fetch("/api/me/activity")
      if (res.status === 401) {
        router.push("/login")
        return
      }
      if (!res.ok) throw new Error("Request failed")
      const data = (await res.json()) as {
        confessions: ActivityConfession[]
      }
      setConfessions(data.confessions)
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
        <h1 className="text-2xl font-semibold tracking-tight">
          Your activity 🕵️
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything you've posted, moderation status included.
        </p>
      </div>

      {status === "loading" && (
        <div className="grid gap-4">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <ConfessionSkeleton count={2} />
        </div>
      )}

      {status === "error" && (
        <StateMessage
          emoji="📡"
          title="Couldn't load your activity"
          description="Your trail went cold. Try again?"
          action={
            <Button variant="outline" size="sm" onClick={load}>
              Retry
            </Button>
          }
        />
      )}

      {status === "ready" && (
        <Tabs defaultValue="confessions">
          <TabsList className="w-full">
            <TabsTrigger value="confessions">
              My confessions ({confessions.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="confessions" className="mt-4">
            {confessions.length === 0 ? (
              <StateMessage
                emoji="🤫"
                title="No confessions yet"
                description="You're a mystery even to the feed. Spill something."
              />
            ) : (
              <div className="grid gap-4">
                {confessions.map((item) => (
                  <ConfessionCard
                    key={item.id}
                    item={item}
                    trailing={<StatusBadge status={item.status} />}
                    note={
                      item.status === "REJECTED" && item.rejectionReason ? (
                        <p className="text-xs leading-relaxed text-destructive">
                          Rejected: {item.rejectionReason}
                        </p>
                      ) : undefined
                    }
                  />
                ))}
              </div>
            )}
          </TabsContent>

        </Tabs>
      )}
    </div>
  )
}
