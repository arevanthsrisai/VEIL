import { NextResponse } from "next/server";
import { getPublicSettings } from "@/lib/settings";

export const runtime = "nodejs";

function dbError(err: unknown, fallback: string) {
  if (err instanceof Error && err.message.includes("DATABASE_URL"))
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function GET() {
  try {
    return NextResponse.json(await getPublicSettings());
  } catch (err) {
    return dbError(err, "Failed to load announcement.");
  }
}
