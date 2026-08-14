import CoopAccountWithdrawal from "../withdrawal-form";

export default async function WithdrawalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <div style={{ maxWidth: 700, margin: "40px auto", padding: "0 20px" }}>
      <CoopAccountWithdrawal coopAccountId={id} />
    </div>
  );
}