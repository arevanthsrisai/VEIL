import { query, transaction } from "./db";
import { hashPassword, type Role } from "./auth";

export type AdminUserItem = {
  id: string;
  // username is private — this type only ever flows out of admin-gated routes
  username: string;
  nickname: string;
  avatarEmoji: string;
  role: Role;
  createdAt: string;
  restrictedUntil: string | null;
  mustChangePassword: boolean;
  postCount: number;
};

type AdminUserRow = {
  id: string;
  username: string;
  nickname: string;
  avatar_emoji: string;
  role: Role;
  created_at: string;
  restricted_until: string | null;
  must_change_password: boolean;
  post_count: string;
};

export async function listUsers(search?: string, limit = 50): Promise<AdminUserItem[]> {
  const params: unknown[] = [];
  let where = "";
  const term = search?.trim();
  if (term) {
    // escape LIKE wildcards so the term matches literally (parameterized, backslash escape)
    params.push(`%${term.replace(/[\\%_]/g, "\\$&")}%`);
    where = `WHERE u.nickname ILIKE $1 OR u.username ILIKE $1`;
  }
  params.push(limit);
  const { rows } = await query<AdminUserRow>(
    `SELECT u.id, u.username, u.nickname, u.avatar_emoji, u.role, u.created_at,
            u.restricted_until, u.must_change_password, COUNT(c.id)::text AS post_count
     FROM users u
     LEFT JOIN confessions c ON c.author_id = u.id
     ${where}
     GROUP BY u.id
     ORDER BY u.created_at DESC
     LIMIT $${params.length}`,
    params,
  );
  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    nickname: row.nickname,
    avatarEmoji: row.avatar_emoji,
    role: row.role,
    createdAt: new Date(row.created_at).toISOString(),
    restrictedUntil: row.restricted_until ? new Date(row.restricted_until).toISOString() : null,
    mustChangePassword: row.must_change_password,
    postCount: Number.parseInt(row.post_count, 10) || 0,
  }));
}

export async function adminResetPassword(
  userId: string,
  adminId: string,
  tempPassword: string,
): Promise<{ ok: true } | { missing: true }> {
  // bcrypt outside the transaction — don't hold the connection while hashing
  const passwordHash = await hashPassword(tempPassword);
  const result = await transaction(async (tx) => {
    const { rows } = await tx.query(`SELECT id FROM users WHERE id = $1`, [userId]);
    if ((rows[0] as { id: string } | undefined) === undefined) return null;
    await tx.query(
      `UPDATE users SET password_hash = $1, must_change_password = true WHERE id = $2`,
      [passwordHash, userId],
    );
    // force re-login: every live session dies
    await tx.query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
    await tx.query(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id, meta) VALUES ($1, 'PASSWORD_RESET', 'user', $2, $3::jsonb)`,
      [adminId, userId, JSON.stringify({ forced: true })],
    );
    return { ok: true } as const;
  });
  return result ?? { missing: true };
}

export async function removeUser(
  userId: string,
  adminId: string,
): Promise<{ ok: true } | { missing: true } | { forbidden: true }> {
  const result = await transaction(async (tx) => {
    const { rows } = await tx.query(`SELECT id, nickname, role FROM users WHERE id = $1`, [userId]);
    const target = rows[0] as { id: string; nickname: string; role: string } | undefined;
    if (!target) return null;
    if (target.role !== "USER") return { staff: true } as const;
    // audit BEFORE the delete — actor_id references the admin, so this row survives the cascade
    await tx.query(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id, meta) VALUES ($1, 'ACCOUNT_REMOVED', 'user', $2, $3::jsonb)`,
      [adminId, userId, JSON.stringify({ nickname: target.nickname })],
    );
    // ponytail: the target's self-authored audit rows (e.g. self password changes)
    // are deleted to satisfy audit_logs.actor_id (NOT NULL, no cascade) — migrate
    // actor_id to ON DELETE SET NULL if full self-audit retention matters.
    // Demoted-moderator remnants (moderation_actions.moderator_id,
    // confessions.approved_by) still block the delete — the route maps that FK
    // error to 409.
    await tx.query(`DELETE FROM audit_logs WHERE actor_id = $1`, [userId]);
    await tx.query(`DELETE FROM users WHERE id = $1 AND role = 'USER'`, [userId]);
    return { ok: true } as const;
  });
  if (result === null) return { missing: true };
  if ("staff" in result) return { forbidden: true };
  return { ok: true };
}
