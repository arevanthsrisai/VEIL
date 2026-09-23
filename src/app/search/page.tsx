"use client"

import { useCallback, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  ConfessionCard,
  ConfessionSkeleton,
  ErrorMessage,
  StateMessage,
  type ConfessionItem,
} from "@/components/site/confession-list"

export default function SearchPage() {
  const [query, setQuery] = useState("")
  const [ranQuery, setRanQuery] = useState("")
  const [items, setItems] = useState<ConfessionItem[]>([])
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const router = useRouter()

  const runSearch = useCallback(
    async (raw: string) => {
      const q = raw.trim()
      if (!q) return
      setStatus("loading")
      setRanQuery(q)
      try {
        const res = await fetch(`/api/confessions/search?q=${encodeURIComponent(q)}`)
        if (res.status === 401) {
          router.push("/login")
          return
        }
        if (!res.ok) throw new Error("Request failed")
        const data = (await res.json()) as { confessions: ConfessionItem[] }
        setItems(data.confessions)
        setStatus("ready")
      } catch {
        setStatus("error")
      }
    },
    [router],
  )

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    void runSearch(query)
  }

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Search 🔍</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dig through every approved confession by keyword.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex gap-2" role="search">
        <label htmlFor="search-q" className="sr-only">
          Search confessions
        </label>
        <Input
          id="search-q"
          type="search"
          placeholder="Search confessions…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={100}
          autoComplete="off"
        />
        <Button type="submit" disabled={status === "loading"}>
          {status === "loading" ? "Searching…" : "Search"}
        </Button>
      </form>

      {status === "loading" && <ConfessionSkeleton />}

      {status === "error" && (
        <ErrorMessage
          description={`The search lens fogged up looking for "${ranQuery}". Try again?`}
          onRetry={() => void runSearch(ranQuery)}
        />
      )}

      {status === "idle" && (
        <StateMessage
          emoji="🕵️"
          title="What are you looking for?"
          description="Type a keyword and press Enter to search."
        />
      )}

      {status === "ready" && items.length === 0 && (
        <StateMessage
          emoji="🕸️"
          title={`Nothing found for "${ranQuery}"`}
          description="Try a different keyword."
        />
      )}

      {status === "ready" &&
        items.map((item) => <ConfessionCard key={item.id} item={item} />)}
    </div>
  )
}
