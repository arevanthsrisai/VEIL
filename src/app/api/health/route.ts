import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ status: "degraded", database: "unconfigured" }, { status: 503 });
  }
  try {
    await query("SELECT 1");
    return NextResponse.json({ status: "ok", database: "ok" });
  } catch {
    return NextResponse.json({ status: "degraded", database: "unreachable" }, { status: 503 });
  }
}
