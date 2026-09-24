import type { Metadata } from "next";
import { ConfessionDetailView } from "@/components/site/confession-detail";
import { getConfessionById } from "@/lib/confessions";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!UUID_RE.test(id)) return { title: "VEIL post" };
  try {
    const row = await getConfessionById(id, null);
    if (!row || row.status !== "APPROVED") return { title: "VEIL post" };
    const title = row.title ?? "VEIL post";
    const clean = row.content.replace(/\s+/g, " ").trim();
    const description = clean.length > 160 ? `${clean.slice(0, 157)}…` : clean;
    return {
      title,
      description,
      openGraph: { title, description, type: "article" },
      twitter: { card: "summary", title, description },
    };
  } catch {
    return { title: "VEIL post" };
  }
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ConfessionDetailView id={id} />;
}
