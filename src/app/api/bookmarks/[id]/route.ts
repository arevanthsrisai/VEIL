import { NextResponse } from "next/server";
import { getCurrentUser, type PublicUser } from "@/lib/auth";
import { unbookmarkConfession } from "@/lib/bookmarks";

export const runtime = "nodejs";

function dbError(err: unknown, fallback: string) {
  if (err instanceof Error && err.message.includes("DATABASE_URL"))
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let user: PublicUser | null;
  try {
    user = await getCurrentUser();
  } catch (err) {
    return dbError(err, "Failed to remove saved post.");
  }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await unbookmarkConfession(user.id, id);
    return NextResponse.json({ bookmarked: false });
  } catch (err) {
    return dbError(err, "Failed to remove saved post.");
  }
}
