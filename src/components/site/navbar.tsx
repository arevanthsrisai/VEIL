"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import {
  BarChart3Icon,
  HouseIcon,
  MoonIcon,
  NewspaperIcon,
  SearchIcon,
  SunIcon,
  UserIcon,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { NotificationBell } from "@/components/site/notification-bell"
import { cn } from "@/lib/utils"

type Me = {
  id: string
  nickname: string
  avatarEmoji: string
  role: string
}

const MOBILE_TABS = [
  { href: "/", label: "Home", icon: HouseIcon },
  { href: "/popular", label: "Popular", icon: NewspaperIcon },
  { href: "/polls", label: "Polls", icon: BarChart3Icon },
  { href: "/search", label: "Search", icon: SearchIcon },
  { href: "/activity", label: "You", icon: UserIcon },
] as const

const DESKTOP_NAV = [
  { href: "/", label: "Home" },
  { href: "/popular", label: "Popular" },
  { href: "/polls", label: "Polls" },
  { href: "/borrow", label: "Borrow" },
  { href: "/archive", label: "Archive" },
  { href: "/search", label: "Search" },
  { href: "/today", label: "Today" },
  { href: "/activity", label: "Activity" },
] as const

export function SiteNavbar() {
  const [user, setUser] = useState<Me | null>(null)
  const [loaded, setLoaded] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

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
    <>
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
              {DESKTOP_NAV.map((item) => (
                <Button
                  key={item.href}
                  variant="ghost"
                  size="sm"
                  nativeButton={false}
                  render={<Link href={item.href} />}
                  aria-current={pathname === item.href ? "page" : undefined}
                  className={cn(pathname === item.href && "bg-accent text-foreground")}
                >
                  {item.label}
                </Button>
              ))}
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

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
        aria-label="Primary"
      >
        <div className="grid h-16 grid-cols-5">
          {MOBILE_TABS.map((tab) => {
            const active = pathname === tab.href
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <tab.icon className="size-5" aria-hidden />
                {tab.label}
                <span
                  aria-hidden
                  className={cn(
                    "h-0.5 w-6 rounded-full transition-colors",
                    active ? "bg-primary" : "bg-transparent",
                  )}
                />
              </Link>
            )
          })}
        </div>
      </nav>
    </>
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
