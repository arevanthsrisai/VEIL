import { NextResponse } from "next/server";
import { getCurrentUser, updateProfile, type PublicUser } from "@/lib/auth";
import { getProfile, validateProfileUpdate } from "@/lib/profile";

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
    return dbError(err, "Failed to load profile.");
  }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const data = await getProfile(user.id);
    return NextResponse.json({
      user,
      restricted_until: data.restricted_until,
      created_at: data.created_at,
      sessions: data.sessions,
    });
  } catch (err) {
    return dbError(err, "Failed to load profile.");
  }
}

export async function PATCH(req: Request) {
  let user: PublicUser | null;
  try {
    user = await getCurrentUser();
  } catch (err) {
    return dbError(err, "Failed to update profile.");
  }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { nickname?: unknown; avatar_emoji?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  // username in the body is ignored — it is private and immutable
  const parsed = validateProfileUpdate(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const updated = await updateProfile(user.id, parsed.update);
    return NextResponse.json({ user: updated });
  } catch (err) {
    return dbError(err, "Failed to update profile.");
  }
}
