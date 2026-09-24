"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { relativeTime } from "@/components/site/format"
import { ReactionButtons } from "@/components/site/reaction-buttons"
import { ReportDialog } from "@/components/site/report-dialog"
import { ShareButton } from "@/components/site/share-button"

type ConfessionDetail = {
  id: string
  title: string | null
  content: string
  createdAt: string
  nickname: string
  avatarEmoji: string
  status: "PENDING" | "APPROVED" | "REJECTED"
  reactionCounts?: Record<string, number>
  myReactions?: string[]
  rejectionReason?: string | null
  isOwn: boolean
  type?: string | null
  anonymous?: boolean
}

export function ConfessionDetailView({ id }: { id: string }) {
  const [item, setItem] = useState<ConfessionDetail | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "notFound" | "error">(
    "loading"
  )

  useEffect(() => {
    let cancelled = false
    setStatus("loading")
    fetch(`/api/confessions/${encodeURIComponent(id)}`)
      .then(async (res) => {
        if (cancelled) return
        if (res.status === 404) {
          setStatus("notFound")
          return
        }
        if (!res.ok) throw new Error("Request failed")
        setItem((await res.json()) as ConfessionDetail)
        setStatus("ready")
      })
      .catch(() => {
        if (!cancelled) setStatus("error")
      })
    return () => {
      cancelled = true
    }
  }, [id])

  return (
    <div className="grid gap-4">
      <Button
        variant="ghost"
        size="sm"
        render={<Link href="/" />}
        nativeButton={false}
        className="-ml-2 w-fit"
      >
        <ArrowLeftIcon data-icon="inline-start" />
        Back to feed
      </Button>

      {status === "loading" && (
        <Card aria-hidden>
          <CardHeader className="grid gap-2">
            <div className="flex items-center gap-2.5">
              <Skeleton className="size-6 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-5 w-3/4" />
          </CardHeader>
          <CardContent className="grid gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      )}

      {status === "notFound" && (
        <Card className="items-center gap-2 py-12 text-center">
          <span className="text-4xl" aria-hidden>
            🕳️
          </span>
          <p className="font-medium">This post doesn't exist</p>
          <p className="text-sm text-muted-foreground">
            It may have been removed, or it was never approved.
          </p>
        </Card>
      )}

      {status === "error" && (
        <Card className="items-center gap-2 py-12 text-center">
          <span className="text-4xl" aria-hidden>
            📡
          </span>
          <p className="font-medium">Couldn't load this post</p>
          <p className="text-sm text-muted-foreground">
            Something went wrong on the way here. Head back and retry.
          </p>
        </Card>
      )}

      {status === "ready" && item && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <Avatar size="sm" aria-hidden>
                  <AvatarFallback className="text-sm">
                    {item.anonymous ? "🎭" : item.avatarEmoji}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {item.anonymous ? "🕵️ Anonymous" : item.nickname}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {relativeTime(item.createdAt)}
                  </p>
                </div>
                <div className="ml-auto">
                  <ReportDialog confessionId={item.id} />
                </div>
              </div>
              {item.title && <CardTitle className="text-lg">{item.title}</CardTitle>}
              {(item.type || item.isOwn || item.status !== "APPROVED") && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {item.type && (
                    <Badge variant="secondary">
                      {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                    </Badge>
                  )}
                  {item.isOwn && <Badge variant="outline">Your post</Badge>}
                  {item.status === "PENDING" && (
                    <Badge variant="secondary">Pending review ⏳</Badge>
                  )}
                  {item.status === "REJECTED" && (
                    <Badge variant="destructive">Rejected</Badge>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {item.content}
              </p>
              {item.status === "REJECTED" && item.rejectionReason && (
                <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  Reason: {item.rejectionReason}
                </p>
              )}
            </CardContent>
            {item.status === "APPROVED" && (
              <CardFooter className="flex-wrap gap-2">
                <ReactionButtons
                  confessionId={item.id}
                  initialCounts={item.reactionCounts ?? {}}
                  initialReacted={item.myReactions}
                />
                <ShareButton postId={item.id} title={item.title} className="ml-auto" />
              </CardFooter>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
