import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createItem, listItems, validateBorrowCategory, validateBorrowDescription, validateBorrowTitle } from "@/lib/borrow";
import { consume } from "@/lib/rate-limit";

export const runtime = "nodejs";

function dbError(err: unknown, fallback: string) {
  if (err instanceof Error && err.message.includes("DATABASE_URL"))
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function GET(req: Request) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (err) {
    return dbError(err, "Failed to load items.");
  }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const rawCategory = searchParams.get("category");
  const categoryError = validateBorrowCategory(rawCategory);
  if (rawCategory && categoryError)
    return NextResponse.json({ error: categoryError }, { status: 400 });
  try {
    const items = await listItems(user.id, rawCategory ?? null);
    return NextResponse.json({ items });
  } catch (err) {
    return dbError(err, "Failed to load items.");
  }
}

export async function POST(req: Request) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (err) {
    return dbError(err, "Failed to create item.");
  }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!consume(`borrow:create:${user.id}`, 10))
    return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 });

  let body: { title?: unknown; description?: unknown; category?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const titleError = validateBorrowTitle(body.title);
  if (titleError) return NextResponse.json({ error: titleError }, { status: 400 });
  const descError = validateBorrowDescription(body.description);
  if (descError) return NextResponse.json({ error: descError }, { status: 400 });
  const categoryError = validateBorrowCategory(body.category);
  if (categoryError) return NextResponse.json({ error: categoryError }, { status: 400 });

  try {
    const item = await createItem(
      user.id,
      (body.title as string).trim(),
      typeof body.description === "string" && body.description.trim().length > 0
        ? body.description.trim()
        : null,
      body.category as string,
    );
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    return dbError(err, "Failed to create item.");
  }
}
