import { randomUUID } from "crypto";
import { query, transaction } from "./db";
import { toReactionCounts } from "./confessions";

export type PollOption = { id: string; text: string };

export type PollStatus = "ACTIVE" | "CLOSED";

export type Poll = {
  id: string;
  question: string;
  options: PollOption[];
  status: PollStatus;
  endsAt: string | null;
  createdAt: string;
  createdBy: string;
};

export type PollWithResults = Poll & {
  counts: Record<string, number>;
  myVote: string | null;
};

type PollRow = {
  id: string;
  question: string;
  options: unknown;
  status: string;
  ends_at: string | null;
  created_by: string;
  created_at: string;
  counts?: unknown;
  my_vote?: unknown;
};

export function validatePollQuestion(question: unknown): string | null {
  if (typeof question !== "string") return "Question must be 1-500 characters.";
  const trimmed = question.trim();
  if (trimmed.length < 1 || trimmed.length > 500) return "Question must be 1-500 characters.";
  return null;
}

export function validatePollOptions(options: unknown): string | null {
  if (!Array.isArray(options)) return "Provide 2-6 options, each 1-100 characters.";
  if (options.length < 2 || options.length > 6) return "Provide 2-6 options, each 1-100 characters.";
  for (const option of options) {
    if (typeof option !== "string") return "Provide 2-6 options, each 1-100 characters.";
    const trimmed = option.trim();
    if (trimmed.length < 1 || trimmed.length > 100) return "Provide 2-6 options, each 1-100 characters.";
  }
  return null;
}

