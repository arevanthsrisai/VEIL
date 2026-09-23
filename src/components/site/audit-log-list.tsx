import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { relativeTime } from "@/components/site/format"
import type { AuditLogEntry } from "@/lib/settings"

export function AuditLogList({ entries }: { entries: AuditLogEntry[] }) {
  if (entries.length === 0) {
    return (
      <Card className="items-center gap-2 py-10 text-center">
        <span className="text-4xl" aria-hidden>
          📜
        </span>
        <p className="font-medium">No audit activity yet</p>
        <p className="text-sm text-muted-foreground">Admin actions will appear here.</p>
      </Card>
    )
  }

  return (
    <div className="grid gap-2">
      {entries.map((entry) => {
        const metaText = entry.meta ? JSON.stringify(entry.meta) : null
        return (
          <Card key={entry.id} className="items-center gap-3 py-3" size="sm">
            <Badge variant="outline">{entry.action}</Badge>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {entry.targetType}
                {entry.targetId ? ` · ${entry.targetId}` : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                {entry.actorNickname ?? "Unknown"} · {relativeTime(entry.createdAt)}
              </p>
            </div>
            {metaText && (
              <code
                className="hidden max-w-40 truncate rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground sm:block"
                title={metaText}
              >
                {metaText}
              </code>
            )}
          </Card>
        )
      })}
    </div>
  )
}
