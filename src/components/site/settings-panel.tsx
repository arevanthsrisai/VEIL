"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"

const ANNOUNCEMENT_MAX_LENGTH = 500

type Settings = {
  maintenance_mode: boolean
  registration_enabled: boolean
  announcement: string | null
}

function ToggleRow({
  label,
  description,
  value,
  busy,
  onSave,
}: {
  label: string
  description: string
  value: boolean
  busy: boolean
  onSave: (value: boolean) => void
}) {
  return (
    <Card className="items-center justify-between gap-4 py-3 sm:flex-row" size="sm">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Button
        variant={value ? "default" : "outline"}
        size="sm"
        disabled={busy}
        aria-pressed={value}
        aria-label={label}
        onClick={() => onSave(!value)}
      >
        {value ? "On" : "Off"}
      </Button>
    </Card>
  )
}

export function SettingsPanel() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "forbidden" | "error">("loading")
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState("")
  const router = useRouter()

  const load = useCallback(async () => {
    setStatus("loading")
    try {
      const res = await fetch("/api/admin/settings")
      if (res.status === 401) {
        router.push("/login")
        return
      }
      if (res.status === 403) {
        setStatus("forbidden")
        return
      }
      if (!res.ok) throw new Error("Request failed")
      const data = (await res.json()) as { settings: Settings }
      setSettings(data.settings)
      setAnnouncement(data.settings.announcement ?? "")
      setStatus("ready")
    } catch {
      setStatus("error")
    }
  }, [router])

  useEffect(() => {
    void load()
  }, [load])

  async function putSetting(key: string, value: string | boolean) {
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    })
    if (res.status === 401) {
      router.push("/login")
      return false
    }
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      toast.error(data?.error ?? "Couldn't save setting.")
      return false
    }
    return true
  }

  async function saveToggle(key: "maintenance_mode" | "registration_enabled", value: boolean) {
    setBusyKey(key)
    try {
      const ok = await putSetting(key, value)
      if (!ok) return
      setSettings((prev) => (prev ? { ...prev, [key]: value } : prev))
      toast.success("Setting saved")
    } catch {
      toast.error("Couldn't save setting.")
    } finally {
      setBusyKey(null)
    }
  }

  async function saveAnnouncement() {
    setBusyKey("announcement")
    try {
      const value = announcement.trim()
      const ok = await putSetting("announcement", value)
      if (!ok) return
      setSettings((prev) =>
        prev ? { ...prev, announcement: value.length > 0 ? value : null } : prev,
      )
      toast.success("Announcement saved")
    } catch {
      toast.error("Couldn't save announcement.")
    } finally {
      setBusyKey(null)
    }
  }

  if (status === "forbidden") {
    return (
      <Card className="items-center gap-2 py-12 text-center">
        <span className="text-4xl" aria-hidden>
          🔒
        </span>
        <p className="font-medium">You don't have permission</p>
        <p className="text-sm text-muted-foreground">Site settings are for admins only.</p>
      </Card>
    )
  }

  if (status === "error") {
    return (
      <Card className="items-center gap-2 py-10 text-center">
        <span className="text-4xl" aria-hidden>
          📡
        </span>
        <p className="font-medium">Couldn't load settings</p>
        <p className="text-sm text-muted-foreground">Something went wrong. Try again?</p>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          Retry
        </Button>
      </Card>
    )
  }

  if (status === "loading" || !settings) {
    return (
      <div className="grid gap-2" aria-hidden>
        {[0, 1].map((i) => (
          <Card key={i} className="items-center gap-3 py-3" size="sm">
            <div className="flex w-full items-center justify-between gap-4">
              <div className="grid gap-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-7 w-14 rounded-lg" />
            </div>
          </Card>
        ))}
        <Card className="gap-2 py-3" size="sm">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-full" />
        </Card>
      </div>
    )
  }

  const announcementUnchanged = announcement.trim() === (settings.announcement ?? "")

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Site settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Maintenance, registration, and the site-wide announcement.
        </p>
      </div>

      <div className="grid gap-2">
        <ToggleRow
          label="Maintenance mode"
          description="Show a maintenance page to visitors."
          value={settings.maintenance_mode}
          busy={busyKey === "maintenance_mode"}
          onSave={(value) => void saveToggle("maintenance_mode", value)}
        />
        <ToggleRow
          label="Registration"
          description="Allow new account sign-ups."
          value={settings.registration_enabled}
          busy={busyKey === "registration_enabled"}
          onSave={(value) => void saveToggle("registration_enabled", value)}
        />
      </div>

      <Card className="gap-2 py-3" size="sm">
        <CardContent className="grid gap-2">
          <Label htmlFor="setting-announcement">Announcement</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="setting-announcement"
              value={announcement}
              maxLength={ANNOUNCEMENT_MAX_LENGTH}
              onChange={(event) => setAnnouncement(event.target.value)}
              placeholder="Leave empty for no announcement"
            />
            <Button
              size="sm"
              disabled={busyKey === "announcement" || announcementUnchanged}
              onClick={() => void saveAnnouncement()}
            >
              Save
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {announcement.trim().length}/{ANNOUNCEMENT_MAX_LENGTH} characters · shown to everyone
            at the top of the feed.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
