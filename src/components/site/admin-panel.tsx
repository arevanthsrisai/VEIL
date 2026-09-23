"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { RefreshCwIcon } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  nickname: string
  avatarEmoji: string
  role: string
  createdAt: string
  restrictedUntil: string | null
}

const ROLES = ["USER", "MODERATOR", "ADMIN"] as const
type Role = (typeof ROLES)[number]

const ROLE_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  ADMIN: "default",
  MODERATOR: "secondary",
  USER: "outline",
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
}: {
  user: AdminUser
  isSelf: boolean
  busy: boolean
  onRoleChange: (userId: string, role: Role) => void
  onRestrict: (userId: string, days: number | null) => void
}) {
  const restricted = user.restrictedUntil !== null && new Date(user.restrictedUntil).getTime() > Date.now()
  return (
    <Card className="items-center gap-3 py-3" size="sm">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <Avatar size="sm" aria-hidden>
          <AvatarFallback className="text-sm">{user.avatarEmoji}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-sm font-medium">
            {user.nickname}
            {isSelf && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
            {restricted && <Badge variant="destructive">Restricted 🚫</Badge>}
          </p>
          <p className="text-xs text-muted-foreground">
            Joined {relativeTime(user.createdAt)}
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
        </DropdownMenuContent>
      </DropdownMenu>
    </Card>
  )
}

export function AdminPanel() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [status, setStatus] = useState<"loading" | "ready" | "forbidden" | "error">("loading")
  const [refreshing, setRefreshing] = useState(false)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [myId, setMyId] = useState<string | null>(null)
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
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
        const [statsRes, usersRes, logsRes] = await Promise.all([
          fetch("/api/admin/stats"),
          fetch("/api/admin/users"),
          fetch("/api/admin/audit-logs"),
        ])
        if (usersRes.status === 401 || statsRes.status === 401) {
          router.push("/login")
          return
        }
        if (usersRes.status === 403 || statsRes.status === 403) {
          setStatus("forbidden")
          return
        }
        if (!statsRes.ok || !usersRes.ok) throw new Error("Request failed")
        const statsData = (await statsRes.json()) as { stats: Stats }
        const usersData = (await usersRes.json()) as { users: AdminUser[] }
        setStats(statsData.stats)
        setUsers(usersData.users ?? [])
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

  useEffect(() => {
    load(true)
  }, [load])

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
          onClick={() => load(false)}
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
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Users" value={stats.users} />
            <StatCard
              label="Confessions"
              value={stats.confessions.total}
              sub={`${stats.confessions.pending} pending · ${stats.confessions.approved} approved · ${stats.confessions.rejected} rejected`}
            />
            <StatCard label="Open reports" value={stats.openReports} />
          </div>

          <div>
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Users</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  You can't demote yourself below Admin.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            {users.length === 0 && (
              <Card className="items-center gap-2 py-10 text-center">
                <span className="text-4xl" aria-hidden>
                  🫥
                </span>
                <p className="font-medium">No users yet</p>
              </Card>
            )}
            {users.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                isSelf={user.id === myId}
                busy={busyUserId === user.id}
                onRoleChange={(id, role) => void changeRole(id, role)}
                onRestrict={(id, days) => void changeRestrict(id, days)}
              />
            ))}
          </div>

          <PollManager />

          <SettingsPanel />

          <div>
            <h2 className="text-lg font-semibold tracking-tight">Audit log 📜</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Moderation, admin, and security events. Newest first.
            </p>
            <div className="mt-3">
              <AuditLogList entries={logs} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
