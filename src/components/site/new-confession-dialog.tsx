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

export function NewConfessionButton() {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
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
        body: JSON.stringify({ title: title.trim() || undefined, content }),
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
              Anonymous by default. Every confession is reviewed before it goes
              public.
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
            <Label htmlFor="confession-content">Confession</Label>
            <Textarea
              id="confession-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              maxLength={5000}
              placeholder="Spill it. Nobody's watching… probably."
            />
            <p className="text-xs text-muted-foreground">
              {content.length}/5000
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
