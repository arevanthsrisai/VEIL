import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { myItems } from "@/lib/borrow";

export const runtime = "nodejs";

export async function GET() {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const items = await myItems(user.id);
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ error: "Failed to load your items." }, { status: 500 });
  }
}
