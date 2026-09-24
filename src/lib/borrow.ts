import { query, transaction } from "./db";
import type { PublicUser } from "./auth";

export const BORROW_CATEGORIES = [
  "calculator",
  "laptop",
  "charger",
  "books",
  "lab equipment",
  "stationery",
  "other",
] as const;
export type BorrowCategory = (typeof BORROW_CATEGORIES)[number];

export type BorrowStatus = "AVAILABLE" | "BORROWED" | "RETURNED" | "CLOSED";

export type BorrowItem = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: BorrowStatus;
  createdAt: string;
  updatedAt: string;
  isMine: boolean;
  nickname: string;
  avatarEmoji: string;
};

type BorrowRow = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: BorrowStatus;
  created_at: string;
  updated_at: string;
  owner_id: string;
  nickname: string;
  avatar_emoji: string;
};

export function validateBorrowTitle(title: unknown): string | null {
  if (typeof title !== "string") return "Title must be 1-120 characters.";
  const t = title.trim();
  if (t.length < 1 || t.length > 120) return "Title must be 1-120 characters.";
  return null;
}

export function validateBorrowDescription(description: unknown): string | null {
  if (description === undefined || description === null) return null;
  if (typeof description !== "string" || description.trim().length > 2000)
    return "Description must be at most 2000 characters.";
  return null;
}

export function validateBorrowCategory(category: unknown): string | null {
  if (typeof category !== "string" || !BORROW_CATEGORIES.includes(category as BorrowCategory))
    return "Pick a valid category.";
  return null;
}

export function toBorrowItem(row: BorrowRow, userId: string): BorrowItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    isMine: row.owner_id === userId,
    nickname: row.nickname,
    avatarEmoji: row.avatar_emoji,
  };
}

const ITEM_SELECT = `SELECT b.id, b.title, b.description, b.category, b.status, b.created_at, b.updated_at, b.owner_id,
       u.nickname, u.avatar_emoji
FROM borrow_items b
JOIN users u ON u.id = b.owner_id`;

export async function listItems(
  userId: string,
  category: string | null,
): Promise<BorrowItem[]> {
  const params: unknown[] = [userId];
  let filter = "";
  if (category !== null) {
    params.push(category);
    filter = `AND b.category = $${params.length}`;
  }
  const { rows } = await query<BorrowRow>(
    `${ITEM_SELECT}
     WHERE (b.status = 'AVAILABLE' OR b.owner_id = $1) ${filter}
     ORDER BY b.created_at DESC
     LIMIT 30`,
    params,
  );
  return rows.map((row) => toBorrowItem(row, userId));
}

export async function myItems(userId: string): Promise<BorrowItem[]> {
  const { rows } = await query<BorrowRow>(
    `${ITEM_SELECT}
     WHERE b.owner_id = $1 OR b.borrower_id = $1
     ORDER BY b.updated_at DESC
     LIMIT 30`,
    [userId],
  );
  return rows.map((row) => toBorrowItem(row, userId));
}

export async function createItem(
  ownerId: string,
  title: string,
  description: string | null,
  category: string,
): Promise<{ id: string; status: BorrowStatus }> {
  const { rows } = await query<{ id: string; status: BorrowStatus }>(
    `INSERT INTO borrow_items (owner_id, title, description, category)
     VALUES ($1, $2, $3, $4)
     RETURNING id, status`,
    [ownerId, title, description, category],
  );
  await query(
    `INSERT INTO audit_logs (actor_id, action, target_type, target_id) VALUES ($1, 'ITEM_OFFERED', 'borrow_item', $2)`,
    [ownerId, rows[0].id],
  );
  return rows[0];
}

async function getBorrower(itemId: string): Promise<string | null> {
  const { rows } = await query<{ borrower_id: string | null }>(
    `SELECT borrower_id FROM borrow_items WHERE id = $1`,
    [itemId],
  );
  return rows[0]?.borrower_id ?? null;
}

export async function claimItem(
  itemId: string,
  userId: string,
): Promise<{ ok: true; item: BorrowItem } | { missing: true } | { conflict: true }> {
  const result = await transaction(async (tx) => {
    const { rows } = await tx.query(
      `UPDATE borrow_items SET status = 'BORROWED', borrower_id = $2, updated_at = now()
       WHERE id = $1 AND status = 'AVAILABLE'
       RETURNING id`,
      [itemId, userId],
    );
    const first = rows[0] as { id: string } | undefined;
    if (!first) return null;
    await tx.query(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id, meta) VALUES ($1, 'ITEM_BORROWED', 'borrow_item', $2, $3::jsonb)`,
      [userId, itemId, JSON.stringify({})],
    );
    return first;
  });
  if (!result) {
    const { rows: exists } = await query<{ status: string }>(
      `SELECT status FROM borrow_items WHERE id = $1`,
      [itemId],
    );
    return exists.length > 0 ? { conflict: true } : { missing: true };
  }
  void getBorrower;
  return { ok: true, item: (await listItemById(itemId, userId))! };
}

export async function listItemById(
  id: string,
  userId: string,
): Promise<BorrowItem | null> {
  const { rows } = await query<BorrowRow>(`${ITEM_SELECT} WHERE b.id = $1`, [id]);
  return rows[0] ? toBorrowItem(rows[0], userId) : null;
}

export async function markReturned(
  itemId: string,
  userId: string,
): Promise<{ ok: true; item: BorrowItem } | { missing: true } | { conflict: true }> {
  const result = await transaction(async (tx) => {
    const { rows } = await tx.query(
      `UPDATE borrow_items SET status = 'RETURNED', updated_at = now()
       WHERE id = $1 AND status = 'BORROWED' AND (owner_id = $2 OR borrower_id = $2)
       RETURNING id`,
      [itemId, userId],
    );
    const first = rows[0] as { id: string } | undefined;
    if (!first) return null;
    await tx.query(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id) VALUES ($1, 'ITEM_RETURNED', 'borrow_item', $2)`,
      [userId, itemId],
    );
    return first;
  });
  if (!result) {
    const { rows: exists } = await query<{ status: string }>(
      `SELECT status FROM borrow_items WHERE id = $1`,
      [itemId],
    );
    return exists.length > 0 ? { conflict: true } : { missing: true };
  }
  return { ok: true, item: (await listItemById(itemId, userId))! };
}

export async function closeItem(
  itemId: string,
  userId: string,
): Promise<{ ok: true; item: BorrowItem } | { missing: true } | { conflict: true }> {
  const result = await transaction(async (tx) => {
    const { rows } = await tx.query(
      `UPDATE borrow_items SET status = 'CLOSED', updated_at = now()
       WHERE id = $1 AND owner_id = $2
       RETURNING id`,
      [itemId, userId],
    );
    const first = rows[0] as { id: string } | undefined;
    if (!first) return null;
    await tx.query(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id) VALUES ($1, 'ITEM_CLOSED', 'borrow_item', $2)`,
      [userId, itemId],
    );
    return first;
  });
  if (!result) {
    const { rows: exists } = await query<{ owner_id: string }>(
      `SELECT owner_id FROM borrow_items WHERE id = $1`,
      [itemId],
    );
    return exists.length > 0 ? { conflict: true } : { missing: true };
  }
  return { ok: true, item: (await listItemById(itemId, userId))! };
}
