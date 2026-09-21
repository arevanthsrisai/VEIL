import type { Metadata } from "next";
import { AdminPanel } from "@/components/site/admin-panel";

export const metadata: Metadata = {
  title: "Admin — VEIL",
};

export default function AdminPage() {
  return <AdminPanel />;
}
