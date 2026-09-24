# Verification Checklist — VEIL

Status legend: [ ] pending  [x] pass  [f] fail  [~] partial

## FINAL PRODUCTION READINESS (2026-09-24) — checkpoint c824dc9
- [x] Git: tree clean, HEAD = origin/main = c824dc9, no secrets tracked
- [x] Application: tsc CLEAN, vitest 33/33, build CLEAN (48 routes), zero TODO/stub remnants, zero comment remnants
- [x] Render: latest deploy (c824dc9) LIVE via autoDeploy
- [x] Production smoke (live URL): health 200/Neon ok · feed(anon) 401 · register 201 · create 202 · detail(own pending) 200 · bookmark(pending) 404 (APPROVED-only) · search/random/today/polls 200 · announcements 200
- [x] Security: all audits green (H1/M1/L1/L4 fixed); restriction enforced in validateSession + login; Turnstile fail-closed; RBAC verified via E2E
- [x] Database: Neon PG 18.6, 12 tables live, schema matches queries, indexes present
- [~] Visual/aesthetic UI review: NOT PERFORMED (no vision-capable model on this system) — screenshots at .playwright-mcp/shot-login-*.png for user review; all MEASURABLE criteria pass (contrast 4.7-19.8:1, no overflow, touch targets ≥28px, light/dark functional, console clean)
- [~] External: Voroa provisioning broken (needs Voroa support); Neon password rotation recommended; Turnstile keys unset (disabled)

## Security Hardening (2026-09-22)
- [x] Turnstile fail-closed/clear: both keys → verify; neither → disabled; partial → fail closed + clear log (independent review: PASS)
- [x] Siteverify fetch: AbortSignal.timeout(5000) + try/catch fail-closed (no hang path, no exception leak)
- [x] Session hygiene: expired-session purge on register/login (bounded growth, active sessions unaffected)
- [x] tsc CLEAN, vitest 33/33, build CLEAN (31 routes), auth E2E 10/10 against Neon
- [x] No regressions (cookie options, rate limits, auth flow unchanged)

## Deployment Readiness (2026-09-22)
- [x] Production build: CLEAN (31 routes, next build → next start)
- [x] Env vars: .env.example complete (DATABASE_URL, TURNSTILE pair); no secrets tracked
- [x] DATABASE_URL handling: lazy pool, tuned (max 10, idle 30s, connect-timeout 10s), no leaks
- [x] Turnstile: env-gated, fail-closed when secret set; ops note — set both keys or neither
- [x] Secure cookies: secure in production, httpOnly, SameSite=Lax, 30d expiry
- [x] Production error handling: generic 500s, no DB error leakage (all 17 routes verified)
- [x] Security headers: nosniff, DENY, referrer-policy, HSTS (no preload — correct pre-domain)
- [x] Health: GET /api/health (200 ok / 503 degraded) — host health check target
- [x] Cold start: safe (lazy DB, no DB needed at build; runtime 500s not boot crashes)
- [x] Node runtime: engines >=20; no Windows-only prod deps
- [x] Independent reviews: devops-engineer READY WITH FIXES (applied), code-reviewer PASS (XFF fixed)
- [~] Actual deployment: NOT DONE (awaiting user go-ahead)
- Note: security-auditor agent unavailable (model EOL) — code-reviewer used instead

## Neon Migration + E2E (2026-09-22)
- [x] Schema applied to Neon (7 tables, 12 indexes, 43 columns) — verified via live metadata queries
- [x] App connects to Neon (pooled URL, sslmode=require)
- [x] npx tsc --noEmit: CLEAN
- [x] npm test: 33/33
- [x] npm run build: CLEAN (30 routes)
- [x] Playwright E2E: 32/32 PASSED against Neon (desktop + mobile, 1 worker)
- [x] App bugs found+fixed by E2E: navbar stale auth after register/login, archive 401 redirect (router import), detail API r.counts SQL, reaction button aria-labels, 💀 reaction
- [~] Live production deployment: pending (hosting TBD — Neon DB ready)
- [~] Screenshot visual inspection: NOT PERFORMED (no image input this session)
- [x] No secrets committed (.env.local gitignored; credentials shared in chat by user — rotate recommended)

