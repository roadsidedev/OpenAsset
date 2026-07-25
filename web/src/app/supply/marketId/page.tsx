import { redirect } from "next/navigation";

export default async function SupplyPage({
  params,
}: {
  params: Promise<{ marketId: string }>;
}) {
  const { marketId } = await params;
  redirect(`/markets/${marketId}`);
}
