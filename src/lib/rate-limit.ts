// ponytail: in-memory limiter, Redis if multi-instance
const buckets = new Map<string, number[]>();

export function consume(
  key: string,
  limit: number,
  windowMs: number = 60 * 60 * 1000,
  now: number = Date.now(),
): boolean {
  // ponytail: E2E-only bypass, env-gated; never set E2E_SKIP_RATE_LIMIT outside test runs
  if (process.env.E2E_SKIP_RATE_LIMIT === "1") return true;
  const times = (buckets.get(key) ?? []).filter((t) => t > now - windowMs);
  if (times.length >= limit) {
    buckets.set(key, times);
    return false;
  }
  times.push(now);
  buckets.set(key, times);
  return true;
}

export function resetRateLimits(): void {
  buckets.clear();
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}
