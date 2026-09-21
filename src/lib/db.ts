import { Pool } from "pg";

const MISSING_DB_URL =
  "DATABASE_URL is not set. Set it to a PostgreSQL connection string.";

type TxClient = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
};

type PoolLike = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
  connect: () => Promise<TxClient & { release: () => void }>;
};

function createPool(): PoolLike {
  if (!process.env.DATABASE_URL) {
    console.error(MISSING_DB_URL);
    throw new Error(MISSING_DB_URL);
  }
  return new Pool({ connectionString: process.env.DATABASE_URL }) as PoolLike;
}

let inner: PoolLike | null = null;

function lazy(): PoolLike {
  if (!inner) inner = createPool();
  return inner;
}

export const pool = new Proxy({} as PoolLike, {
  get(_target, prop) {
    const target = lazy() as unknown as Record<string | symbol, unknown>;
    const value = target[prop];
    if (typeof value === "function") return (value as (...args: unknown[]) => unknown).bind(target);
    return value;
  },
}) as PoolLike;

export async function query<T>(text: string, params?: unknown[]): Promise<{ rows: T[] }> {
  if (!process.env.DATABASE_URL) throw new Error(MISSING_DB_URL);
  return lazy().query(text, params) as Promise<{ rows: T[] }>;
}

export async function transaction<T>(fn: (tx: PoolLike) => Promise<T>): Promise<T> {
  if (!process.env.DATABASE_URL) throw new Error(MISSING_DB_URL);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client as unknown as PoolLike);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
