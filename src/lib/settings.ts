import { query, transaction } from "./db";

export const SETTING_KEYS = [
  "maintenance_mode",
  "registration_enabled",
  "announcement",
] as const;

export type SettingKey = (typeof SETTING_KEYS)[number];

export type SiteSettings = {
  maintenance_mode: boolean;
  registration_enabled: boolean;
  announcement: string | null;
};

export type PublicSettings = {
  announcement: string | null;
  maintenanceMode: boolean;
};

export type AuditLogEntry = {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
  actorNickname: string | null;
};

export const ANNOUNCEMENT_MAX_LENGTH = 500;

const DEFAULTS: SiteSettings = {
  maintenance_mode: false,
  registration_enabled: true,
  announcement: null,
};

function isSettingKey(key: string): key is SettingKey {
  return (SETTING_KEYS as readonly string[]).includes(key);
}

/** Returns the normalized value for a whitelisted key, or null when the key or value is invalid. */
export function validateSetting(
  key: unknown,
  value: unknown,
): { ok: true; key: SettingKey; value: string | boolean } | { ok: false } {
  if (typeof key !== "string" || !isSettingKey(key)) return { ok: false };
  if (key === "announcement") {
    if (typeof value !== "string") return { ok: false };
    const trimmed = value.trim();
    if (trimmed.length > ANNOUNCEMENT_MAX_LENGTH) return { ok: false };
    return { ok: true, key, value: trimmed };
  }
  if (typeof value !== "boolean") return { ok: false };
  return { ok: true, key, value };
}

type SettingRow = { key: string; value: unknown };

function fromRows(rows: SettingRow[]): SiteSettings {
  const settings: SiteSettings = { ...DEFAULTS };
  for (const row of rows) {
    if (!isSettingKey(row.key)) continue;
    // rows are only written through validateSetting; malformed rows keep defaults
    if (row.key === "announcement") {
      settings.announcement =
        typeof row.value === "string" && row.value.length > 0 ? row.value : null;
    } else if (typeof row.value === "boolean") {
      settings[row.key] = row.value;
    }
  }
  return settings;
}

export async function getSettings(): Promise<SiteSettings> {
  const { rows } = await query<SettingRow>("SELECT key, value FROM site_settings");
  return fromRows(rows);
}

export async function getPublicSettings(): Promise<PublicSettings> {
  const settings = await getSettings();
  return { announcement: settings.announcement, maintenanceMode: settings.maintenance_mode };
}

export async function setSetting(
  key: SettingKey,
  value: string | boolean,
  adminId: string,
): Promise<string | boolean> {
  return transaction(async (tx) => {
    const prev = await tx.query("SELECT value FROM site_settings WHERE key = $1", [key]);
    const previous = (prev.rows[0] as { value: unknown } | undefined)?.value ?? null;
    await tx.query(
      `INSERT INTO site_settings (key, value, updated_by) VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = now(), updated_by = $3`,
      [key, JSON.stringify(value), adminId],
    );
    await tx.query(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id, meta)
       VALUES ($1, 'SETTING_CHANGED', 'setting', $2, $3::jsonb)`,
      [adminId, key, JSON.stringify({ from: previous, to: value })],
    );
    return value;
  });
}

type AuditLogRow = {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  meta: Record<string, unknown> | null;
  created_at: string | Date;
  nickname: string | null;
};

export async function listAuditLogs(limit = 50): Promise<AuditLogEntry[]> {
  const { rows } = await query<AuditLogRow>(
    `SELECT a.id, a.action, a.target_type, a.target_id, a.meta, a.created_at, u.nickname
     FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
     ORDER BY a.created_at DESC LIMIT $1`,
    [limit],
  );
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    meta: row.meta ?? null,
    createdAt: new Date(row.created_at).toISOString(),
    actorNickname: row.nickname,
  }));
}
