import { query, transaction } from "./db";
import type { PublicUser, Role } from "./auth";
import { toFeedItem, type ConfessionItem, type ConfessionRow, type ReactionCounts } from "./confessions";

export type ModerationAction = "APPROVED" | "REJECTED";
export type ModerationStatusAction = "HIDDEN" | "RESTORED";
export type AnyModerationAction = ModerationAction | ModerationStatusAction;
export type ReportAction = "RESOLVED" | "DISMISSED";

// ponytail: hide/restore reuse status='REJECTED' + this sentinel instead of a schema
// migration (HIDDEN status); add hidden_at column if hidden-vs-rejected analytics matter
export const HIDDEN_SENTINEL = "Hidden by moderation";

export type PendingConfessionItem = ConfessionItem & {
  status: "PENDING";
};

export type ModeratedConfessionItem = ConfessionItem & {
  status: "APPROVED" | "REJECTED";
  rejectionReason: string | null;
};

export type OpenReportItem = {
  id: string;
  reason: string;
  createdAt: string;
  confessionId: string | null;
  confessionStatus: string | null;
  confessionExcerpt: string | null;
  authorId: string | null;
};

export type AdminUserItem = {
  id: string;
  nickname: string;
  avatarEmoji: string;
  role: Role;
  createdAt: string;
  restrictedUntil: string | null;
};

export type AdminStats = {
  users: number;
  confessions: { total: number; pending: number; approved: number; rejected: number };
  openReports: number;
};

export type NotificationItem = {
  id: string;
  type: string;
  confessionId: string | null;
  read: boolean;
  createdAt: string;
};

export const MODERATION_ROLES: ReadonlySet<string> = new Set(["MODERATOR", "ADMIN"]);
export const ADMIN_ROLES: ReadonlySet<string> = new Set(["ADMIN"]);
export const VALID_ROLES: ReadonlySet<string> = new Set(["USER", "MODERATOR", "ADMIN"]);

export function isStaff(user: PublicUser | null): user is PublicUser {
  return user !== null && MODERATION_ROLES.has(user.role);
}

export function isAdmin(user: PublicUser | null): user is PublicUser {
  return user !== null && user.role === "ADMIN";
}

export function validateModerationAction(action: unknown): action is AnyModerationAction {
  return (
    action === "APPROVED" ||
    action === "REJECTED" ||
    action === "HIDDEN" ||
    action === "RESTORED"
  );
}

export function validateRestrictionDays(days: unknown): days is number | null {
  if (days === null) return true;
  return typeof days === "number" && Number.isInteger(days) && days >= 1 && days <= 30;
}

export function validateReportAction(action: unknown): action is ReportAction {
  return action === "RESOLVED" || action === "DISMISSED";
}

export function validateRejectionReason(reason: unknown): string | null {
  if (typeof reason !== "string") return "Reason must be 1-500 characters.";
  const trimmed = reason.trim();
  if (trimmed.length < 1 || trimmed.length > 500) return "Reason must be 1-500 characters.";
  return null;
}

export function validateRoleValue(role: unknown): role is Role {
  return typeof role === "string" && VALID_ROLES.has(role);
}

export function toExcerpt(content: string | null | undefined): string | null {
  if (typeof content !== "string" || content.length === 0) return null;
  return content.slice(0, 140);
}

function toPendingFeedItem(row: ConfessionRow): PendingConfessionItem {
  return { ...toFeedItem(row), status: "PENDING" };
}

type OpenReportRow = {
  id: string;
  reason: string;
  created_at: string;
  confession_id: string | null;
  confession_status: string | null;
  confession_content: string | null;
  author_id: string | null;
};

type AdminUserRow = {
  id: string;
  nickname: string;
  avatar_emoji: string;
  role: Role;
  created_at: string;
  restricted_until: string | null;
};

type NotificationRow = {
  id: string;
  type: string;
  confession_id: string | null;
  read: boolean;
  created_at: string;
};

const PENDING_REACTION_AGG = `LEFT JOIN (
      SELECT confession_id, jsonb_object_agg(emoji, cnt) AS counts
      FROM (SELECT confession_id, emoji, COUNT(*)::int AS cnt FROM reactions GROUP BY confession_id, emoji) s
      GROUP BY confession_id
    ) r ON r.confession_id = c.id`;

