import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/moderation";
import { listAuditLogs } from "@/lib/settings";

export const runtime = "nodejs";

export async function GET() {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const logs = await listAuditLogs(50);
    return NextResponse.json({ logs });
  } catch {
    return NextResponse.json({ error: "Failed to load audit logs." }, { status: 500 });
  }
}
