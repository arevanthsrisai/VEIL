import { ConfessionDetailView } from "@/components/site/confession-detail";

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ConfessionDetailView id={id} />;
}
