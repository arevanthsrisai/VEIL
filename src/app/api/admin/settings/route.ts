import { NextResponse } from "next/server";
import { getCurrentUser, type PublicUser } from "@/lib/auth";
import { isAdmin } from "@/lib/moderation";
import { consume } from "@/lib/rate-limit";
import { getSettings, setSetting, validateSetting } from "@/lib/settings";

export const runtime = "nodejs";

function dbError(err: unknown, fallback: string) {
  if (err instanceof Error && err.message.includes("DATABASE_URL"))
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function GET() {
  let user: PublicUser | null;
  try {
    user = await getCurrentUser();
  } catch (err) {
    return dbError(err, "Failed to load settings.");
  }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    return NextResponse.json({ settings: await getSettings() });
  } catch (err) {
    return dbError(err, "Failed to load settings.");
  }
}

export async function PUT(req: Request) {
  let user: PublicUser | null;
  try {
    user = await getCurrentUser();
  } catch (err) {
    return dbError(err, "Failed to update setting.");
  }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // ponytail: in-memory limiter (E2E-bypassed); 30 setting writes/hour/admin
  if (!consume(`settings:update:${user.id}`, 30))
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });

  let body: { key?: unknown; value?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = validateSetting(body.key, body.value);
  if (!parsed.ok)
    return NextResponse.json({ error: "Invalid setting key or value." }, { status: 400 });

  try {
    await setSetting(parsed.key, parsed.value, user.id);
    return NextResponse.json({ setting: { key: parsed.key, value: parsed.value } });
  } catch (err) {
    return dbError(err, "Failed to update setting.");
  }
}
