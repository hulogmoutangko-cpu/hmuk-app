"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import SignaturePad, { SignaturePadHandle } from "../../signature-pad";

type LoanInfo = {
  id: string;
  borrower_name: string;
  principal_amount: number;
};

type DueInfo = {
  installment_number: number | null;
  due_date: string | null;
  principal_due: number;
  interest_due: number;
  extra_interest_due: number;
  penalty_due: number;
  total_due: number;
  days_late: number;
  loan_status: string;
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

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  upcoming: { label: "Active / Unpaid", color: "#3b82f6", bg: "rgba(59, 130, 246, 0.12)" },
  overdue: { label: "Overdue (1+ Day Late)", color: "#ef4444", bg: "rgba(239, 68, 68, 0.12)" },
  completed: { label: "Fully paid", color: "#10b981", bg: "rgba(16, 185, 129, 0.12)" },
};

export default function LoanPayPage() {
  const params = useParams<{ loanId: string }>();
  const loanId = params.loanId;
  const supabase = createClient();
  const sigRef = useRef<SignaturePadHandle>(null);

  const [loan, setLoan] = useState<LoanInfo | null>(null);
  const [due, setDue] = useState<DueInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [principalPortion, setPrincipalPortion] = useState("");
  const [interestPortion, setInterestPortion] = useState("");
  const [penaltyPortion, setPenaltyPortion] = useState("");
  const [payDate, setPayDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.rpc("get_public_loan_info", {
        p_loan_id: loanId,
      });
      if (data && data.length > 0) {
        setLoan(data[0]);
      } else {
        setNotFound(true);
        return;
      }

      const { data: dueData } = await supabase.rpc("get_loan_due_now", {
        p_loan_id: loanId,
      });
      if (dueData && dueData.length > 0) {
        const d = dueData[0] as DueInfo;
        setDue(d);
        setPrincipalPortion(String(Math.ceil(d.principal_due || 0)));
        setInterestPortion(
          String(
            Math.ceil(
              Number(d.interest_due || 0) +
                Number(d.extra_interest_due || 0)
            )
          )
        );
        setPenaltyPortion(String(Math.ceil(d.penalty_due || 0)));
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loanId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const principal = Math.ceil(Number(principalPortion || 0));
    const interest = Math.ceil(Number(interestPortion || 0));
    const penalty = Math.ceil(Number(penaltyPortion || 0));

    if (principal <= 0 && interest <= 0 && penalty <= 0) {
      setError("Please enter at least a principal, interest, or penalty amount.");
      return;
    }
    if (!sigRef.current || sigRef.current.isEmpty()) {
      setError("Please draw your signature to confirm this payment.");
      return;
    }

    setLoading(true);

    try {
      const blob = await sigRef.current.getBlob();
      if (!blob) throw new Error("Couldn't capture signature image.");

      const path = `referral/loan-payment-${loanId}-${Date.now()}.png`;

      const { error: uploadError } = await supabase.storage
        .from("loan-signatures")
        .upload(path, blob, { contentType: "image/png" });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("loan-signatures").getPublicUrl(path);

      // 1. Insert into loan_payments table
      const { error: insertError } = await supabase
        .from("loan_payments")
        .insert({
          loan_id: loanId,
          principal_portion: principal,
          interest_portion: interest,
          signature_url: publicUrl,
          pay_date: payDate,
          submitted_by: "non_member",
        });

      if (insertError) throw insertError;

      // 2. Insert into penalties table if penalty portion exists
      if (penalty > 0) {
        const { error: penaltyError } = await supabase
          .from("penalties")
          .insert({
            name: "Late Loan Penalty",
            amount: penalty,
            description: `Overdue penalty paid for non-member loan ID ${loanId}`,
          });

        if (penaltyError) throw penaltyError;
      }

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message ?? "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  // Container styling for full page centering
  const wrapperStyle: React.CSSProperties = {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px 16px",
    background: "var(--bg-main)",
  };

  const cardStyle: React.CSSProperties = {
    background: "var(--bg-card)",
    border: "1px solid var(--border-color)",
    borderRadius: 16,
    padding: 24,
    maxWidth: 480,
    width: "100%",
    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
  };

  if (notFound) {
    return (
      <div style={wrapperStyle}>
        <div style={{ ...cardStyle, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px" }}>
            Payment Link Not Found
          </h1>
          <p style={{ margin: 0, color: "var(--text-sub)", fontSize: 14 }}>
            This payment link is invalid or has expired. Please contact support.
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={wrapperStyle}>
        <div style={{ ...cardStyle, textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px" }}>
            Payment Submitted
          </h1>
          <p style={{ margin: 0, color: "var(--text-sub)", fontSize: 14, lineHeight: 1.5 }}>
            Thank you! Your payment details have been submitted for review and will be posted upon verification.
          </p>
        </div>
      </div>
    );
  }

  if (!loan) {
    return (
      <div style={wrapperStyle}>
        <div style={{ ...cardStyle, textAlign: "center", color: "var(--text-sub)", fontSize: 14 }}>
          Loading payment details...
        </div>
      </div>
    );
  }

  const statusConf = due ? STATUS_LABEL[due.loan_status] ?? { label: due.loan_status, color: "#3b82f6", bg: "rgba(59,130,246,0.1)" } : null;
  const currentPrincipal = Math.ceil(Number(principalPortion) || 0);
  const currentInterest = Math.ceil(Number(interestPortion) || 0);
  const currentPenalty = Math.ceil(Number(penaltyPortion) || 0);
  const totalPayment = currentPrincipal + currentInterest + currentPenalty;

  return (
    <div style={wrapperStyle}>
      <div style={cardStyle}>
        {/* Header Title */}
        <div style={{ marginBottom: 20 }}>
          <span className="badge user" style={{ marginBottom: 6 }}>
            LOAN PAYMENT
          </span>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: "4px 0" }}>
            {loan.borrower_name}
          </h1>
          <p style={{ margin: 0, color: "var(--text-sub)", fontSize: 13 }}>
            Submit your payment details below along with your signature.
          </p>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#ef4444",
              padding: "10px 14px",
              borderRadius: 8,
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        {/* Amount Due Breakdown Banner */}
        {due && due.loan_status !== "completed" && (
          <div
            style={{
              background: "var(--bg-card-hover)",
              border: "1px solid var(--border-color)",
              borderRadius: 10,
              padding: 14,
              marginBottom: 20,
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span
                style={{
                  background: statusConf?.bg,
                  color: statusConf?.color,
                  padding: "2px 8px",
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                }}
              >
                {statusConf?.label}
              </span>
              {due.due_date && (
                <span style={{ color: "var(--text-sub)", fontSize: 12 }}>
                  Due: {due.due_date}
                </span>
              )}
            </div>

            <div style={{ color: "var(--text-sub)", fontSize: 12 }}>
              Principal: <strong>{fmt(due.principal_due)}</strong> + Interest: <strong>{fmt(due.interest_due)}</strong>
              {due.extra_interest_due > 0 && <> + Extra: <strong>{fmt(due.extra_interest_due)}</strong></>}
              {due.penalty_due > 0 && <> + Penalty: <strong style={{ color: "#ef4444" }}>{fmt(due.penalty_due)}</strong></>}
            </div>

            <div
              style={{
                marginTop: 8,
                paddingTop: 8,
                borderTop: "1px dashed var(--border-color)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>Total Amount Due:</span>
              <strong style={{ fontSize: 16, color: "var(--text-main)" }}>
                {fmt(due.total_due)}
              </strong>
            </div>
          </div>
        )}

        {due && due.loan_status === "completed" && (
          <div
            style={{
              background: "rgba(16, 185, 129, 0.1)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              color: "#10b981",
              padding: "12px 14px",
              borderRadius: 8,
              fontSize: 13,
              marginBottom: 20,
              textAlign: "center",
              fontWeight: 600,
            }}
          >
            🎉 This loan is fully paid.
          </div>
        )}

        {/* Payment Form */}
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
          <div>
            <label
              htmlFor="principalPortion"
              style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}
            >
              Principal Amount (₱)
            </label>
            <input
              id="principalPortion"
              type="number"
              min="0"
              step="1"
              value={principalPortion}
              onChange={(e) => setPrincipalPortion(e.target.value)}
              placeholder="0"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid var(--border-color)",
                background: "var(--bg-card-hover)",
                color: "var(--text-main)",
                fontSize: 14,
              }}
            />
          </div>

          <div>
            <label
              htmlFor="interestPortion"
              style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}
            >
              Interest Amount (₱)
            </label>
            <input
              id="interestPortion"
              type="number"
              min="0"
              step="1"
              value={interestPortion}
              onChange={(e) => setInterestPortion(e.target.value)}
              placeholder="0"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid var(--border-color)",
                background: "var(--bg-card-hover)",
                color: "var(--text-main)",
                fontSize: 14,
              }}
            />
          </div>

          <div>
            <label
              htmlFor="penaltyPortion"
              style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#ef4444", marginBottom: 6 }}
            >
              Penalty Amount (₱)
            </label>
            <input
              id="penaltyPortion"
              type="number"
              min="0"
              step="1"
              value={penaltyPortion}
              onChange={(e) => setPenaltyPortion(e.target.value)}
              placeholder="0"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid var(--border-color)",
                background: "var(--bg-card-hover)",
                color: "var(--text-main)",
                fontSize: 14,
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
              <span style={{ color: "var(--text-sub)" }}>Combined Total Payment:</span>
              <strong style={{ fontSize: 15, color: "#10b981" }}>
                {fmt(totalPayment)}
              </strong>
            </div>
          )}

          <div>
            <label
              htmlFor="payDate"
              style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}
            >
              Payment Date
            </label>
            <input
              id="payDate"
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
              }}
            />
          </div>

          <div>
            <label
              style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}
            >
              Draw Signature
            </label>
            <div
              style={{
                background: "#ffffff",
                border: "1px solid var(--border-color)",
                borderRadius: 8,
                overflow: "hidden",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <SignaturePad ref={sigRef} width={340} height={140} />
            </div>
            <span style={{ fontSize: 11, color: "var(--text-sub)", marginTop: 4, display: "block" }}>
              Sign above using your touch device or mouse.
            </span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-approve-sm"
            style={{
              width: "100%",
              padding: "12px 0",
              fontSize: 14,
              marginTop: 8,
            }}
          >
            {loading ? "Submitting Payment..." : "Submit Payment"}
          </button>
        </form>
      </div>
    </div>
  );
}