import { test, expect } from "@playwright/test";
import { Pool } from "pg";
import { registerViaApi, uniqueUser } from "./helpers";

const OPTION_A = "e2e-option-a";
const OPTION_B = "e2e-option-b";

test.skip(
  !process.env.DATABASE_URL,
  "DATABASE_URL is required in the test environment to seed polls for the vote flow"
);

const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? "" });

test.afterAll(async () => {
  await pool.end();
});

async function seedPoll(question: string): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO polls (question, options) VALUES ($1, $2::jsonb) RETURNING id`,
    [
      question,
      JSON.stringify([
        { id: OPTION_A, text: "The library" },
        { id: OPTION_B, text: "The coffee shop" },
      ]),
    ],
  );
  const row = rows[0];
  if (!row) throw new Error("poll seed failed: no row returned");
  return row.id;
}

type VoteResponse = {
  voted: boolean;
  counts: Record<string, number>;
  myVote: string | null;
};

test.describe("polls", () => {
  test("non-admin cannot create polls", async ({ page }) => {
    const user = uniqueUser();
    await registerViaApi(page, user);
    const res = await page.request.post("/api/polls", {
      data: { question: "E2E unauthorized poll", options: ["a", "b"] },
    });
    expect(res.status()).toBe(403);
  });

  test("GET /api/polls returns polls for a logged-in user", async ({ page }) => {
    const user = uniqueUser();
    await registerViaApi(page, user);
    const res = await page.request.get("/api/polls");
    expect(res.status()).toBe(200);
    const data = (await res.json()) as { polls: unknown[]; closedPolls: unknown[] };
    expect(Array.isArray(data.polls)).toBe(true);
    expect(Array.isArray(data.closedPolls)).toBe(true);
  });

  test("vote flow: first vote counts, repeat is idempotent", async ({ page }) => {
    const user = uniqueUser();
    await registerViaApi(page, user);
    const pollId = await seedPoll(`E2E vote poll ${Date.now()}`);
    try {
      const first = await page.request.post(`/api/polls/${pollId}/vote`, {
        data: { optionId: OPTION_A },
      });
      expect(first.status()).toBe(200);
      const firstData = (await first.json()) as VoteResponse;
      expect(firstData.voted).toBe(true);
      expect(firstData.myVote).toBe(OPTION_A);
      expect(firstData.counts[OPTION_A]).toBe(1);

      const repeat = await page.request.post(`/api/polls/${pollId}/vote`, {
        data: { optionId: OPTION_A },
      });
      expect(repeat.status()).toBe(200);
      const repeatData = (await repeat.json()) as VoteResponse;
      expect(repeatData.voted).toBe(false);
      expect(repeatData.counts[OPTION_A]).toBe(1);
      expect(repeatData.myVote).toBe(OPTION_A);
    } finally {
      await pool.query("DELETE FROM polls WHERE id = $1", [pollId]);
    }
  });

  test("vote with an option id outside the poll's options is rejected", async ({ page }) => {
    const user = uniqueUser();
    await registerViaApi(page, user);
    const pollId = await seedPoll(`E2E invalid option poll ${Date.now()}`);
    try {
      const res = await page.request.post(`/api/polls/${pollId}/vote`, {
        data: { optionId: "not-a-real-option" },
      });
      expect(res.status()).toBe(404);
    } finally {
      await pool.query("DELETE FROM polls WHERE id = $1", [pollId]);
    }
  });

  test("admin can create a poll", async () => {
    test.skip(
      true,
      "needs an ADMIN account — helpers only register USER accounts via /api/auth/register; bootstrap one via scripts/bootstrap-admin.mjs to enable"
    );
  });
});
