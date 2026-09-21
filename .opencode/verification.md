# Verification Checklist — VEIL

Status legend: [ ] pending  [x] pass  [f] fail  [~] partial

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