export function toPollOptions(value: unknown): PollOption[] {
  let list: unknown = value;
  if (typeof list === "string") {
    try {
      list = JSON.parse(list) as unknown;
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  const out: PollOption[] = [];
  for (const item of list) {
    if (typeof item !== "object" || item === null) continue;
    const entry = item as Record<string, unknown>;
    if (typeof entry.id === "string" && typeof entry.text === "string")
      out.push({ id: entry.id, text: entry.text });
  }
  return out;
}

function toPollWithResults(row: PollRow): PollWithResults {
  return {
    id: row.id,
    question: row.question,
    options: toPollOptions(row.options),
    status: row.status === "CLOSED" ? "CLOSED" : "ACTIVE",
    endsAt: row.ends_at ? new Date(row.ends_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
    createdBy: row.created_by,
    counts: toReactionCounts(row.counts),
    myVote: typeof row.my_vote === "string" ? row.my_vote : null,
  };
}

const COUNTS_AGG = `LEFT JOIN (
      SELECT poll_id, jsonb_object_agg(option_id, cnt) AS counts
      FROM (SELECT poll_id, option_id, COUNT(*)::int AS cnt FROM poll_votes GROUP BY poll_id, option_id) s
      GROUP BY poll_id
    ) v ON v.poll_id = p.id`;

const POLL_COLUMNS =
  "p.id, p.question, p.options, p.status, p.ends_at, p.created_by, p.created_at";

export async function listActivePolls(userId: string): Promise<PollWithResults[]> {
  const { rows } = await query<PollRow>(
    `SELECT ${POLL_COLUMNS}, COALESCE(v.counts, '{}'::jsonb) AS counts, mv.option_id AS my_vote
     FROM polls p
     ${COUNTS_AGG}
     LEFT JOIN (SELECT poll_id, option_id FROM poll_votes WHERE user_id = $1) mv ON mv.poll_id = p.id
     WHERE p.status = 'ACTIVE'
     ORDER BY p.created_at DESC`,
    [userId],
  );
  return rows.map(toPollWithResults);
}

export async function listClosedPolls(userId: string): Promise<PollWithResults[]> {
  const { rows } = await query<PollRow>(
    `SELECT ${POLL_COLUMNS}, COALESCE(v.counts, '{}'::jsonb) AS counts, mv.option_id AS my_vote
     FROM polls p
     ${COUNTS_AGG}
     LEFT JOIN (SELECT poll_id, option_id FROM poll_votes WHERE user_id = $1) mv ON mv.poll_id = p.id
     WHERE p.status = 'CLOSED'
     ORDER BY p.created_at DESC`,
    [userId],
  );
  return rows.map(toPollWithResults);
}

export async function listAllPolls(): Promise<PollWithResults[]> {
  const { rows } = await query<PollRow>(
    `SELECT ${POLL_COLUMNS}, COALESCE(v.counts, '{}'::jsonb) AS counts, NULL::text AS my_vote
     FROM polls p
     ${COUNTS_AGG}
     ORDER BY p.created_at DESC`,
  );
  return rows.map(toPollWithResults);
}

export async function getPollById(id: string, userId: string): Promise<PollWithResults | null> {
  const { rows } = await query<PollRow>(
    `SELECT ${POLL_COLUMNS}, COALESCE(v.counts, '{}'::jsonb) AS counts, mv.option_id AS my_vote
     FROM polls p
     ${COUNTS_AGG}
     LEFT JOIN (SELECT poll_id, option_id FROM poll_votes WHERE user_id = $2) mv ON mv.poll_id = p.id
     WHERE p.id = $1`,
    [id, userId],
  );
  return rows[0] ? toPollWithResults(rows[0]) : null;
}

export async function createPoll(
  createdById: string,
  question: string,
  options: string[],
  endsAt: string | null,
): Promise<PollWithResults> {
  const opts: PollOption[] = options.map((text) => ({ id: randomUUID(), text }));
  const row = await transaction(async (tx) => {
    const { rows } = await tx.query(
      `INSERT INTO polls (question, options, ends_at, created_by)
       VALUES ($1, $2::jsonb, $3, $4)
       RETURNING id, question, options, status, ends_at, created_by, created_at`,
      [question, JSON.stringify(opts), endsAt, createdById],
    );
    return rows[0] as PollRow;
  });
  return toPollWithResults(row);
}

export async function closePoll(
  id: string,
  adminId: string,
): Promise<{ ok: true } | { missing: true } | { conflict: true }> {
  const result = await transaction(async (tx) => {
    const { rows } = await tx.query(
      `UPDATE polls SET status = 'CLOSED' WHERE id = $1 AND status = 'ACTIVE' RETURNING id`,
      [id],
    );
    const target = rows[0] as { id: string } | undefined;
    if (!target) return null;
    await tx.query(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id) VALUES ($1, 'POLL_CLOSED', 'poll', $2)`,
      [adminId, id],
    );
    return { id: target.id };
  });
  if (!result) {
    const { rows: exists } = await query(`SELECT 1 FROM polls WHERE id = $1`, [id]);
    return exists.length > 0 ? { conflict: true } : { missing: true };
  }
  return { ok: true };
}

export type VoteOutcome =
  | { ok: true; voted: boolean; counts: Record<string, number>; myVote: string | null }
  | { missing: true }
  | { conflict: true }
  | { invalid: true };

export async function vote(
  pollId: string,
  userId: string,
  optionId: string,
): Promise<VoteOutcome> {
  return transaction(async (tx) => {
    const { rows } = await tx.query(`SELECT options, status FROM polls WHERE id = $1 FOR SHARE`, [
      pollId,
    ]);
    const poll = rows[0] as { options: unknown; status: string } | undefined;
    if (!poll) return { missing: true };
    if (poll.status !== "ACTIVE") return { conflict: true };
    const options = toPollOptions(poll.options);
    if (!options.some((option) => option.id === optionId)) return { invalid: true };

    const { rows: inserted } = await tx.query(
      `INSERT INTO poll_votes (poll_id, user_id, option_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (poll_id, user_id) DO NOTHING
       RETURNING option_id`,
      [pollId, userId, optionId],
    );
    const { rows: countRows } = await tx.query(
      `SELECT option_id, COUNT(*)::int AS cnt FROM poll_votes WHERE poll_id = $1 GROUP BY option_id`,
      [pollId],
    );
    const counts: Record<string, number> = {};
    for (const row of countRows as { option_id: string; cnt: number }[]) {
      counts[row.option_id] = row.cnt;
    }
    const { rows: mineRows } = await tx.query(
      `SELECT option_id FROM poll_votes WHERE poll_id = $1 AND user_id = $2`,
      [pollId, userId],
    );
    const mine = (mineRows[0] as { option_id: string } | undefined)?.option_id ?? null;
    return { ok: true, voted: inserted.length > 0, counts, myVote: mine };
  });
}
