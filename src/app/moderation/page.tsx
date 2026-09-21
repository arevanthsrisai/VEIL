import type { Metadata } from "next";
import { ModerationQueue } from "@/components/site/moderation-queue";

export const metadata: Metadata = {
  title: "Moderation — VEIL",
};

export default function ModerationPage() {
  return <ModerationQueue />;
}
