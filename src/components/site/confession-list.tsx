"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { relativeTime } from "@/components/site/format"
import { ReactionButtons } from "@/components/site/reaction-buttons"

export type ConfessionItem = {
  id: string
  title: string | null
  content: string
  createdAt: string
  nickname: string
  avatarEmoji: string
  reactionCounts: Record<string, number>
  myReactions?: string[]
  type?: string | null
  anonymous?: boolean
}

export function ConfessionCard({
  item,
  leading,
  trailing,
  note,
}: {
  item: ConfessionItem
  leading?: ReactNode
  trailing?: ReactNode
  note?: ReactNode
}) {
  const anonymous = item.anonymous === true
  return (
    <Card className="transition-shadow hover:ring-foreground/20">
      <CardHeader>
        <div className="flex items-center gap-2.5">
          {leading}
          <Avatar size="sm" aria-hidden>
            <AvatarFallback className="text-sm">
              {anonymous ? "🎭" : item.avatarEmoji}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {anonymous ? "🕵️ Anonymous" : item.nickname}
            </p>
            <p className="text-xs text-muted-foreground">
              {relativeTime(item.createdAt)}
            </p>
          </div>
          {(item.type || trailing) && (
            <div className="ml-auto flex items-center gap-2">
              {item.type && (
                <Badge variant="secondary">
                  {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                </Badge>
              )}
              {trailing}
            </div>
          )}
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
      <CardContent className="grid gap-2">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
          {item.content}
        </p>
        {note}
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

export function ConfessionSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
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

export function StateMessage({
  emoji,
  title,
  description,
  action,
}: {
  emoji: string
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <Card className="items-center gap-2 py-12 text-center">
      <span className="text-4xl" aria-hidden>
        {emoji}
      </span>
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
      {action}
    </Card>
  )
}

export function ErrorMessage({
  description,
  onRetry,
}: {
  description: string
  onRetry: () => void
}) {
  return (
    <Card className="items-center gap-2 py-10 text-center">
      <span className="text-4xl" aria-hidden>
        📡
      </span>
      <p className="font-medium">Something went wrong</p>
      <p className="text-sm text-muted-foreground">{description}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </Card>
  )
}
