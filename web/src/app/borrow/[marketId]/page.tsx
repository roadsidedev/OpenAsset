import { redirect } from "next/navigation";

export default async function BorrowPage({
  params,
}: {
  params: Promise<{ marketId: string }>;
}) {
  const { marketId } = await params;
  redirect(`/markets/${marketId}`);
}
