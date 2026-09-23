"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { BookmarkIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type BookmarkButtonProps = {
  confessionId: string
  initialSaved?: boolean
}

export function BookmarkButton({ confessionId, initialSaved = false }: BookmarkButtonProps) {
  const [saved, setSaved] = useState(initialSaved)
  const [pending, setPending] = useState(false)
  const router = useRouter()

  async function toggle() {
    if (pending) return
    const prev = saved
    setSaved(!prev)
    setPending(true)
    try {
      const res = await fetch(
        prev ? `/api/bookmarks/${confessionId}` : "/api/bookmarks",
        prev
          ? { method: "DELETE" }
          : {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ confessionId }),
            },
      )
      if (res.status === 401) {
        toast.error("Log in to save 🔖")
        router.push("/login")
        return
      }
      if (res.status === 429) {
        toast.error("Slow down 🐢")
        setSaved(prev)
        return
      }
      if (!res.ok) {
        setSaved(prev)
        return
      }
      const data = (await res.json()) as { bookmarked: boolean }
      setSaved(data.bookmarked)
    } catch {
      setSaved(prev)
    } finally {
      setPending(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      aria-pressed={saved}
      aria-label={saved ? "Remove saved post" : "Save post"}
      disabled={pending}
      onClick={() => toggle()}
      className={cn("transition-colors", saved && "border-primary/50 bg-primary/15")}
    >
      <BookmarkIcon aria-hidden className={cn(saved && "fill-current")} />
    </Button>
  )
}