export async function listPendingConfessions(
  userId: string | null,
): Promise<PendingConfessionItem[]> {
  let mineJoin = "";
  let mineSelect = "'[]'::jsonb AS my_reactions";
  const params: unknown[] = [];
  if (userId !== null) {
    params.push(userId);
    mineJoin = `LEFT JOIN (SELECT confession_id, jsonb_agg(emoji) AS emojis FROM reactions WHERE user_id = $${params.length} GROUP BY confession_id) mr ON mr.confession_id = c.id`;
    mineSelect = "COALESCE(mr.emojis, '[]'::jsonb) AS my_reactions";
  }
  const { rows } = await query<ConfessionRow>(
    `SELECT c.id, c.title, c.content, c.created_at, u.nickname, u.avatar_emoji,
            COALESCE(r.counts, '{}'::jsonb) AS reaction_counts, ${mineSelect}
     FROM confessions c
     JOIN users u ON u.id = c.author_id
     ${PENDING_REACTION_AGG}
     ${mineJoin}
     WHERE c.status = 'PENDING'
     ORDER BY c.created_at DESC`,
    params,
  );
  return rows.map(toPendingFeedItem);
}

export async function listModeratedConfessions(
  userId: string | null,
): Promise<ModeratedConfessionItem[]> {
  let mineJoin = "";
  let mineSelect = "'[]'::jsonb AS my_reactions";
  const params: unknown[] = [];
  if (userId !== null) {
    params.push(userId);
    mineJoin = `LEFT JOIN (SELECT confession_id, jsonb_agg(emoji) AS emojis FROM reactions WHERE user_id = $${params.length} GROUP BY confession_id) mr ON mr.confession_id = c.id`;
    mineSelect = "COALESCE(mr.emojis, '[]'::jsonb) AS my_reactions";
  }
  const { rows } = await query<ConfessionRow>(
    `SELECT c.id, c.title, c.content, c.status, c.rejection_reason, c.created_at, u.nickname, u.avatar_emoji,
            COALESCE(r.counts, '{}'::jsonb) AS reaction_counts, ${mineSelect}
     FROM confessions c
     JOIN users u ON u.id = c.author_id
     ${PENDING_REACTION_AGG}
     ${mineJoin}
     WHERE c.status IN ('APPROVED', 'REJECTED')
     ORDER BY c.created_at DESC`,
    params,
  );
  return rows.map((row) => ({
    ...toFeedItem(row),
    status: row.status === "REJECTED" ? ("REJECTED" as const) : ("APPROVED" as const),
    rejectionReason: row.rejection_reason,
  }));
}

export async function listOpenReports(): Promise<OpenReportItem[]> {
  const { rows } = await query<OpenReportRow>(
    `SELECT r.id, r.reason, r.created_at, r.confession_id,
            cf.status AS confession_status, cf.content AS confession_content, cf.author_id AS author_id
     FROM reports r
     LEFT JOIN confessions cf ON cf.id = r.confession_id
     WHERE r.status = 'OPEN'
     ORDER BY r.created_at DESC`,
  );
  return rows.map((row) => ({
    id: row.id,
    reason: row.reason,
    createdAt: new Date(row.created_at).toISOString(),
    confessionId: row.confession_id,
    confessionStatus: row.confession_status,
    confessionExcerpt: toExcerpt(row.confession_content),
    authorId: row.author_id,
  }));
}

type ModerationTarget = { id: string; status: string; author_id: string } | undefined;

export async function moderateConfession(
  id: string,
  moderatorId: string,
  action: ModerationAction,
  reason: string | null,
): Promise<{ ok: true } | { missing: true } | { conflict: true }> {
  const rejectionReason = action === "REJECTED" ? reason : null;
  const result = await transaction(async (tx) => {
    const { rows } = await tx.query(
      `UPDATE confessions SET status = $1, approved_at = now(), approved_by = $2, rejection_reason = $3
       WHERE id = $4 AND status = 'PENDING'
       RETURNING author_id`,
      [action, moderatorId, rejectionReason, id],
    );
    const target = rows[0] as { author_id: string } | undefined;
    if (!target) return null;
    await tx.query(
      `INSERT INTO moderation_actions (moderator_id, action, target_type, target_id, reason) VALUES ($1, $2, 'confession', $3, $4)`,
      [moderatorId, action, id, reason],
    );
    await tx.query(`INSERT INTO notifications (user_id, type, confession_id) VALUES ($1, $2, $3)`, [
      target.author_id,
      action === "APPROVED" ? "confession_approved" : "confession_rejected",
      id,
    ]);
    return { author_id: target.author_id };
  });
  if (!result) {
    const { rows: exists } = await query(`SELECT 1 FROM confessions WHERE id = $1`, [id]);
    return exists.length > 0 ? { conflict: true } : { missing: true };
  }
  return { ok: true };
}

