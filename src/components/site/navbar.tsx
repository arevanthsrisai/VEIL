"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { MoonIcon, SunIcon } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { NotificationBell } from "@/components/site/notification-bell"

type Me = {
  id: string
  nickname: string
  avatarEmoji: string
  role: string
}

export function SiteNavbar() {
  const [user, setUser] = useState<Me | null>(null)
  const [loaded, setLoaded] = useState(false)
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => {
        if (cancelled) return
        setUser(data.user ?? null)
        setLoaded(true)
      })
      .catch(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" })
    setUser(null)
    router.push("/")
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <nav className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-semibold tracking-tight transition-opacity hover:opacity-80"
        >
          <span aria-hidden className="text-lg">
            🎭
          </span>
          VEIL
        </Link>
        {(!loaded || !user || user.role === "USER") && (
          <div className="hidden items-center gap-0.5 sm:flex">
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/" />}>
              Home
            </Button>
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/popular" />}>
              Popular
            </Button>
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/polls" />}>
              Polls
            </Button>
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/archive" />}>
              Archive
            </Button>
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/search" />}>
              Search
            </Button>
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/today" />}>
              Today
            </Button>
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/activity" />}>
              Activity
            </Button>
          </div>
        )}
        {!loaded ? (
          <Skeleton className="size-8 rounded-full" />
        ) : user ? (
          <div className="flex items-center gap-2.5">
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/profile" />}>
              Profile
            </Button>
            {(user.role === "MODERATOR" || user.role === "ADMIN") && (
              <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/moderation" />}>
                Moderation
              </Button>
            )}
            {user.role === "ADMIN" && (
              <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/admin" />}>
                Admin
              </Button>
            )}
            <NotificationBell />
            <Avatar size="sm" aria-hidden>
              <AvatarFallback className="text-sm">
                {user.avatarEmoji}
              </AvatarFallback>
            </Avatar>
            <span className="hidden text-sm text-muted-foreground sm:block">
              {user.nickname}
            </span>
            <Button variant="ghost" size="sm" onClick={logout}>
              Log out
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/login" />}>
              Log in
            </Button>
            <Button size="sm" nativeButton={false} render={<Link href="/register" />}>
              Sign up
            </Button>
          </div>
        )}
        <ThemeToggle />
      </nav>
    </header>
  )
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return <Skeleton className="size-8 rounded-full" aria-hidden />
  const dark = resolvedTheme === "dark"
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="size-8 p-0"
    >
      {dark ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
    </Button>
  )
}
