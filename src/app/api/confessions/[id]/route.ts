import { NextResponse } from "next/server";
import { getCurrentUser, type PublicUser } from "@/lib/auth";
import { getConfessionById, toConfessionDetail } from "@/lib/confessions";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let user: PublicUser | null;
  try {
    user = await getCurrentUser();
  } catch (err) {
    if (err instanceof Error && err.message.includes("DATABASE_URL"))
      return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    return NextResponse.json({ error: "Failed to load post." }, { status: 500 });
  }

  try {
    const row = await getConfessionById(id, user?.id ?? null);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const isOwn = user !== null && user.id === row.author_id;
    const isStaff = user?.role === "MODERATOR" || user?.role === "ADMIN";
    if (row.status !== "APPROVED" && !isOwn && !isStaff)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(
      toConfessionDetail(row, user ?? { id: "", nickname: "", avatar_emoji: "", role: "USER" }),
    );
  } catch (err) {
    if (err instanceof Error && err.message.includes("DATABASE_URL"))
      return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    return NextResponse.json({ error: "Failed to load post." }, { status: 500 });
  }
}
