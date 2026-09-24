import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { claimItem, closeItem, markReturned } from "@/lib/borrow";
import { consume } from "@/lib/rate-limit";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function dbError(err: unknown, fallback: string) {
  if (err instanceof Error && err.message.includes("DATABASE_URL"))
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  let user;
  try {
    user = await getCurrentUser();
  } catch (err) {
    return dbError(err, "Failed to update item.");
  }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!consume(`borrow:action:${user.id}`, 30))
    return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 });

  let body: { action?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const action = body.action;
  try {
    if (action === "CLAIM") {
      const result = await claimItem(id, user.id);
      if ("ok" in result) return NextResponse.json({ item: result.item });
      if ("conflict" in result)
        return NextResponse.json({ error: "This item was just claimed by someone else." }, { status: 409 });
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (action === "RETURNED") {
      const result = await markReturned(id, user.id);
      if ("ok" in result) return NextResponse.json({ item: result.item });
      if ("conflict" in result)
        return NextResponse.json({ error: "This item isn't currently borrowed." }, { status: 409 });
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (action === "CLOSED") {
      const result = await closeItem(id, user.id);
      if ("ok" in result) return NextResponse.json({ item: result.item });
      if ("conflict" in result)
        return NextResponse.json({ error: "Only the owner can close a listing." }, { status: 409 });
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (err) {
    return dbError(err, "Failed to update item.");
  }
}
