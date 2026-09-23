"use client"

import { useEffect, useState } from "react"
import { XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

const DISMISS_KEY = "veil:announcement-dismissed"

export function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch("/api/announcements")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { announcement?: unknown } | null) => {
        if (cancelled || !data) return
        const text =
          typeof data.announcement === "string" && data.announcement.length > 0
            ? data.announcement
            : null
        setAnnouncement(text)
        if (text === null) return
        try {
          setDismissed(sessionStorage.getItem(DISMISS_KEY) === text)
        } catch {
          setDismissed(false)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  function dismiss() {
    if (announcement === null) return
    try {
      sessionStorage.setItem(DISMISS_KEY, announcement)
    } catch {
      // storage unavailable (private mode) — dismiss for this view only
    }
    setDismissed(true)
  }

  if (announcement === null || dismissed) return null

  return (
    <div
      role="status"
      className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0">{announcement}</p>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Dismiss announcement"
          onClick={dismiss}
        >
          <XIcon />
        </Button>
      </div>
    </div>
  )
}
