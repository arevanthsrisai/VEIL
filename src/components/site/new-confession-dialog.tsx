"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const TYPES = [
  { value: "thought", label: "Thought" },
  { value: "idea", label: "Idea" },
  { value: "question", label: "Question" },
  { value: "discussion", label: "Discussion" },
  { value: "knowledge", label: "Knowledge" },
  { value: "experience", label: "Experience" },
  { value: "resource", label: "Resource" },
  { value: "event", label: "Event" },
  { value: "opportunity", label: "Opportunity" },
  { value: "doubt", label: "Doubt" },
] as const

export function NewConfessionButton() {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [type, setType] = useState("")
  const [anonymous, setAnonymous] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/confessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || undefined,
          content,
          type: type || undefined,
          anonymous,
        }),
      })
      if (res.status === 401) {
        router.push("/login")
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(
          (data as { error?: string } | null)?.error ??
            "Something went wrong. Try again."
        )
        return
      }
      setOpen(false)
      setTitle("")
      setContent("")
      setType("")
      setAnonymous(false)
      toast.success("Submitted for moderation 🕵️", {
        description: "It'll show up on the feed once it's approved.",
      })
    } catch {
      setError("Something went wrong. Try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="lg">
            <PlusIcon data-icon="inline-start" />
            New confession
          </Button>
        }
      />
      <DialogContent>
        <form onSubmit={onSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>New confession 🤫</DialogTitle>
            <DialogDescription>
              Every confession is reviewed before it goes public.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="confession-title">Title (optional)</Label>
            <Input
              id="confession-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="e.g. Mess food mysteries"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confession-type">Type (optional)</Label>
            <select
              id="confession-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50"
            >
              <option value="">None</option>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confession-content">Confession</Label>
            <Textarea
              id="confession-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              maxLength={5000}
              placeholder="Spill it. Nobody's watching… probably."
            />
            <p
              className={cn(
                "text-xs tabular-nums",
                content.length >= 4500
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-muted-foreground"
              )}
            >
              {content.length}/5000
            </p>
          </div>
          <div className="grid gap-1.5">
            <Button
              type="button"
              variant={anonymous ? "default" : "outline"}
              size="sm"
              aria-pressed={anonymous}
              onClick={() => setAnonymous((v) => !v)}
              className="w-fit"
            >
              <span aria-hidden>🕵️</span>
              Post anonymously
            </Button>
            <p className="text-xs text-muted-foreground">
              {anonymous
                ? "Your nickname and avatar stay hidden on this post."
                : "Your VEIL identity (nickname + avatar) shows on this post."}
            </p>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={submitting || content.trim().length === 0}>
              {submitting ? "Submitting…" : "Submit for moderation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
