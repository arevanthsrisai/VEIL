"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { KeyRound, LogOut, X } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { StateMessage } from "@/components/site/confession-list"
import type { PublicUser, SessionSummary } from "@/lib/auth"

const EMOJIS = [
  "🎭", "👻", "🦊", "🐙", "🦄", "🐸",
  "🌵", "🍄", "☕", "🍕", "👾", "🌙",
]

type ProfileResponse = {
  user: PublicUser
  restricted_until: string | null
  created_at: string | null
  sessions: SessionSummary[]
}

function passwordStrength(pw: string): { label: string; className: string } | null {
  if (!pw) return null
  let score = 0
  if (pw.length >= 12) score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (score <= 1) return { label: "Weak", className: "text-destructive" }
  if (score === 2) return { label: "Okay", className: "text-amber-600 dark:text-amber-400" }
  return { label: "Strong", className: "text-emerald-600 dark:text-emerald-400" }
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileResponse | null>(null)
  const [counts, setCounts] = useState<{ posts: number; saved: number } | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [nickname, setNickname] = useState("")
  const [avatarEmoji, setAvatarEmoji] = useState("🎭")
  const [savingIdentity, setSavingIdentity] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [changingPassword, setChangingPassword] = useState(false)
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const passwordInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const load = useCallback(async () => {
    setStatus("loading")
    try {
      const [profileRes, activityRes, savedRes] = await Promise.all([
        fetch("/api/profile"),
        fetch("/api/me/activity"),
        fetch("/api/me/bookmarks"),
      ])
      if (profileRes.status === 401) {
        router.push("/login")
        return
      }
      if (!profileRes.ok) throw new Error("Request failed")
      // counts are best-effort; the profile works without them
      const [data, activityData, savedData] = (await Promise.all([
        profileRes.json(),
        activityRes.ok ? activityRes.json() : Promise.resolve(null),
        savedRes.ok ? savedRes.json() : Promise.resolve(null),
      ])) as [
        ProfileResponse,
        { confessions: unknown[] } | null,
        { confessions: unknown[] } | null,
      ]
      if (activityData && savedData)
        setCounts({
          posts: activityData.confessions.length,
          saved: savedData.confessions.length,
        })
      setProfile(data)
      setSessions(data.sessions)
      setNickname(data.user.nickname)
      setAvatarEmoji(data.user.avatar_emoji)
      setStatus("ready")
    } catch {
      setStatus("error")
    }
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  // focus the password form when a change is being forced
  useEffect(() => {
    if (status === "ready" && profile?.user.must_change_password)
      passwordInputRef.current?.focus()
  }, [status, profile])

  async function saveIdentity(e: React.FormEvent) {
    e.preventDefault()
    setSavingIdentity(true)
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, avatar_emoji: avatarEmoji }),
      })
      if (res.status === 401) {
        router.push("/login")
        return
      }
      const data = (await res.json().catch(() => null)) as {
        user?: PublicUser
        error?: string
      } | null
      if (!res.ok || !data?.user) {
        toast.error(data?.error ?? "Couldn't save your identity. Try again.")
        return
      }
      const updated = data.user
      setProfile((prev) => (prev ? { ...prev, user: updated } : prev))
      toast.success("Identity updated — the feed sees the new you.")
      router.refresh()
    } catch {
      toast.error("Couldn't save your identity. Try again.")
    } finally {
      setSavingIdentity(false)
    }
  }

  async function changeMyPassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast.error("New passwords don't match.")
      return
    }
    setChangingPassword(true)
    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      if (res.status === 401) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        if (data?.error === "Unauthorized") {
          router.push("/login")
          return
        }
        toast.error(data?.error ?? "Current password is incorrect.")
        return
      }
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!res.ok || !data?.ok) {
        toast.error(data?.error ?? "Couldn't change your password. Try again.")
        return
      }
      toast.success("Password changed. Your other devices were signed out.")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setProfile((prev) =>
        prev ? { ...prev, user: { ...prev.user, must_change_password: false } } : prev,
      )
      router.refresh()
    } catch {
      toast.error("Couldn't change your password. Try again.")
    } finally {
      setChangingPassword(false)
    }
  }

  async function refreshSessions() {
    const res = await fetch("/api/profile/sessions")
    if (res.status === 401) {
      router.push("/login")
      return
    }
    if (!res.ok) return
    const data = (await res.json().catch(() => null)) as { sessions?: SessionSummary[] } | null
    if (data?.sessions) setSessions(data.sessions)
  }

  async function logoutAll() {
    try {
      const res = await fetch("/api/profile/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (res.status === 401) {
        router.push("/login")
        return
      }
      if (!res.ok) {
        toast.error("Couldn't sign out your other devices.")
        return
      }
      toast.success("Signed out on your other devices.")
      await refreshSessions()
    } catch {
      toast.error("Couldn't sign out your other devices.")
    }
  }

  async function removeSession(id: string) {
    try {
      const res = await fetch("/api/profile/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: id }),
      })
      if (res.status === 401) {
        router.push("/login")
        return
      }
      if (!res.ok) {
        toast.error("Couldn't sign out that device.")
        return
      }
      setSessions((prev) => prev.filter((s) => s.id !== id))
      toast.success("Signed out that device.")
    } catch {
      toast.error("Couldn't sign out that device.")
    }
  }

  const strength = passwordStrength(newPassword)
  const restricted =
    profile?.restricted_until != null &&
    new Date(profile.restricted_until).getTime() > Date.now()

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your account 🎭</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your public identity and account security. Your username stays secret.
        </p>
      </div>

      {status === "loading" && (
        <div className="grid gap-4">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      )}

      {status === "error" && (
        <StateMessage
          emoji="📡"
          title="Couldn't load your account"
          description="Something went wrong on the way here. Try again?"
          action={
            <Button variant="outline" size="sm" onClick={load}>
              Retry
            </Button>
          }
        />
      )}

      {status === "ready" && profile?.user.must_change_password && (
        <Alert>
          <KeyRound aria-hidden />
          <AlertTitle>Change your password</AlertTitle>
          <AlertDescription>
            This account must set a new password before it's fully trusted.
            Pick one below — your other devices will be signed out.
          </AlertDescription>
        </Alert>
      )}

      {status === "ready" && profile && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Public identity</CardTitle>
              <CardDescription>
                What the feed sees. Your username is private and can't be
                changed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={saveIdentity} className="grid gap-4">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="flex size-12 shrink-0 items-center justify-center rounded-full border bg-muted text-2xl"
                  >
                    {avatarEmoji}
                  </span>
                  <p className="min-w-0 truncate text-sm font-medium">
                    {nickname || "Unnamed"}
                  </p>
                  {profile.user.role === "MODERATOR" && (
                    <Badge variant="secondary">Moderator</Badge>
                  )}
                  {profile.user.role === "ADMIN" && <Badge>Admin</Badge>}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="nickname">Nickname (public)</Label>
                  <Input
                    id="nickname"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    required
                    maxLength={30}
                    placeholder="What the feed calls you"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="avatar-emoji">Avatar emoji</Label>
                  <div
                    id="avatar-emoji"
                    role="group"
                    aria-label="Choose an avatar emoji"
                    className="grid grid-cols-6 gap-1.5"
                  >
                    {EMOJIS.map((emoji) => (
                      <Button
                        key={emoji}
                        type="button"
                        variant="outline"
                        size="lg"
                        aria-pressed={avatarEmoji === emoji}
                        aria-label={`Avatar ${emoji}`}
                        onClick={() => setAvatarEmoji(emoji)}
                        className="text-lg aria-pressed:border-ring aria-pressed:bg-muted"
                      >
                        <span aria-hidden>{emoji}</span>
                      </Button>
                    ))}
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={savingIdentity}
                  className="justify-self-start"
                >
                  {savingIdentity ? "Saving…" : "Save identity"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Account</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Status</span>
                {restricted ? (
                  <Badge variant="destructive">
                    Restricted until{" "}
                    {new Date(profile.restricted_until as string).toLocaleDateString(
                      undefined,
                      { month: "short", day: "numeric", year: "numeric" },
                    )}
                  </Badge>
                ) : (
                  <Badge variant="secondary">Active</Badge>
                )}
              </div>
              {profile.created_at && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Member since</span>
                  <span>
                    {new Date(profile.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Posts</span>
                <span className="tabular-nums">
                  {counts ? counts.posts : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Saved</span>
                <span className="tabular-nums">
                  {counts ? counts.saved : "—"}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Change password</CardTitle>
              <CardDescription>
                Changing your password signs out your other devices.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={changeMyPassword} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="current-password">Current password</Label>
                  <Input
                    ref={passwordInputRef}
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="new-password">New password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    maxLength={128}
                    autoComplete="new-password"
                  />
                  {strength && (
                    <p className={`text-xs ${strength.className}`}>
                      Strength: {strength.label}
                    </p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="confirm-password">Confirm new password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={changingPassword}
                  className="justify-self-start"
                >
                  {changingPassword ? "Changing…" : "Change password"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Active sessions</CardTitle>
              <CardDescription>
                Devices currently signed in as you. This session is included.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No active sessions found.
                </p>
              ) : (
                <ul className="grid gap-2">
                  {sessions.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs">{s.id}</p>
                        <p className="text-xs text-muted-foreground">
                          Expires{" "}
                          {new Date(s.expires_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Sign out session ${s.id.slice(0, 8)}`}
                        onClick={() => removeSession(s.id)}
                      >
                        <X aria-hidden />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={logoutAll}
                className="justify-self-start"
              >
                <LogOut aria-hidden /> Log out everywhere else
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