## Schema Recovery (2026-09-21)
- [x] db/schema.sql reconstructed from verified code contract (9 tables + 6 indexes)
- [x] Full read-back: no truncation, no duplicated sections, no malformed SQL
- [x] Every application query maps to a schema object (cross-checked src/lib + API routes)
- [x] Idempotent DDL, no secrets, no destructive operations
- [~] Live PostgreSQL execution NOT performed (no local PG server; production Voroa DB must not be used as a test environment)
- Security review: Phase 9 independent audit (security-auditor) stands — zero application-code delta this session; only db/schema.sql was reconstructed and it was cross-checked against the code contract.

## Public Sharing (2026-09-21)
- [x] Approved post → public URL /post/[id] → 200 without auth (server-side enforced)
- [x] Pending/rejected post → 404 for non-author/staff (no existence oracle)
- [x] UUID validation before DB hit; malformed IDs → 404
- [x] Share/Copy Link: Web Share API + clipboard fallback + "Copied" state
- [x] No identity leakage (nickname/avatar only; identityless posts reveal nothing)
- [x] Comments fully removed (UI, APIs, schema, notifications, tests)
- [~] Browser/E2E run: NOT RUN (needs DATABASE_URL)
- [~] Screenshot visual inspection: NOT PERFORMED (no image input this session)

## Authentication
- [ ] Registration works (no email required)
- [ ] Username never displayed publicly
- [ ] Login works / logout works
- [ ] Invalid credentials rejected
- [ ] Session persists across requests
- [ ] Protected endpoints reject unauthenticated requests
- [ ] Passwords hashed (bcrypt), never plaintext
- [ ] Login brute-force lockout works
- [ ] Account enumeration resisted (login error messages uniform)

## Confessions
- [ ] Create → PENDING status
- [ ] Public feed shows only APPROVED
- [ ] Moderator approve → appears publicly with ORIGINAL submission timestamp
- [ ] Reject works; author sees status
- [ ] Chronological feed newest-first
- [ ] Date archive by day, ordered by time
- [ ] Search works
- [ ] Shareable URL per confession
- [ ] My Confessions shows own items + status
- [ ] User cannot edit/delete own confession

## Comments
- [ ] Create / reply / nested replies
- [ ] Uses public nickname
- [ ] Reactions on comments
- [ ] Report comment
- [ ] Moderation of comments
- [ ] Comment locking works

## Reactions
- [ ] Add/remove/change reaction
- [ ] One reaction per type per user per target (dup prevented)
- [ ] Rate limited

## Reports
- [ ] Create report (confession + comment)
- [ ] Moderator review → resolve/dismiss
- [ ] Many reports do NOT auto-delete content
- [ ] Admin can see reports

## Roles
- [ ] USER cannot access moderator endpoints
- [ ] MODERATOR cannot access admin-only endpoints
- [ ] ADMIN can access admin functionality
- [ ] No self-promotion to admin/moderator
- [ ] Admin bootstrap via server-side mechanism only

## Anti-abuse
- [ ] Turnstile server-side validation active when configured
- [ ] Rapid registrations throttled
- [ ] Rapid login attempts throttled
- [ ] Rapid confession submissions cooled down
- [ ] Rapid comments/reactions/reports throttled
- [ ] Unauthorized API calls rejected

## UI
- [ ] Mobile layout correct
- [ ] Desktop layout correct
- [ ] Dark mode + light mode
- [ ] Navigation, forms, loading skeletons, error states, empty states
- [ ] Moderation interface usable

## Security Audit
- [ ] SQL injection (parameterized queries) verified
- [ ] XSS (no dangerouslySetInnerHTML of user content) verified
- [ ] IDOR on activity/activity APIs verified
- [ ] Nickname cannot retrieve private username
- [ ] Public APIs expose no private metadata
- [ ] Security headers set
- [ ] No secrets committed

## Deployment
- [ ] Production build passes
- [ ] Deployed to Voroa
- [ ] Migrations applied to production DB
- [ ] Live URL responds
- [ ] Health endpoint OK
- [ ] Browser console clean on live site
- [ ] GitHub push verified (commit exists remotely)
