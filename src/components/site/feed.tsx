"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { relativeTime } from "@/components/site/format"
import { NewConfessionButton } from "@/components/site/new-confession-dialog"
import { ReactionButtons } from "@/components/site/reaction-buttons"

type ReactionCounts = Record<string, number>

type ConfessionItem = {
  id: string
  title: string | null
  content: string
  createdAt: string
  nickname: string
  avatarEmoji: string
  reactionCounts: ReactionCounts
  myReactions?: string[]
}

function ConfessionCard({ item }: { item: ConfessionItem }) {
  return (
    <Card className="transition-shadow hover:ring-foreground/20">
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <Avatar size="sm" aria-hidden>
            <AvatarFallback className="text-sm">
              {item.avatarEmoji}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{item.nickname}</p>
            <p className="text-xs text-muted-foreground">
              {relativeTime(item.createdAt)}
            </p>
          </div>
        </div>
        {item.title && (
          <CardTitle className="text-[15px]">
            <Link
              href={`/post/${item.id}`}
              className="underline-offset-4 hover:underline"
            >
              {item.title}
            </Link>
          </CardTitle>
        )}
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
          {item.content}
        </p>
      </CardContent>
      <CardFooter>
        <ReactionButtons
          confessionId={item.id}
          initialCounts={item.reactionCounts}
          initialReacted={item.myReactions}
        />
      </CardFooter>
    </Card>
  )
}

function FeedSkeleton() {
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

export function Feed() {
  const [items, setItems] = useState<ConfessionItem[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [loadingMore, setLoadingMore] = useState(false)
  const router = useRouter()

  const load = useCallback(
    async (nextCursor: string | null, initial: boolean) => {
      if (initial) setStatus("loading")
      else setLoadingMore(true)
      try {
        const qs = nextCursor
          ? `?cursor=${encodeURIComponent(nextCursor)}`
          : ""
        const res = await fetch(`/api/confessions${qs}`)
        if (res.status === 401) {
          router.push("/login")
          return
        }
        if (!res.ok) throw new Error("Request failed")
        const data = (await res.json()) as {
          confessions: ConfessionItem[]
          nextCursor: string | null
        }
        setItems((prev) => (initial ? data.confessions : [...prev, ...data.confessions]))
        setCursor(data.nextCursor)
        setStatus("ready")
      } catch {
        if (initial) setStatus("error")
        else toast.error("Couldn't load more confessions.")
      } finally {
        setLoadingMore(false)
      }
    },
    [router]
  )

  useEffect(() => {
    load(null, true)
  }, [load])

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Confessions 🎙️
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Anonymous. Honest. Occasionally unhinged.
          </p>
        </div>
        <NewConfessionButton />
      </div>

      {status === "loading" && <FeedSkeleton />}

      {status === "error" && (
        <Card className="items-center gap-2 py-10 text-center">
          <span className="text-4xl" aria-hidden>
            📡
          </span>
          <p className="font-medium">Couldn't load confessions</p>
          <p className="text-sm text-muted-foreground">
            The confession wire went quiet. Try again?
          </p>
          <Button variant="outline" size="sm" onClick={() => load(null, true)}>
            Retry
          </Button>
        </Card>
      )}

      {status === "ready" && items.length === 0 && (
        <Card className="items-center gap-2 py-12 text-center">
          <span className="text-4xl" aria-hidden>
            🫣
          </span>
          <p className="font-medium">No confessions yet</p>
          <p className="text-sm text-muted-foreground">
            Be the first to spill. It's anonymous — we won't tell. 🤫
          </p>
          <NewConfessionButton />
        </Card>
      )}

      {status === "ready" &&
        items.map((item) => <ConfessionCard key={item.id} item={item} />)}

      {status === "ready" && cursor && items.length > 0 && (
        <Button
          variant="outline"
          size="lg"
          disabled={loadingMore}
          onClick={() => load(cursor, false)}
          className="w-full"
        >
          {loadingMore ? "Loading…" : "Load more"}
        </Button>
      )}
    </div>
  )
}
