# Project State — VEIL

## Current Phase
Phase 10 — Deploy (BLOCKED on Voroa DB approval). Phases 0-9 complete.

## Recovery History (2026-09-20/21)
- Session suffered output-stream degradation; `db/schema.sql` was corrupted. No git commits existed, so no git restore was possible.
- Snapshot taken BEFORE any modification: `../VEIL-recovery-snapshot-20260920-173944/` (outside repo).
- Schema reconstructed from the verified code contract (all queries in src/lib + API routes grepped and mapped column-by-column), NOT from memory. Method: one-line-per-statement atomic bash writes (mid-stream degradation made large multi-line payload writes unreliable; ~15 degraded attempts stopped per §33/§34 before switching mechanisms).
- Result: 9 tables (users, sessions, confessions, comments, reactions, reports, moderation_actions, notifications) + 6 indexes. Older spec tables (bookmarks, polls, poll_options, poll_votes, audit_logs, site_settings) intentionally OMITTED — zero code references; add when a feature needs them.
- Cross-checked: every application query maps to a schema object; FK ordering valid; idempotent DDL; no secrets.
- The corrupted original also contained an injected junk text fragment (treated as untrusted, ignored).

## Wave: Neon migration + full E2E green (2026-09-22)
- DB switched from local PostgreSQL to NEON Postgres per user decision (Voroa free DB capacity blocked — deployment via Voroa abandoned). Neon project `broad-tree-72190477` (VEIL, ap-southeast-1, PG 18.6).
- Schema applied to Neon via Neon MCP transaction (13 statements, idempotent) — verified live: 7 tables, 12 indexes, 43 columns. db/schema.sql is the source of truth (NOT rewritten).
- `DATABASE_URL` in `.env.local` (gitignored) = Neon POOLED connection string. Credentials never printed/committed. NOTE: credentials were shared in chat by the user — recommend rotating the Neon password later.
- De-Voroa'd: db.ts error message now generic; AGENTS.md stack line updated to Neon. Voroa VEIL project + old proposal left in place (unused, no config committed).
- Local dev tooling: scripts/dev-db.mjs (embedded PG 17, kept for offline dev), scripts/db-verify.mjs, scripts/seed-e2e.mjs.
- Playwright: channel "chrome" (system Chrome; CDN download blocked), workers 1 (this machine OOMs with parallel browsers), E2E_SKIP_RATE_LIMIT=1 env-gated bypass in webServer.
- **E2E: 32/32 PASSED against Neon** (desktop + mobile). App bugs found and fixed by E2E: navbar stale after register/login (window.location.assign fix), archive missing 401 redirect (router was undefined — import added), detail API r.counts SQL bug (jsonb_object_agg level restored), reaction buttons had no accessible names (aria-labels added), 💀 skull reaction added.
- Verified: tsc CLEAN, vitest 33/33, build CLEAN (30 routes).
- Voroa deployment: NO LONGER the plan — replaced by Neon.

## Wave: Public sharing + comments removal + hardening (2026-09-21)
- COMMENTS REMOVED per spec (user decision): comments table + FKs dropped from schema BEFORE first DB apply (DB not created yet — no destructive migration); comment UI (comments-section.tsx deleted, moderation comments tab, activity comments tab), comment APIs (2 route dirs deleted), comment stats/notifications types removed. createReport is confession-only now.
- PUBLIC SHARING: ShareButton component (Web Share API + clipboard fallback with execCommand for non-secure contexts, subtle "Copied" state) on approved posts.
- ROUTE RENAME: /confession/[id] → /post/[id] (public page route); all internal links updated (feed, notification-bell, moderation-queue, e2e specs). API paths (/api/confessions) kept — internal, rename deferred.
- DETAIL API NOW PUBLIC for APPROVED posts (was 401 for logged-out); PENDING/REJECTED still 404 for non-author/staff; UUID regex validation before DB hit; targeted PK-indexed reaction aggregate (was full-table scan).
- Reports now require APPROVED target (security audit finding LOW-1 fixed).
- HARD-RULE FIX: "Amrita AP Confessions" removed from layout metadata/footer, about/rules/privacy/admin/moderation pages, navbar (was a hard-rule violation missed by the previous session).
- Verified: tsc CLEAN, vitest 33/33 (3 comment tests removed), build CLEAN (29 routes, /post/[id] present).
- Independent security audit (security-auditor): NO critical/high. PASS on all areas. Noted: MEDIUM-1 X-Forwarded-For spoofing (verify Voroa proxy overwrites it in prod), MEDIUM-2 Turnstile off when secret unset (documented ceiling — set key in prod).
- E2E: NOT RUN (blocked on DATABASE_URL — Voroa DB proposal vFz4FfQk0M7fM4MAXE-OOx6wGVPZYPoJcKic_MjHs9U awaiting dashboard approval).



