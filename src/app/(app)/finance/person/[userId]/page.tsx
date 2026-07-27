import { FinancePersonView } from "@/components/finance/finance-person-view";

interface Params {
  params: Promise<{ userId: string }>;
}

export default async function FinancePersonPage({ params }: Params) {
  const { userId } = await params;

  return (
    <div className="mx-auto max-w-5xl">
      <FinancePersonView userId={userId} />
    </div>
  );
}
