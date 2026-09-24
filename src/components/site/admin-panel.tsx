"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { RefreshCwIcon } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { relativeTime } from "@/components/site/format"
import { PollManager } from "@/components/site/poll-manager"
import { SettingsPanel } from "@/components/site/settings-panel"
import { AuditLogList } from "@/components/site/audit-log-list"
import type { AuditLogEntry } from "@/lib/settings"

type Stats = {
  users: number
  confessions: { total: number; pending: number; approved: number; rejected: number }
  openReports: number
}

type AdminUser = {
  id: string
  username: string
  nickname: string
  avatarEmoji: string
  role: string
  createdAt: string
  restrictedUntil: string | null
  mustChangePassword: boolean
  postCount: number
}

const ROLES = ["USER", "MODERATOR", "ADMIN"] as const
type Role = (typeof ROLES)[number]

const ROLE_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  ADMIN: "default",
  MODERATOR: "secondary",
  USER: "outline",
}

function generateTempPassword(): string {
  // 12 chars, no ambiguous glyphs (0/O/1/l/I) — passes the API's 8-128 check
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  let out = ""
  for (const b of bytes) out += chars[b % chars.length]
  return out
}

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <Card className="gap-1 py-3">
      <CardContent className="grid gap-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  )
}

function UserRow({
  user,
  isSelf,
  busy,
  onRoleChange,
  onRestrict,
  onResetPassword,
  onRemove,
}: {
  user: AdminUser
  isSelf: boolean
  busy: boolean
  onRoleChange: (userId: string, role: Role) => void
  onRestrict: (userId: string, days: number | null) => void
  onResetPassword: (userId: string) => void
  onRemove: (userId: string) => void
}) {
  // 0 = closed, 1 = first warning, 2 = final confirmation
  const [confirmStep, setConfirmStep] = useState<0 | 1 | 2>(0)
  const restricted = user.restrictedUntil !== null && new Date(user.restrictedUntil).getTime() > Date.now()
  return (
    <Card className="items-center gap-3 py-3" size="sm">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <Avatar size="sm" aria-hidden>
          <AvatarFallback className="text-sm">{user.avatarEmoji}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
            {user.nickname}
            {isSelf && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
            {restricted && <Badge variant="destructive">Restricted 🚫</Badge>}
            {user.mustChangePassword && <Badge variant="secondary">Temp password 🔑</Badge>}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            @{user.username} · Joined {relativeTime(user.createdAt)} · {user.postCount}{" "}
            {user.postCount === 1 ? "post" : "posts"}
            {restricted && ` · until ${new Date(user.restrictedUntil!).toLocaleString()}`}
          </p>
        </div>
      </div>
      <Badge variant={ROLE_VARIANT[user.role] ?? "outline"}>{user.role}</Badge>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm" disabled={busy} aria-label={`Moderate account for ${user.nickname}`}>
              {user.role === (isSelf ? "ADMIN" : user.role) ? "Change" : user.role}
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          {ROLES.map((role) => {
            const disabled = role === user.role || (isSelf && role !== "ADMIN")
            return (
              <DropdownMenuItem
                key={role}
                disabled={disabled}
                title={disabled && isSelf && role !== "ADMIN" ? "You can't demote yourself" : undefined}
                onClick={() => onRoleChange(user.id, role)}
              >
                {role}
              </DropdownMenuItem>
            )
          })}
          {user.role === "USER" && !isSelf && (
            <DropdownMenuItem
              onClick={() => onRestrict(user.id, restricted ? null : 7)}
            >
              {restricted ? "Remove restriction" : "Restrict 7 days"}
            </DropdownMenuItem>
          )}
          {!isSelf && (
            <DropdownMenuItem onClick={() => onResetPassword(user.id)}>
              Reset password
            </DropdownMenuItem>
          )}
          {user.role === "USER" && !isSelf && (
            <DropdownMenuItem onClick={() => setConfirmStep(1)}>
              Remove account
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog
        open={confirmStep > 0}
        onOpenChange={(open) => {
          if (!open) setConfirmStep(0)
        }}
      >
        <DialogContent>
          {confirmStep === 1 ? (
            <>
              <DialogHeader>
                <DialogTitle>Remove {user.nickname}?</DialogTitle>
                <DialogDescription>
                  This permanently deletes @{user.username} along with their posts, reactions, and
                  reports. Only the audit trail remains.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmStep(0)}>
                  Cancel
                </Button>
                <Button onClick={() => setConfirmStep(2)}>Continue</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Are you sure?</DialogTitle>
                <DialogDescription>
                  Removing @{user.username} cannot be undone. Their content is deleted for good.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmStep(1)}>
                  Go back
                </Button>
                <Button
                  variant="destructive"
                  disabled={busy}
                  onClick={() => {
                    setConfirmStep(0)
                    onRemove(user.id)
                  }}
                >
                  Remove account
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}

export function AdminPanel() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [usersStatus, setUsersStatus] = useState<"loading" | "ready" | "error">("loading")
  const [status, setStatus] = useState<"loading" | "ready" | "forbidden" | "error">("loading")
  const [refreshing, setRefreshing] = useState(false)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [myId, setMyId] = useState<string | null>(null)
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  // the generated temp password lives only here — dropped the moment the dialog closes
  const [pwShown, setPwShown] = useState<{ nickname: string; password: string } | null>(null)
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => {
        if (!cancelled) setMyId(data.user?.id ?? null)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const load = useCallback(
    async (initial: boolean) => {
      if (initial) setStatus("loading")
      else setRefreshing(true)
      try {
        const [statsRes, logsRes] = await Promise.all([
          fetch("/api/admin/stats"),
          fetch("/api/admin/audit-logs"),
        ])
        if (statsRes.status === 401) {
          router.push("/login")
          return
        }
        if (statsRes.status === 403) {
          setStatus("forbidden")
          return
        }
        if (!statsRes.ok) throw new Error("Request failed")
        const statsData = (await statsRes.json()) as { stats: Stats }
        setStats(statsData.stats)
        if (logsRes.ok) {
          const logsData = (await logsRes.json()) as { logs: AuditLogEntry[] }
          setLogs(logsData.logs ?? [])
        }
        setStatus("ready")
      } catch {
        if (initial) setStatus("error")
        else toast.error("Couldn't refresh admin data.")
      } finally {
        setRefreshing(false)
      }
    },
    [router]
  )

  const loadUsers = useCallback(
    async (term: string) => {
      try {
        const res = await fetch(`/api/admin/users${term ? `?search=${encodeURIComponent(term)}` : ""}`)
        if (res.status === 401) {
          router.push("/login")
          return
        }
        if (res.status === 403) {
          setStatus("forbidden")
          return
        }
        if (!res.ok) throw new Error("Request failed")
        const data = (await res.json()) as { users: AdminUser[] }
        setUsers(data.users ?? [])
        setUsersStatus("ready")
      } catch {
        setUsersStatus("error")
      }
    },
    [router]
  )

  useEffect(() => {
    load(true)
  }, [load])

  useEffect(() => {
    void loadUsers(debouncedSearch)
  }, [debouncedSearch, loadUsers])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  async function changeRole(userId: string, role: Role) {
    const target = users.find((u) => u.id === userId)
    setBusyUserId(userId)
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      })
      if (res.status === 401) {
        router.push("/login")
        return
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        toast.error(data?.error ?? "Couldn't update role.")
        return
      }
      toast.success(`${target?.nickname ?? "User"} is now ${role}`)
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)))
    } catch {
      toast.error("Couldn't update role.")
    } finally {
      setBusyUserId(null)
    }
  }

  async function changeRestrict(userId: string, days: number | null) {
    const target = users.find((u) => u.id === userId)
    setBusyUserId(userId)
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/restrict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      })
      if (res.status === 401) {
        router.push("/login")
        return
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        toast.error(data?.error ?? "Couldn't update restriction.")
        return
      }
      const restrictedUntil = days === null ? null : new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, restrictedUntil } : u)))
      toast.success(days === null ? `${target?.nickname ?? "User"} unrestricted` : `${target?.nickname ?? "User"} restricted for ${days} days`)
    } catch {
      toast.error("Couldn't update restriction.")
    } finally {
      setBusyUserId(null)
    }
  }

  async function resetPassword(userId: string) {
    const target = users.find((u) => u.id === userId)
    const tempPassword = generateTempPassword()
    setBusyUserId(userId)
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempPassword }),
      })
      if (res.status === 401) {
        router.push("/login")
        return
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        toast.error(data?.error ?? "Couldn't reset password.")
        return
      }
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, mustChangePassword: true } : u)))
      setPwShown({ nickname: target?.nickname ?? "user", password: tempPassword })
    } catch {
      toast.error("Couldn't reset password.")
    } finally {
      setBusyUserId(null)
    }
  }

  async function removeAccount(userId: string) {
    const target = users.find((u) => u.id === userId)
    setBusyUserId(userId)
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, { method: "DELETE" })
      if (res.status === 401) {
        router.push("/login")
        return
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        toast.error(data?.error ?? "Couldn't remove account.")
        return
      }
      setUsers((prev) => prev.filter((u) => u.id !== userId))
      toast.success(`Removed ${target?.nickname ?? "user"}`)
    } catch {
      toast.error("Couldn't remove account.")
    } finally {
      setBusyUserId(null)
    }
  }

  async function copyPassword() {
    if (!pwShown) return
    try {
      await navigator.clipboard.writeText(pwShown.password)
      toast.success("Copied — it won't be shown again after you close this.")
    } catch {
      toast.error("Copy failed — select the password and copy manually.")
    }
  }

  if (status === "forbidden") {
    return (
      <Card className="items-center gap-2 py-12 text-center">
        <span className="text-4xl" aria-hidden>
          🔒
        </span>
        <p className="font-medium">You don't have permission</p>
        <p className="text-sm text-muted-foreground">
          The admin panel is for admins only.
        </p>
      </Card>
    )
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin ⚙️</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Site stats and role management.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={refreshing}
          onClick={() => {
            load(false)
            void loadUsers(debouncedSearch)
          }}
        >
          <RefreshCwIcon
            data-icon="inline-start"
            className={refreshing ? "animate-spin" : undefined}
          />
          Refresh
        </Button>
      </div>

      {status === "loading" && (
        <div className="grid gap-4" aria-hidden>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} className="gap-1 py-3">
                <CardContent className="grid gap-1.5">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-7 w-12" />
                </CardContent>
              </Card>
            ))}
          </div>
          {[0, 1, 2].map((i) => (
            <Card key={i} className="items-center gap-3 py-3" size="sm">
              <div className="flex w-full items-center gap-2.5">
                <Skeleton className="size-6 rounded-full" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="ml-auto h-5 w-16 rounded-4xl" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {status === "error" && (
        <Card className="items-center gap-2 py-10 text-center">
          <span className="text-4xl" aria-hidden>
            📡
          </span>
          <p className="font-medium">Couldn't load admin data</p>
          <p className="text-sm text-muted-foreground">Something went wrong. Try again?</p>
          <Button variant="outline" size="sm" onClick={() => load(true)}>
            Retry
          </Button>
        </Card>
      )}

      {status === "ready" && stats && (
        <Tabs defaultValue="overview">
          <TabsList className="w-full flex-wrap">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="polls">Polls</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="audit">Audit</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-3 grid gap-3">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Users" value={stats.users} />
            <StatCard
              label="Confessions"
              value={stats.confessions.total}
              sub={`${stats.confessions.pending} pending · ${stats.confessions.approved} approved · ${stats.confessions.rejected} rejected`}
            />
              <StatCard label="Open reports" value={stats.openReports} />
            </div>
            <Card className="items-center gap-2 py-8 text-center">
              <span className="text-4xl" aria-hidden>
                🛡️
              </span>
              <p className="font-medium">Control center</p>
              <p className="text-sm text-muted-foreground">
                Use the tabs above to manage users, polls, settings, and the audit trail.
              </p>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="mt-3 grid gap-3">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Users</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  You can't demote yourself below Admin.
                </p>
              </div>
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search nickname or username"
                aria-label="Search users"
                className="w-full sm:w-64"
              />
            </div>

          <div className="grid gap-2">
            {usersStatus === "loading" && (
              <div className="grid gap-2" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <Card key={i} className="items-center gap-3 py-3" size="sm">
                    <div className="flex w-full items-center gap-2.5">
                      <Skeleton className="size-6 rounded-full" />
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="ml-auto h-5 w-16 rounded-4xl" />
                    </div>
                  </Card>
                ))}
              </div>
            )}
            {usersStatus === "error" && (
              <Card className="items-center gap-2 py-8 text-center">
                <p className="font-medium">Couldn't load users</p>
                <Button variant="outline" size="sm" onClick={() => void loadUsers(debouncedSearch)}>
                  Retry
                </Button>
              </Card>
            )}
            {usersStatus === "ready" && users.length === 0 && (
              <Card className="items-center gap-2 py-10 text-center">
                <span className="text-4xl" aria-hidden>
                  🫥
                </span>
                <p className="font-medium">
                  {debouncedSearch ? "No users match your search" : "No users yet"}
                </p>
              </Card>
            )}
            {usersStatus === "ready" &&
              users.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  isSelf={user.id === myId}
                  busy={busyUserId === user.id}
                  onRoleChange={(id, role) => void changeRole(id, role)}
                  onRestrict={(id, days) => void changeRestrict(id, days)}
                  onResetPassword={(id) => void resetPassword(id)}
                  onRemove={(id) => void removeAccount(id)}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="polls" className="mt-3">
            <PollManager />
          </TabsContent>

          <TabsContent value="settings" className="mt-3">
            <SettingsPanel />
          </TabsContent>

          <TabsContent value="audit" className="mt-3 grid gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Audit log 📜</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Moderation, admin, and security events. Newest first.
              </p>
            </div>
            <AuditLogList entries={logs} />
          </TabsContent>
        </Tabs>
      )}

      <Dialog
        open={pwShown !== null}
        onOpenChange={(open) => {
          if (!open) setPwShown(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Temporary password for {pwShown?.nickname}</DialogTitle>
            <DialogDescription>Shown once — copy it now. It won't be displayed again.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2.5 py-1.5 font-mono text-sm">
              {pwShown?.password}
            </code>
            <Button variant="outline" size="sm" onClick={() => void copyPassword()}>
              Copy
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            The user must change this password at their next login.
          </p>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" size="sm" />}>Done</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