## Stack Decision
- Next.js 16.3.5 (App Router, React 19, Turbopack) — one deployable
- **Neon Postgres** (project `broad-tree-72190477`, PG 18.6) — replaced Voroa (free capacity blocked); schema in db/schema.sql
- Tailwind CSS v4 + shadcn/ui (base-nova preset, Base UI primitives)
- Custom auth: bcryptjs + DB-backed httpOnly session cookies
- Vitest (33 unit tests) + Playwright E2E (32 tests, all passing against Neon)
- Hosting target: TBD (Neon DB ready; Voroa web service optional); Turnstile optional (env-gated)

## Completed Tasks
- [x] Phase 0: git init + remote + state files + timeout-check tooling (`.opencode/timeout-check.mjs`)
- [x] Phase 1a: Next.js 16 scaffold (scaffoldtmp -> moved into root), bcryptjs+pg+@types/pg, shadcn init -d (base-nova), 15 UI components
- [x] Phase 1b: `db/schema.sql` written (14 tables, idempotent). DB creation pending approval.
- [x] Phase 2: Auth (src/lib/auth.ts, db.ts, 4 auth routes, bootstrap-admin.mjs, vitest) — 13/13 tests
- [x] Phase 3: Confessions API + feed/detail/login/register pages — keyset pagination, myReactions
- [x] Phase 4: Comments/reactions/reports APIs + UI (optimistic reactions, report dialog) — 24/24 tests
- [x] Phase 5: Moderation/admin APIs + pages (queue tabs, stats, role management, notification bell) — 36/36 tests; toFeedItem deduped
- [x] Phase 6: /popular, /archive (date-grouped), /activity, /about|rules|privacy + confession-list.tsx shared helper
- [x] Phase 7: Turnstile gate (src/lib/turnstile.ts + widget on login/register, env-gated), race-safe moderation (`WHERE status='PENDING' RETURNING`), transactional side-effects (db.ts transaction()), avatarEmoji field-name fix, rate limits (login 10/15min per IP, register 5/h per IP, reactions 30/h per user)
- [x] Phase 8: Playwright E2E suite (5 specs, 32 tests), vitest.config.ts scoping, test:e2e script
- [x] Phase 9: Security audit (independent, security-auditor) — SHIP for V1, no critical/high. Remediated: M1 (login/register rate limits), M2 (reaction quota), M3 (notifications UUID validation + cap 100), L1 (dbError no longer echoes err.message — generic 500 + console.error), L3 (security headers in next.config.ts), L4 (moderation fully transactional). Skipped (LOW/INFO accepted): L2 avatar emoji whitelist (no XSS possible), L5 __Host- prefix, L6 ops script argv password.
- [x] Phase 9 visual pass: Base UI nativeButton a11y bug fixed (8 render-prop Buttons), emoji picker aria-labels, nickname maxLength 30. DOM/a11y inspection verified /login + /register structure. **Screenshot visual inspection NOT possible with current model (no image input) — flagged for a vision-capable pass.**

## Verification Status
- `npx tsc --noEmit`: CLEAN (re-run after schema recovery, 2026-09-21)
- `npm test`: 36/36 (3 files) (re-run after schema recovery, 2026-09-21)
- `npm run build`: CLEAN (30 routes, DATABASE_URL unset) (re-run after schema recovery, 2026-09-21)
- db/schema.sql: reconstructed + full read-back verified (no truncation/duplication/malformed SQL)
- `npx playwright test --list`: 32 tests, 5 files, 2 projects
- `npm audit`: 0 vulnerabilities
- Browser: no console errors on /login, /register (except expected 401s from logged-out /api/auth/me probe)
- NOT verified: live DB flows (register→me→logout cycle), feed with real data, E2E run, feed visual inspection — ALL need DATABASE_URL

## Failed Tasks
- E2E-engineer subagent failed twice (aborted, then empty report) — E2E suite written by orchestrator instead, verified green.

## Known Issues
- Graphify graph current (568 nodes, 1206 edges, graphify-out/). Update with `graphify update .` after major changes. tree_sitter_sql missing (schema.sql not indexed) — optional: `pip install "graphifyy[sql]"`.
- Timeout model checks: `node .opencode/timeout-check.mjs` (verified passing).
- Home dir `C:/Users/Revanth` is itself a git repo (harmless; Next build warns about ignoring its package-lock.json).
- AGENTS.md was overwritten by `next build` agent-file generation once — restored with nextjs-agent-rules block preserved; commit it to keep tree clean.

## Deployment Status
- Not started. BLOCKED on: Voroa DB approval (proposal above), then DATABASE_URL env var.

## Last Successful Checkpoint
- Phase 9 complete (security audit + remediation, all checks green).

## Remaining Work
1. **USER: approve Voroa DB proposal in dashboard** (Settings → API tokens) — proposal `yBnMsOJcTDO2GLEYXQLtbh4mLCVHFLPLkmaAf1Dgdpc`
2. Get connection string (Voroa MCP `get_connection_string`), set DATABASE_URL locally, apply db/schema.sql, run live smoke test + E2E + feed visual check
3. Create Voroa web service (propose), set env vars (DATABASE_URL, TURNSTILE keys when ready), deploy
4. Verify live (health check, register/login smoke), push to GitHub
