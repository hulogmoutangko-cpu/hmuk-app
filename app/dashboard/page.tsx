"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import SignaturePad, { SignaturePadHandle } from "@/app/signature-pad";

type Loan = {
  id: string;
  principal_amount: number;
  coop_accounts: { account_name: string } | null;
};

type DueInfo = {
  installment_number: number;
  due_date: string | null;
  principal_due: number;
  interest_due: number;
  extra_interest_due: number;
  penalty_due: number;
  total_due: number;
  days_late: number;
  loan_status: string;
  is_final_installment: boolean;
};

function fmt(amount: number) {
  return Number(amount).toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
  });
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  upcoming: { label: "Active / Unpaid", color: "#3b82f6", bg: "rgba(59, 130, 246, 0.12)" },
  grace: { label: "Grace Period", color: "#eab308", bg: "rgba(234, 179, 8, 0.12)" },
  overdue: { label: "Overdue (Final Due Passed)", color: "#ef4444", bg: "rgba(239, 68, 68, 0.12)" },
  completed: { label: "Fully paid", color: "#10b981", bg: "rgba(16, 185, 129, 0.12)" },
};

export default function PayLoanPage() {
  const router = useRouter();
  const supabase = createClient();
  const sigRef = useRef<SignaturePadHandle>(null);

  const [loans, setLoans] = useState<Loan[]>([]);
  const [loanId, setLoanId] = useState("");
  const [installments, setInstallments] = useState<DueInfo[]>([]);
  const [selectedInstallmentNum, setSelectedInstallmentNum] = useState<number>(1);
  const [paymentOption, setPaymentOption] = useState<"full" | "interest_only">("full");

  const [principalPortion, setPrincipalPortion] = useState("");
  const [interestPortion, setInterestPortion] = useState("");
  const [payDate, setPayDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [loading, setLoading] = useState(false);
  const [loadingLoans, setLoadingLoans] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: accounts } = await supabase
        .from("coop_accounts")
        .select("id")
        .eq("profile_id", user.id);

      const accountIds = (accounts ?? []).map((a) => a.id);
      if (accountIds.length === 0) {
        setLoadingLoans(false);
        return;
      }

      const { data: loanRows } = await supabase
        .from("loans")
        .select("id, principal_amount, coop_accounts(account_name)")
        .in("account_id", accountIds)
        .in("status", ["approved", "active", "Approved", "Active"]);

      const fetchedLoans = (loanRows as unknown as Loan[]) ?? [];
      setLoans(fetchedLoans);
      if (fetchedLoans.length > 0) setLoanId(fetchedLoans[0].id);
      setLoadingLoans(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function loadDue() {
      if (!loanId) {
        setInstallments([]);
        return;
      }
      const { data } = await supabase.rpc("get_loan_due_now", {
        p_loan_id: loanId,
      });
      if (data && data.length > 0) {
        const rows = data as DueInfo[];
        setInstallments(rows);
        if (rows.length > 0) {
          setSelectedInstallmentNum(rows[0].installment_number);
        }
      } else {
        setInstallments([]);
      }
    }
    loadDue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loanId]);

  // Update input boxes whenever selected installment or payment option changes
  useEffect(() => {
    const current = installments.find((i) => i.installment_number === selectedInstallmentNum);
    if (!current) return;

    if (paymentOption === "interest_only") {
      setPrincipalPortion("0");
      const totalInterest =
        Number(current.interest_due || 0) +
        (current.is_final_installment ? Number(current.extra_interest_due || 0) + Number(current.penalty_due || 0) : 0);
      setInterestPortion(String(totalInterest));
    } else {
      setPrincipalPortion(String(current.principal_due || 0));
      const totalInterestAndPenalties =
        Number(current.interest_due || 0) +
        (current.is_final_installment ? Number(current.extra_interest_due || 0) + Number(current.penalty_due || 0) : 0);
      setInterestPortion(String(totalInterestAndPenalties));
    }
  }, [selectedInstallmentNum, paymentOption, installments]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!loanId) {
      setError("Select a loan to pay toward.");
      return;
    }
    const principal = Number(principalPortion || 0);
    const interest = Number(interestPortion || 0);
    if (principal <= 0 && interest <= 0) {
      setError("Enter at least a principal or interest amount.");
      return;
    }
    if (!sigRef.current || sigRef.current.isEmpty()) {
      setError("Please sign to confirm this payment.");
      return;
    }

    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    try {
      const blob = await sigRef.current.getBlob();
      if (!blob) throw new Error("Couldn't capture the signature.");

      const path = `${user.id}/loan-payment-${Date.now()}.png`;

      const { error: uploadError } = await supabase.storage
        .from("loan-signatures")
        .upload(path, blob, { contentType: "image/png" });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("loan-signatures").getPublicUrl(path);

      const { error: insertError } = await supabase
        .from("loan_payments")
        .insert({
          loan_id: loanId,
          principal_portion: principal,
          interest_portion: interest,
          signature_url: publicUrl,
          pay_date: payDate,
          submitted_by: "member",
        });

      if (insertError) throw insertError;

      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
      setLoading(false);
    }
  }

  const currentPrincipal = Number(principalPortion) || 0;
  const currentInterest = Number(interestPortion) || 0;
  const totalPayment = currentPrincipal + currentInterest;
  const currentSelectedRow = installments.find((i) => i.installment_number === selectedInstallmentNum);
  const statusInfo = currentSelectedRow ? STATUS_CONFIG[currentSelectedRow.loan_status] : null;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        background: "var(--bg-main)",
      }}
    >
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-color)",
          borderRadius: 16,
          padding: 28,
          maxWidth: 480,
          width: "100%",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.12)",
        }}
      >
        <Link
          href="/dashboard"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-sub)",
            textDecoration: "none",
            marginBottom: 20,
          }}
        >
          ← Back to Dashboard
        </Link>

        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>
            Pay Loan
          </h1>
          <p style={{ margin: 0, color: "var(--text-sub)", fontSize: 13 }}>
            Choose an installment month and payment type. Penalties apply only if the final due date is exceeded.
          </p>
        </div>

        {error && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#ef4444",
              padding: "10px 14px",
              borderRadius: 8,
              fontSize: 13,
              marginBottom: 18,
            }}
          >
            {error}
          </div>
        )}

        {loadingLoans ? (
          <p style={{ color: "var(--text-sub)", fontSize: 14 }}>Loading your loans...</p>
        ) : loans.length === 0 ? (
          <p style={{ color: "var(--text-sub)", fontSize: 14 }}>You don't have any active loans to pay.</p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
            {/* Loan Select */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-sub)",
                  marginBottom: 6,
                }}
              >
                Select Active Loan
              </label>
              <select
                value={loanId}
                onChange={(e) => setLoanId(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-card-hover)",
                  color: "var(--text-main)",
                  fontSize: 14,
                  outline: "none",
                }}
              >
                {loans.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.coop_accounts?.account_name ?? "Loan"} — {fmt(l.principal_amount)}
                  </option>
                ))}
              </select>
            </div>

            {/* Installment Month Select */}
            {installments.length > 0 && (
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-sub)",
                    marginBottom: 6,
                  }}
                >
                  Select Installment Month to Pay
                </label>
                <select
                  value={selectedInstallmentNum}
                  onChange={(e) => setSelectedInstallmentNum(Number(e.target.value))}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-card-hover)",
                    color: "var(--text-main)",
                    fontSize: 14,
                    outline: "none",
                  }}
                >
                  {installments.map((inst) => (
                    <option key={inst.installment_number} value={inst.installment_number}>
                      Month {inst.installment_number} (Due: {inst.due_date})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Payment Scope Option: Full vs Interest Only */}
            {currentSelectedRow && (
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-sub)",
                    marginBottom: 6,
                  }}
                >
                  Payment Option for Month {selectedInstallmentNum}
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setPaymentOption("full")}
                    style={{
                      padding: "10px",
                      borderRadius: 8,
                      border: paymentOption === "full" ? "2px solid #3b82f6" : "1px solid var(--border-color)",
                      background: paymentOption === "full" ? "rgba(59, 130, 246, 0.1)" : "var(--bg-card-hover)",
                      color: "var(--text-main)",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Full Amount
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentOption("interest_only")}
                    style={{
                      padding: "10px",
                      borderRadius: 8,
                      border: paymentOption === "interest_only" ? "2px solid #3b82f6" : "1px solid var(--border-color)",
                      background: paymentOption === "interest_only" ? "rgba(59, 130, 246, 0.1)" : "var(--bg-card-hover)",
                      color: "var(--text-main)",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Interest Only
                  </button>
                </div>
              </div>
            )}

            {/* Summary Breakdown Card */}
            {currentSelectedRow && (
              <div
                style={{
                  background: "var(--bg-card-hover)",
                  border: "1px solid var(--border-color)",
                  borderRadius: 10,
                  padding: 14,
                  display: "grid",
                  gap: 8,
                  fontSize: 13,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span
                    style={{
                      background: statusInfo?.bg ?? "rgba(255,255,255,0.1)",
                      color: statusInfo?.color ?? "var(--text-main)",
                      padding: "3px 8px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    {statusInfo?.label ?? currentSelectedRow.loan_status}
                  </span>
                  <span style={{ color: "var(--text-sub)", fontSize: 12 }}>
                    Due: {currentSelectedRow.due_date}
                  </span>
                </div>

                <div style={{ display: "grid", gap: 4, marginTop: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-sub)" }}>Principal Portion:</span>
                    <span>{fmt(currentSelectedRow.principal_due)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-sub)" }}>Monthly Interest:</span>
                    <span>{fmt(currentSelectedRow.interest_due)}</span>
                  </div>
                  {currentSelectedRow.is_final_installment && currentSelectedRow.extra_interest_due > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-sub)" }}>Extra Month Interest:</span>
                      <span>{fmt(currentSelectedRow.extra_interest_due)}</span>
                    </div>
                  )}
                  {currentSelectedRow.is_final_installment && currentSelectedRow.penalty_due > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#ef4444" }}>Interest Penalty (10%):</span>
                      <span style={{ color: "#ef4444" }}>{fmt(currentSelectedRow.penalty_due)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Editable Input Fields */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-sub)",
                  marginBottom: 6,
                }}
              >
                Principal Amount (₱)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={principalPortion}
                onChange={(e) => setPrincipalPortion(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-card-hover)",
                  color: "var(--text-main)",
                  fontSize: 14,
                  outline: "none",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-sub)",
                  marginBottom: 6,
                }}
              >
                Interest & Penalty Amount (₱)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={interestPortion}
                onChange={(e) => setInterestPortion(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-card-hover)",
                  color: "var(--text-main)",
                  fontSize: 14,
                  outline: "none",
                }}
              />
            </div>

            {totalPayment > 0 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "rgba(16, 185, 129, 0.08)",
                  border: "1px dashed rgba(16, 185, 129, 0.3)",
                  padding: "10px 14px",
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                <span style={{ color: "var(--text-sub)" }}>Total Payment Amount:</span>
                <strong style={{ fontSize: 15, color: "#10b981" }}>
                  {fmt(totalPayment)}
                </strong>
              </div>
            )}

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-sub)",
                  marginBottom: 6,
                }}
              >
                Payment Date
              </label>
              <input
                type="date"
                required
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-card-hover)",
                  color: "var(--text-main)",
                  fontSize: 14,
                  outline: "none",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-sub)",
                  marginBottom: 6,
                }}
              >
                Payer Signature
              </label>
              <div
                style={{
                  border: "1px solid var(--border-color)",
                  borderRadius: 8,
                  overflow: "hidden",
                  background: "#ffffff",
                }}
              >
                <SignaturePad ref={sigRef} width={420} height={140} />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "12px 0",
                fontSize: 14,
                fontWeight: 600,
                marginTop: 4,
                height: 44,
                cursor: "pointer",
              }}
            >
              {loading ? "Submitting Payment..." : "Submit Payment for Approval"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}