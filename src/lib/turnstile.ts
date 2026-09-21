export async function verifyTurnstile(token: unknown): Promise<boolean> {
  // ponytail: Turnstile off unless TURNSTILE_SECRET_KEY is set; client must render the widget when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (typeof token !== "string" || token.length === 0) return false;
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret, response: token }),
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { success?: boolean };
  return data.success === true;
}
