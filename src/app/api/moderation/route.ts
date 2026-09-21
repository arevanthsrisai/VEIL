import { NextResponse } from "next/server";
import { getCurrentUser, type PublicUser } from "@/lib/auth";
import { isStaff, listOpenReports, listPendingConfessions } from "@/lib/moderation";

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
    return dbError(err, "Failed to load moderation queue.");
  }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isStaff(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const [confessions, reports] = await Promise.all([
      listPendingConfessions(user.id),
      listOpenReports(),
    ]);
    return NextResponse.json({ confessions, reports });
  } catch (err) {
    return dbError(err, "Failed to load moderation queue.");
  }
}