// Hide an APPROVED post: reversible, distinct from rejection. Status stays the
// lifecycle source of truth; the HIDDEN_SENTINEL reason marks it as hidden.
// Writes audit_logs (not moderation_actions — its CHECK only allows APPROVED/REJECTED).
export async function hideConfession(
  id: string,
  staffId: string,
): Promise<{ ok: true } | { missing: true } | { conflict: true }> {
  const result = await transaction(async (tx) => {
    const { rows } = await tx.query(
      `UPDATE confessions SET status = 'REJECTED', rejection_reason = $1, approved_at = NULL, approved_by = NULL
       WHERE id = $2 AND status = 'APPROVED'
       RETURNING author_id`,
      [HIDDEN_SENTINEL, id],
    );
    const target = rows[0] as { author_id: string } | undefined;
    if (!target) return null;
    await tx.query(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id, meta) VALUES ($1, 'POST_HIDDEN', 'confession', $2, $3::jsonb)`,
      [staffId, id, JSON.stringify({ reason: HIDDEN_SENTINEL })],
    );
    await tx.query(`INSERT INTO notifications (user_id, type, confession_id) VALUES ($1, 'post_hidden', $2)`, [
      target.author_id,
      id,
    ]);
    return { author_id: target.author_id };
  });
  if (!result) {
    const { rows: exists } = await query(`SELECT 1 FROM confessions WHERE id = $1`, [id]);
    return exists.length > 0 ? { conflict: true } : { missing: true };
  }
  return { ok: true };
}

// Restore a REJECTED post (hidden or rejected) back to APPROVED.
export async function restoreConfession(
  id: string,
  staffId: string,
): Promise<{ ok: true } | { missing: true } | { conflict: true }> {
  const result = await transaction(async (tx) => {
    const { rows } = await tx.query(
      `UPDATE confessions SET status = 'APPROVED', approved_at = now(), approved_by = $1, rejection_reason = NULL
       WHERE id = $2 AND status = 'REJECTED'
       RETURNING author_id`,
      [staffId, id],
    );
    const target = rows[0] as { author_id: string } | undefined;
    if (!target) return null;
    await tx.query(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id, meta) VALUES ($1, 'POST_RESTORED', 'confession', $2, $3::jsonb)`,
      [staffId, id, JSON.stringify({ reason: null })],
    );
    await tx.query(`INSERT INTO notifications (user_id, type, confession_id) VALUES ($1, 'post_restored', $2)`, [
      target.author_id,
      id,
    ]);
    return { author_id: target.author_id };
  });
  if (!result) {
    const { rows: exists } = await query(`SELECT 1 FROM confessions WHERE id = $1`, [id]);
    return exists.length > 0 ? { conflict: true } : { missing: true };
  }
  return { ok: true };
}

export async function resolveReport(
  id: string,
  moderatorId: string,
  action: ReportAction,
): Promise<{ ok: true } | { missing: true } | { conflict: true }> {
  const { rows } = await query<{ id: string; status: string }>(
    `SELECT id, status FROM reports WHERE id = $1`,
    [id],
  );
  const target = rows[0];
  if (!target) return { missing: true };
  if (target.status !== "OPEN") return { conflict: true };
  await query(`UPDATE reports SET status = $1, resolved_by = $2 WHERE id = $3`, [
    action,
    moderatorId,
    id,
  ]);
  return { ok: true };
}

export async function listAdminUsers(): Promise<AdminUserItem[]> {
  const { rows } = await query<AdminUserRow>(
    `SELECT id, nickname, avatar_emoji, role, created_at, restricted_until FROM users ORDER BY created_at DESC`,
  );
  return rows.map((row) => ({
    id: row.id,
    nickname: row.nickname,
    avatarEmoji: row.avatar_emoji,
    role: row.role,
    createdAt: new Date(row.created_at).toISOString(),
    restrictedUntil: row.restricted_until ? new Date(row.restricted_until).toISOString() : null,
  }));
}

