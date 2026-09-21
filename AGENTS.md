# AGENTS.md — VEIL

Project-level instructions for all agents working in this repository.

## Project

Veil (styled **VEIL**) is a private-feeling, anonymous campus knowledge-sharing platform — small anonymous thoughts, experiences, ideas, questions, discussions, useful campus knowledge. Text-only V1. Users have private accounts (username + password) with an optional public identity (nickname + emoji avatar), and may post fully identityless ("post without my VEIL identity"). All content passes through moderation before becoming public. There is NO public comment system.

## Naming Rules

- The product is **VEIL** everywhere user-facing: titles, nav, metadata/footer/about/auth pages.
- "confession" must not appear as the product/page/site name anywhere user-facing.
- "AMRITA"/"AMRITA AP" must NEVER appear anywhere in the codebase or UI.
- Internal identifiers may describe content type (`thought`, `idea`, `discussion`, `question`, `knowledge`).

## Stack

- **Framework**: Next.js 16 App Router (React 19 + Node API routes in one deployable, Turbopack)
- **DB**: Voroa Postgres (NOT Neon) — schema in `db/schema.sql`, applied via `db/migrate` scripts or Voroa MCP
- **Auth**: bcryptjs + DB-backed session cookies (httpOnly, SameSite=Lax). No email/phone/ID required.
- **Styling**: Tailwind CSS v4 + shadcn/ui components (base-nova preset) in `src/components/ui/`
- **Tests**: Vitest (unit, `*.test.ts`) + Playwright (E2E, `e2e/`)
- **Hosting**: Voroa web service (Node runtime), env vars configured in dashboard

## Commands

```powershell
npm run dev        # dev server (background only — never with a bash timeout)
npm run build      # production build
npm test           # vitest run
npx tsc --noEmit   # typecheck
node scripts/bootstrap-admin.mjs <username> <password> [nickname]  # admin bootstrap
```

## Architecture

- `src/lib/db.ts` — pg Pool (lazy), `query()` helper; throws clear error when `DATABASE_URL` unset
- `src/lib/auth.ts` — bcrypt hash/verify, session create/validate/destroy, `getCurrentUser()`, `toPublicUser()`
- `src/lib/confessions.ts` — validators, mappers, rate limiter, confession queries
- `src/lib/interactions.ts` — reactions/reports logic (NO comments — removed per spec)
- `src/app/api/*` — REST routes (`runtime = "nodejs"`), JSON errors `{ error: string }`
- `src/app/` — pages: `/` feed, `/post/[id]`, `/login`, `/register`
- `src/components/site/` — site components; `src/components/ui/` — shadcn primitives
- `db/schema.sql` — full schema (users, sessions, confessions, reactions, reports, notifications, moderation_actions; NO comments — removed per spec; bookmarks/polls/audit_logs/site_settings omitted until implemented)

## Hard Rules

1. `username` is PRIVATE — never returned in any API response, log, or rendered anywhere.
2. All confessions start `PENDING`; only `APPROVED` is public. Feed sorts by original `created_at`, not `approved_at`. There is NO comment system (removed per spec).
3. Role checks (`USER`/`MODERATOR`/`ADMIN`) are server-side only.
4. Admin bootstrap ONLY via `scripts/bootstrap-admin.mjs` — no `/register?role=admin`.
5. No Redis/AI/media uploads in V1. In-memory rate limiters carry `ponytail:` ceiling notes.
6. Turnstile active only when `TURNSTILE_SECRET_KEY` is set (documented ceiling).
7. Never log or hardcode secrets; parameterized queries only.

## Git

- Conventional commits, concise (`feat:`, `chore:`, `fix:`).
- Push target: `https://github.com/arevanthsrisai/AmritaAP-Confessions.git` (branch `main`).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
