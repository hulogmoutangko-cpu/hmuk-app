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
  const wholeAmount = Math.ceil(Number(amount) || 0);
  return wholeAmount.toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  upcoming: { label: "Active / Unpaid", color: "#3b82f6", bg: "rgba(59, 130, 246, 0.12)" },
  overdue: { label: "Overdue (1+ Day Late)", color: "#ef4444", bg: "rgba(239, 68, 68, 0.12)" },
  completed: { label: "Fully paid", color: "#10b981", bg: "rgba(16, 185, 129, 0.12)" },
  "Interest Paid": { label: "Interest Paid", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.12)" },
};

export default function PayLoanPage() {
  const router = useRouter();
  const supabase = createClient();
  const sigRef = useRef<SignaturePadHandle>(null);

  const [loans, setLoans] = useState<Loan[]>([]);
  const [loanId, setLoanId] = useState("");
  const [installments, setInstallments] = useState<DueInfo[]>([]);
  
  const [selectedMonths, setSelectedMonths] = useState<Record<number, boolean>>({});
  const [paymentModes, setPaymentModes] = useState<Record<number, "full" | "interest_only">>({});

  const [principalPortion, setPrincipalPortion] = useState("");
  const [interestPortion, setInterestPortion] = useState("");
  const [penaltyPortion, setPenaltyPortion] = useState("");
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
  }, [router, supabase]);

  useEffect(() => {
    async function loadDue() {
      if (!loanId) {
        setInstallments([]);
        setSelectedMonths({});
        setPaymentModes({});
        return;
      }
      const { data } = await supabase.rpc("get_loan_due_now", {
        p_loan_id: loanId,
      });
      if (data && data.length > 0) {
        const rows = data as DueInfo[];
        setInstallments(rows);
        
        const initialSelected: Record<number, boolean> = {};
        const initialModes: Record<number, "full" | "interest_only"> = {};
        rows.forEach((r) => {
          initialSelected[r.installment_number] = true;
          initialModes[r.installment_number] = "full";
        });
        setSelectedMonths(initialSelected);
        setPaymentModes(initialModes);
      } else {
        setInstallments([]);
        setSelectedMonths({});
        setPaymentModes({});
      }
    }
    loadDue();
  }, [loanId, supabase]);

  useEffect(() => {
    let totalPrincipal = 0;
    let totalInterest = 0;
    let totalPenalty = 0;

    installments.forEach((inst) => {
      if (selectedMonths[inst.installment_number]) {
        const mode = paymentModes[inst.installment_number] || "full";
        
        if (mode === "full") {
          totalPrincipal += Number(inst.principal_due || 0);
        }

        totalInterest += Number(inst.interest_due || 0);

        if (inst.is_final_installment) {
          totalInterest += Number(inst.extra_interest_due || 0);
          totalPenalty += Number(inst.penalty_due || 0);
        }
      }
    });

    setPrincipalPortion(Math.ceil(totalPrincipal).toString());
    setInterestPortion(Math.ceil(totalInterest).toString());
    setPenaltyPortion(Math.ceil(totalPenalty).toString());
  }, [selectedMonths, paymentModes, installments]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!loanId) {
      setError("Select a loan to pay toward.");
      return;
    }

    const principal = Math.ceil(Number(principalPortion || 0));
    const interest = Math.ceil(Number(interestPortion || 0));
    const penalty = Math.ceil(Number(penaltyPortion || 0));

    if (principal <= 0 && interest <= 0 && penalty <= 0) {
      setError("Enter at least a principal, interest, or penalty amount.");
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

      // 1. Insert main record into loan_payments table
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

      // 2. Insert records into loan_interest_payments table
      if (interest > 0) {
        for (const inst of installments) {
          if (selectedMonths[inst.installment_number]) {
            const instInterest = Math.ceil(
              Number(inst.interest_due || 0) +
                (inst.is_final_installment ? Number(inst.extra_interest_due || 0) : 0)
            );
            if (instInterest > 0) {
              const { error: interestError } = await supabase
                .from("loan_interest_payments")
                .insert({
                  loan_id: loanId,
                  period_month: inst.due_date || payDate,
                  interest_amount: instInterest,
                  posted_by: user.id,
                  pool_amount: 0, // Added to satisfy the NOT NULL constraint
                });

              if (interestError) throw interestError;
            }
          }
        }
      }

      // 3. Insert into penalties table if penalty exists
      if (penalty > 0) {
        const { error: penaltyError } = await supabase
          .from("penalties")
          .insert({
            name: "Late Loan Penalty",
            amount: penalty,
            description: `Overdue penalty paid for loan ID ${loanId}`,
          });

        if (penaltyError) throw penaltyError;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
      setLoading(false);
    }
  }

  const currentPrincipal = Math.ceil(Number(principalPortion) || 0);
  const currentInterest = Math.ceil(Number(interestPortion) || 0);
  const currentPenalty = Math.ceil(Number(penaltyPortion) || 0);
  const totalPayment = currentPrincipal + currentInterest + currentPenalty;

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
          maxWidth: 520,
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
            Select installment months to pay. Amounts automatically route to Principal, Interest, and Penalty ledgers.
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

            {installments.length > 0 && (
              <div style={{ display: "grid", gap: 10 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-sub)",
                  }}
                >
                  Select Installment Months to Include
                </label>
                {installments.map((inst) => {
                  const isChecked = !!selectedMonths[inst.installment_number];
                  const currentMode = paymentModes[inst.installment_number] || "full";
                  const statusConf = STATUS_CONFIG[inst.loan_status];

                  return (
                    <div
                      key={inst.installment_number}
                      style={{
                        background: "var(--bg-card-hover)",
                        border: "1px solid var(--border-color)",
                        borderRadius: 10,
                        padding: 12,
                        display: "grid",
                        gap: 8,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) =>
                              setSelectedMonths({
                                ...selectedMonths,
                                [inst.installment_number]: e.target.checked,
                              })
                            }
                            style={{ width: 16, height: 16, cursor: "pointer" }}
                          />
                          Month {inst.installment_number} (Due: {inst.due_date})
                        </label>
                        <span
                          style={{
                            background: statusConf?.bg ?? "rgba(255,255,255,0.1)",
                            color: statusConf?.color ?? "var(--text-main)",
                            padding: "2px 6px",
                            borderRadius: 4,
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: "uppercase",
                          }}
                        >
                          {statusConf?.label ?? inst.loan_status}
                        </span>
                      </div>

                      {isChecked && (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4, paddingTop: 6, borderTop: "1px dashed var(--border-color)" }}>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              type="button"
                              onClick={() =>
                                setPaymentModes({
                                  ...paymentModes,
                                  [inst.installment_number]: "full",
                                })
                              }
                              style={{
                                padding: "4px 8px",
                                fontSize: 11,
                                fontWeight: 600,
                                borderRadius: 6,
                                border: currentMode === "full" ? "1px solid #3b82f6" : "1px solid var(--border-color)",
                                background: currentMode === "full" ? "rgba(59, 130, 246, 0.15)" : "transparent",
                                color: "var(--text-main)",
                                cursor: "pointer",
                              }}
                            >
                              Full Amount
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setPaymentModes({
                                  ...paymentModes,
                                  [inst.installment_number]: "interest_only",
                                })
                              }
                              style={{
                                padding: "4px 8px",
                                fontSize: 11,
                                fontWeight: 600,
                                borderRadius: 6,
                                border: currentMode === "interest_only" ? "1px solid #3b82f6" : "1px solid var(--border-color)",
                                background: currentMode === "interest_only" ? "rgba(59, 130, 246, 0.15)" : "transparent",
                                color: "var(--text-main)",
                                cursor: "pointer",
                              }}
                            >
                              Interest Only
                            </button>
                          </div>
                          <span style={{ fontSize: 12, color: "var(--text-sub)" }}>
                            {currentMode === "full"
                              ? `Principal: ${fmt(inst.principal_due)} + Int: ${fmt(inst.interest_due)}`
                              : `Int Only: ${fmt(inst.interest_due)}`}
                            {inst.is_final_installment && inst.penalty_due > 0 && ` (+ Penalty: ${fmt(inst.penalty_due)})`}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: "grid", gap: 12, marginTop: 4 }}>
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
                  step="1"
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
                  Interest Amount (₱)
                </label>
                <input
                  type="number"
                  step="1"
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

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#ef4444",
                    marginBottom: 6,
                  }}
                >
                  Penalty Amount (Posted to Penalties Table) (₱)
                </label>
                <input
                  type="number"
                  step="1"
                  value={penaltyPortion}
                  onChange={(e) => setPenaltyPortion(e.target.value)}
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
                <span style={{ color: "var(--text-sub)" }}>Combined Total Payment Amount:</span>
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
                <SignaturePad ref={sigRef} width={460} height={140} />
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