export async function setUserRole(
  userId: string,
  role: Role,
  adminId: string,
): Promise<{ ok: true } | { missing: true }> {
  const { rows } = await query<{ id: string }>(`SELECT id FROM users WHERE id = $1`, [userId]);
  if (!rows[0]) return { missing: true };
  await transaction(async (tx) => {
    await tx.query(`UPDATE users SET role = $1 WHERE id = $2`, [role, userId]);
    await tx.query(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id, meta) VALUES ($1, 'ROLE_CHANGED', 'user', $2, $3::jsonb)`,
      [adminId, userId, JSON.stringify({ role })],
    );
  });
  return { ok: true };
}

// Restriction is enforced at login (and never against staff). Existing sessions
// are not invalidated — ponytail ceiling, purge sessions on restrict if needed.
export async function restrictUser(
  userId: string,
  adminId: string,
  days: number,
): Promise<{ ok: true } | { missing: true } | { forbidden: true }> {
  const result = await transaction(async (tx) => {
    // one-statement staff check + update: no stale-role TOCTOU
    const { rows } = await tx.query(
      `UPDATE users SET restricted_until = now() + make_interval(days => $1) WHERE id = $2 AND role = 'USER' RETURNING id`,
      [days, userId],
    );
    const first = rows[0] as { id: string } | undefined;
    if (!first) return null;
    await tx.query(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id, meta) VALUES ($1, 'USER_RESTRICTED', 'user', $2, $3::jsonb)`,
      [adminId, userId, JSON.stringify({ days })],
    );
    // ponytail: invalidate live sessions so restriction takes effect immediately
    await tx.query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
    return { id: first.id };
  });
  if (result) return { ok: true };
  const { rows: exists } = await query<{ role: string }>(
    `SELECT role FROM users WHERE id = $1`,
    [userId],
  );
  if (!exists[0]) return { missing: true };
  return { forbidden: true };
}

export async function unrestrictUser(
  userId: string,
  adminId: string,
): Promise<{ ok: true } | { missing: true }> {
  const result = await transaction(async (tx) => {
    const { rows } = await tx.query(
      `UPDATE users SET restricted_until = NULL WHERE id = $1 RETURNING id`,
      [userId],
    );
    const first = rows[0] as { id: string } | undefined;
    if (!first) return null;
    await tx.query(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id) VALUES ($1, 'USER_UNRESTRICTED', 'user', $2)`,
      [adminId, userId],
    );
    return { id: first.id };
  });
  return result ? { ok: true } : { missing: true };
}

export async function getAdminStats(): Promise<AdminStats> {
  const [usersRes, confRes, reportsRes] = await Promise.all([
    query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM users`),
    query<{ status: string; count: string }>(
      `SELECT status, COUNT(*)::text AS count FROM confessions GROUP BY status`,
    ),
    query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM reports WHERE status = 'OPEN'`),
  ]);
  const confessionCounts = { total: 0, pending: 0, approved: 0, rejected: 0 };
  for (const row of confRes.rows) {
    const n = Number.parseInt(row.count, 10) || 0;
    confessionCounts.total += n;
    if (row.status === "PENDING") confessionCounts.pending = n;
    else if (row.status === "APPROVED") confessionCounts.approved = n;
    else if (row.status === "REJECTED") confessionCounts.rejected = n;
  }
  return {
    users: Number.parseInt(usersRes.rows[0]?.count ?? "0", 10) || 0,
    confessions: confessionCounts,
    openReports: Number.parseInt(reportsRes.rows[0]?.count ?? "0", 10) || 0,
  };
}

export async function listNotifications(
  userId: string,
): Promise<{ notifications: NotificationItem[]; unread: number }> {
  const [items, unreadRes] = await Promise.all([
    query<NotificationRow>(
      `SELECT id, type, confession_id, read, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [userId],
    ),
    query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM notifications WHERE user_id = $1 AND read = false`,
      [userId],
    ),
  ]);
  return {
    notifications: items.rows.map((row) => ({
      id: row.id,
      type: row.type,
      confessionId: row.confession_id,
      read: row.read,
      createdAt: new Date(row.created_at).toISOString(),
    })),
    unread: Number.parseInt(unreadRes.rows[0]?.count ?? "0", 10) || 0,
  };
}

export async function markNotificationsRead(
  userId: string,
  ids: string[] | null,
): Promise<{ ok: true }> {
  if (ids === null) {
    await query(`UPDATE notifications SET read = true WHERE user_id = $1`, [userId]);
  } else if (ids.length > 0) {
    await query(`UPDATE notifications SET read = true WHERE user_id = $1 AND id = ANY($2)`, [
      userId,
      ids,
    ]);
  }
  return { ok: true };
}
