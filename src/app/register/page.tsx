"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
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
import { TurnstileWidget } from "@/components/site/turnstile-widget"

const EMOJIS = [
  "🎭", "👻", "🦊", "🐙", "🦄", "🐸",
  "🌵", "🍄", "☕", "🍕", "👾", "🌙",
]

export default function RegisterPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [nickname, setNickname] = useState("")
  const [avatarEmoji, setAvatarEmoji] = useState<string | null>(null)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          nickname,
          avatarEmoji: avatarEmoji ?? undefined,
          turnstileToken,
        }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        setError(data?.error ?? "Registration failed. Try again.")
        return
      }
      window.location.assign("/")
      router.refresh()
    } catch {
      setError("Registration failed. Try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-lg">Create your account 🎭</CardTitle>
        <CardDescription>
          Pick a username and password (private), then a nickname and emoji the
          feed will see.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              autoCapitalize="none"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
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
            <Label htmlFor="avatar-emoji">Avatar emoji (optional)</Label>
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
                  onClick={() =>
                    setAvatarEmoji((prev) => (prev === emoji ? null : emoji))
                  }
                  className="text-lg aria-pressed:border-ring aria-pressed:bg-muted"
                >
                  <span aria-hidden>{emoji}</span>
                </Button>
              ))}
            </div>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <TurnstileWidget onToken={setTurnstileToken} />
          <Button type="submit" size="lg" disabled={submitting}>
            {submitting ? "Creating account…" : "Sign up"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Log in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
