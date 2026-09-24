"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { PlusIcon } from "lucide-react"
import type { BorrowItem } from "@/lib/borrow"

const BORROW_CATEGORIES = [
  "calculator",
  "laptop",
  "charger",
  "books",
  "lab equipment",
  "stationery",
  "other",
] as const
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ConfessionSkeleton, ErrorMessage, StateMessage } from "@/components/site/confession-list"
import { BorrowCard } from "@/components/site/borrow-card"
import { cn } from "@/lib/utils"

function OfferForm({ onCreated }: { onCreated: (item: BorrowItem) => void }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState<string>(BORROW_CATEGORIES[0])
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch("/api/borrow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description.trim(), category }),
      })
      if (res.status === 401) {
        router.push("/login")
        return
      }
      if (res.status === 429) {
        toast.error("Slow down 🐢")
        return
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        toast.error(data?.error ?? "Couldn't create the listing.")
        return
      }
      const data = (await res.json()) as { item: BorrowItem }
      onCreated(data.item)
      setOpen(false)
      setTitle("")
      setDescription("")
      toast.success("Listing created 🤝")
    } catch {
      toast.error("Couldn't create the listing.")
    } finally {
      setSubmitting(false)
    }
  }

  if (!open)
    return (
      <Button size="sm" onClick={() => setOpen(true)} aria-label="Offer an item">
        <PlusIcon data-icon="inline-start" />
        Offer an item
      </Button>
    )

  return (
    <Card className="w-full gap-3 py-4">
      <CardHeader>
        <CardTitle className="text-base">Offer an item 🤝</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="borrow-title">What are you offering?</Label>
          <Input
            id="borrow-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={120}
            placeholder="e.g. TI-84 calculator"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="borrow-desc">Details (optional)</Label>
          <Textarea
            id="borrow-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={2}
            placeholder="Condition, where to meet, when it's free…"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="borrow-category">Category</Label>
          <select
            id="borrow-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          >
            {BORROW_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={submitting || title.trim().length === 0} onClick={onSubmit}>
          {submitting ? "Creating…" : "Create listing"}
        </Button>
      </CardFooter>
    </Card>
  )
}

export default function BorrowPage() {
  const [items, setItems] = useState<BorrowItem[]>([])
  const [mine, setMine] = useState<BorrowItem[]>([])
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [category, setCategory] = useState<string | null>(null)
  const router = useRouter()

  const load = useCallback(async () => {
    setStatus("loading")
    try {
      const qs = category ? `?category=${encodeURIComponent(category)}` : ""
      const res = await fetch(`/api/borrow${qs}`)
      if (res.status === 401) {
        router.push("/login")
        return
      }
      if (!res.ok) throw new Error("Request failed")
      const data = (await res.json()) as { items: BorrowItem[] }
      setItems(data.items)
      const mineRes = await fetch("/api/borrow/mine")
      if (mineRes.ok) {
        const mineData = (await mineRes.json()) as { items: BorrowItem[] }
        setMine(mineData.items)
      }
      setStatus("ready")
    } catch {
      setStatus("error")
    }
  }, [category, router])

  useEffect(() => {
    load()
  }, [load])

  function updateItem(updated: BorrowItem) {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)).filter((i) => i.status === "AVAILABLE" || i.isMine))
    setMine((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Borrow & lend 🤝</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Calculators, chargers, books — campus shares quietly. No payments.
          </p>
        </div>
        <OfferForm onCreated={(item) => setItems((prev) => [item, ...prev])} />
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Filter by category">
        <Button
          variant={category === null ? "default" : "outline"}
          size="sm"
          onClick={() => setCategory(null)}
          aria-pressed={category === null}
        >
          All
        </Button>
        {BORROW_CATEGORIES.map((c) => (
          <Button
            key={c}
            variant={category === c ? "default" : "outline"}
            size="sm"
            className={cn("shrink-0")}
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
          >
            {c}
          </Button>
        ))}
      </div>

      {status === "loading" && <ConfessionSkeleton count={2} />}

      {status === "error" && (
        <ErrorMessage
          description="The lending shelf is stuck. Try again?"
          onRetry={() => load()}
        />
      )}

      {status === "ready" && items.length === 0 && (
        <StateMessage
          emoji="🧰"
          title="Nothing to borrow yet"
          description="Offer something and be the first lender on campus."
        />
      )}

      {status === "ready" && items.length > 0 && (
        <div className="grid gap-3">
          {items.map((item) => (
            <BorrowCard key={item.id} item={item} onUpdate={updateItem} />
          ))}
        </div>
      )}

      {mine.length > 0 && (
        <div className="grid gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Your activity 📋</h2>
          {mine.map((item) => (
            <BorrowCard key={item.id} item={item} onUpdate={updateItem} />
          ))}
        </div>
      )}
    </div>
  )
}
