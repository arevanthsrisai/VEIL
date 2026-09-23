# Project State — VEIL

## Current Phase
RECOVERY + COMPLETION DONE — deployed on Render (commit d439e63 pushed). All spec gaps closed; only cosmetic/Voroa items remain.

## Completion Wave (2026-09-23) — gap analysis + implementation
- Gap analysis vs master prompt: 13 gaps found, ALL CLOSED except noted ceilings.
- Schema migration (additive, idempotent, applied to Neon + verified live — 12 tables now): bookmarks, polls, poll_votes, site_settings, audit_logs + 3 indexes.
- NEW FEATURES (delegated to frontend-engineer agents, integrated + verified):
  - Bookmarks: lib + 3 API routes + BookmarkButton + /activity Saved tab (60/h limit, APPROVED-only, ownership enforced)
  - Discovery: search (q≤100, ILIKE, 60/min/IP) + random + today — lib + 3 API routes + 3 pages + navbar links
  - Polls: admin create/close (admin-only), single-choice vote (PK dup prevention, race-safe vs close), /polls page, PollCard, PollManager in admin panel, audit on close
  - Admin settings: maintenance_mode, registration_enabled, announcement (whitelist, audit with from/to) + /api/announcements public
  - Moderation extension: hide/restore (race-safe, sentinel reason, audit_logs), account restrict/unrestrict (admin-only, never staff), login blocked for restricted users
  - Audit logs: audit_logs table + ROLE_CHANGED/SETTING_CHANGED/POLL_CLOSED/POST_HIDDEN/POST_RESTORED/USER_RESTRICTED entries + admin audit-log viewer
  - Transparency: /terms + /moderation-policy pages + footer links
  - Theme: ThemeProvider + light/dark toggle in navbar (dark was hardcoded before)
- SECURITY FIXES from independent review (code-reviewer): H1 restriction now invalidates sessions + enforced in validateSession (was login-only); M1 registration_enabled + maintenance_mode enforced server-side in register; L1 restrict made transactional (no TOCTOU); L4 role changes now audited with the real actor.
- APP BUGS found+fixed: pg-in-client-bundle (settings-panel value import → local constant); anonymous detail 500 (getConfessionById 2-params-vs-1-placeholder when logged out).
- Verification: tsc CLEAN · vitest 33/33 · build CLEAN (48 routes) · E2E 74 passed/8 skipped (skips = redundant fixme duplicates; those flows pass in admin-flows.spec: 10/10 incl. hide/restore/restrict/settings/poll via bootstrapped e2e_admin) · DOM-verified light/dark/mobile.
- Screenshot visual inspection: NOT performed (this model has no image input) — 3 PNGs captured for USER review at .playwright-mcp/shot-login-{dark-desktop,light-desktop,light-mobile}.png.


## Voroa Provisioning Failure — DEFINITIVE DIAGNOSIS (2026-09-23)
- 3 proposals, all APPROVED by the user on the dashboard, ZERO services ever materialized:
  - pfYbA_-huAiJLTpfV6eiPl77H5zOE5DZBypsnVboYI8 (project VEIL b77fcc6f) — expired before acceptance (first no-op)
  - YvwqQZ3oq3rYTJQK7pF1ZO0lwui04YRaTBwYA31BiEc (project VEIL) — approved while valid, no service after 3.5+ min
  - I0BJdv-p4GSSIg-PHbI2X0mFirOAFrJOWOTcvEZikow (FRESH project veil-app 74b90788) — approved while valid, no service after 2.5+ min
- Fresh-project test isolates the cause: NOT project-specific, NOT proposal expiry — Voroa's provisioning pipeline accepts requests but never executes service creation. No job/deployment record, no error reason exposed by the API.
- Billing is NOT the blocker (free plan inclusions confirmed: 500 build min, 5GB bandwidth; no mandate needed for free services). Direct API probing impossible (all paths 404 — surface hidden behind MCP).
- **Action needed: contact Voroa support** with the 3 proposal IDs + project IDs above (approved-but-unprovisioned evidence). Retrying via re-propose is demonstrated futile.
- Workspace id (user-provided): c5d1b878-d1b7-4202-891b-61c94dc2bdbd.


## Deployment Status (2026-09-22)
- **LIVE**: Render web service `veil` (srv-daovjtlg1s2s738rt1m0), free plan, Oregon, autoDeploy ON (commits to main auto-deploy). Deploy history: d1c6260 build_failed (Tailwind devDeps skipped by NODE_ENV=production), 365ba08 build_failed (@types/node), 704c06a LIVE (platform-optional fix).
- Deploy fixes made: Tailwind build packages moved to dependencies; embedded-postgres → optionalDependencies (EBADPLATFORM on Linux); NODE_ENV=production env var REMOVED from service (redundant — next CLI sets production mode itself; was breaking devDep installs). Service env: DATABASE_URL (Neon pooled) + HOSTNAME=0.0.0.0. Turnstile: neither key set = disabled. E2E_SKIP_RATE_LIMIT never set.
- Production smoke (all PASS): /api/health 200 {ok,database:ok} — Neon connectivity ✓; feed(anon) 401; register 201; create 202; detail(own pending) 200; bad-uuid 404. Browser: anonymous / → /login redirect ✓, VEIL branding ✓, console = only 2 expected 401 probes.
- **Voroa**: project VEIL + Production env exist; create_service proposal pfYbA_-huAiJLTpfV6eiPl77H5zOE5DZBypsnVboYI8 accepted per user on dashboard, but NO service visible via API afterwards — blocker reported; user to verify in dashboard. If Voroa service materializes: set DATABASE_URL via Voroa env vars, verify health/smoke, then decide Render vs Voroa as primary.


## Deployment Readiness (2026-09-22)
- Architecture: Next.js 16 (next build → next start, Node >=20) + Neon Postgres (pooled URL) + Cloudflare (DNS/Turnstile/edge) — simplest viable path.
- Fixes applied: HSTS header, turbopack.root: __dirname (kills home-dir lockfile warning), pg Pool tuned (max 10, idle 30s, connect-timeout 10s), /api/health route (200 ok / 503 degraded, DB ping), .env.example (placeholders only) + !.env.example gitignore exception, engines node>=20, XFF rightmost-entry fix (clientIp), production guard on E2E_SKIP_RATE_LIMIT bypass.
- Independent reviews (parallel): devops-engineer — READY WITH FIXES (all applied or noted); code-reviewer (security) — PASS, 1 MEDIUM (XFF, fixed) + LOWs noted (Turnstile partial-config footgun: set both keys or neither; sessions grow unbounded — hygiene; no siteverify timeout — minor).
- Host must configure: DATABASE_URL (Neon pooled, sslmode=require), TURNSTILE_SECRET_KEY + NEXT_PUBLIC_TURNSTILE_SITE_KEY as a pair, NODE_ENV=production, PORT/HOSTNAME=0.0.0.0; health check → GET /api/health; apply db/schema.sql to Neon before first boot; NEVER set E2E_SKIP_RATE_LIMIT in prod.
- Verified: tsc CLEAN, vitest 33/33, build CLEAN (31 routes incl /api/health). E2E 32/32 against Neon (previous wave).
- Note: security-auditor agent is UNAVAILABLE (its model DeepSeek V4 Flash EOL 2026-09-21) — security reviews now via code-reviewer.


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
