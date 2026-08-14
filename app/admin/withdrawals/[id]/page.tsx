import CoopAccountWithdrawal from "./withdrawal-form";

export default async function WithdrawalPage({ params }: { params: { id: string } }) {
  const { id } = params;

  return (
    <div style={{ maxWidth: 700, margin: "40px auto", padding: "0 20px" }}>
      <CoopAccountWithdrawal coopAccountId={id} />
    </div>
  );
}