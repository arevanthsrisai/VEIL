"use client"

import { useRef, useState } from "react"
import { CheckIcon, LinkIcon, ShareIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export function ShareButton({
  postId,
  title,
  className,
}: {
  postId: string
  title?: string | null
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function url() {
    return `${window.location.origin}/post/${postId}`
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url())
      return true
    } catch {
      // ponytail: execCommand fallback for non-secure contexts (http), remove when https-only
      try {
        const ta = document.createElement("textarea")
        ta.value = url()
        ta.style.position = "fixed"
        ta.style.opacity = "0"
        document.body.appendChild(ta)
        ta.select()
        const ok = document.execCommand("copy")
        document.body.removeChild(ta)
        return ok
      } catch {
        return false
      }
    }
  }

  async function onShare() {
    const shareUrl = url()
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: title ?? "VEIL", url: shareUrl })
        return
      } catch {
        // user dismissed the share sheet — fall through to copy
      }
    }
    const ok = await copy()
    if (ok) {
      setCopied(true)
      if (resetTimer.current) clearTimeout(resetTimer.current)
      resetTimer.current = setTimeout(() => setCopied(false), 2000)
    } else {
      toast.error("Couldn't copy the link")
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onShare}
      aria-label={copied ? "Link copied" : "Share this post"}
      className={className}
    >
      {copied ? (
        <CheckIcon data-icon="inline-start" className="text-muted-foreground" />
      ) : (
        <ShareIcon data-icon="inline-start" />
      )}
      {copied ? "Copied" : "Share"}
    </Button>
  )
}
