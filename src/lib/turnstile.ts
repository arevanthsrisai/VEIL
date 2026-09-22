export async function verifyTurnstile(token: unknown): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!secret && !siteKey) return true;
  if (!secret || !siteKey) {
    // ponytail: partial config = misconfiguration; fail closed with a clear log, never silently half-on
    console.error(
      "Turnstile partially configured: set both TURNSTILE_SECRET_KEY and NEXT_PUBLIC_TURNSTILE_SITE_KEY, or remove both.",
    );
    return false;
  }
  if (typeof token !== "string" || token.length === 0) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
