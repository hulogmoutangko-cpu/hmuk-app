"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import SignaturePad, { SignaturePadHandle } from "../../signature-pad";

type Account = { id: string; account_name: string; hasActiveLoan: boolean };

export default function ApplyLoanPage() {
  const router = useRouter();
  const supabase = createClient();
  const sigRef = useRef<SignaturePadHandle>(null);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState("");
  const [principal, setPrincipal] = useState("");
  const [termMonths, setTermMonths] = useState("3");
  const [rate, setRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // Fetch user accounts, interest rates, and existing loans concurrently
      const [{ data: accountsData }, { data: rateData }, { data: existingLoans }] =
        await Promise.all([
          supabase
            .from("coop_accounts")
            .select("id, account_name")
            .eq("profile_id", user.id)
            .order("created_at", { ascending: true }),
          supabase.rpc("get_loan_rates"),
          supabase
            .from("loans")
            .select("account_id, status")
            .in("status", [
              "pending",
              "approved",
              "active",
              "disbursed",
              "Pending",
              "Approved",
              "Active",
            ]),
        ]);

      // Set set of account IDs that currently have an ongoing or pending loan
      const activeAccountIdsWithLoans = new Set(
        (existingLoans ?? []).map((l) => l.account_id)
      );

      const mappedAccounts: Account[] = (accountsData ?? []).map((acc) => ({
        ...acc,
        hasActiveLoan: activeAccountIdsWithLoans.has(acc.id),
      }));

      setAccounts(mappedAccounts);

      // Select the first eligible account (without an active loan)
      const eligibleAccount = mappedAccounts.find((a) => !a.hasActiveLoan);
      if (eligibleAccount) {
        setAccountId(eligibleAccount.id);
      } else if (mappedAccounts.length > 0) {
        setAccountId(mappedAccounts[0].id);
      }

      if (rateData && rateData.length > 0) {
        setRate(Number(rateData[0].base_rate));
      }
      setLoadingData(false);
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const selectedAccount = accounts.find((a) => a.id === accountId);
    if (!selectedAccount) {
      setError("Please select a valid account.");
      return;
    }

    if (selectedAccount.hasActiveLoan) {
      setError(
        "This account already has an active or pending loan. You must settle current loans before applying for a new one."
      );
      return;
    }

    if (rate === null) {
      setError("Couldn't load current interest rate. Please refresh and try again.");
      return;
    }

    if (!sigRef.current || sigRef.current.isEmpty()) {
      setError("Please provide your signature to confirm this loan application.");
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
      if (!blob) throw new Error("Could not capture signature.");

      const path = `${user.id}/loan-${Date.now()}.png`;

      const { error: uploadError } = await supabase.storage
        .from("loan-signatures")
        .upload(path, blob, { contentType: "image/png" });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("loan-signatures").getPublicUrl(path);

      const { error: insertError } = await supabase.from("loans").insert({
        account_id: accountId,
        borrower_type: "member",
        principal_amount: Number(principal),
        term_months: Number(termMonths),
        base_interest_rate: rate,
        referral_fee_rate: 0,
        signature_url: publicUrl,
        status: "pending",
      });

      if (insertError) throw insertError;

      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
      setLoading(false);
    }
  }

  const principalNum = Number(principal) || 0;
  const termNum = Number(termMonths) || 1;
  const monthlyInterest = rate !== null ? principalNum * (rate / 100) : 0;
  const totalInterest = monthlyInterest * termNum;

  const selectedAccObj = accounts.find((a) => a.id === accountId);

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
        {/* Navigation Link */}
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

        {/* Title Block */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>
            Apply for a Loan
          </h1>
          <p style={{ margin: 0, color: "var(--text-sub)", fontSize: 13 }}>
            {rate !== null
              ? `Current interest rate: ${rate}% per month.`
              : "Loading current interest rate..."}
          </p>
        </div>

        {/* Error Alert */}
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

        {loadingData ? (
          <p style={{ color: "var(--text-sub)", fontSize: 14 }}>
            Loading loan application data...
          </p>
        ) : accounts.length === 0 ? (
          <p style={{ color: "var(--text-sub)", fontSize: 14 }}>
            You do not have any registered accounts yet.{" "}
            <Link
              href="/dashboard/new-account"
              style={{ color: "var(--text-main)", fontWeight: 600 }}
            >
              Create one first
            </Link>
            .
          </p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
            {/* Account Selector */}
            <div>
              <label
                htmlFor="account"
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-sub)",
                  marginBottom: 6,
                }}
              >
                Target Co-op Account
              </label>
              <select
                id="account"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
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
                {accounts.map((a) => (
                  <option
                    key={a.id}
                    value={a.id}
                    disabled={a.hasActiveLoan}
                  >
                    {a.account_name} {a.hasActiveLoan ? "(Active Loan Exists)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Active Loan Warning Block */}
            {selectedAccObj?.hasActiveLoan && (
              <div
                style={{
                  background: "rgba(234, 179, 8, 0.1)",
                  border: "1px solid rgba(234, 179, 8, 0.3)",
                  color: "#ca8a04",
                  padding: "10px 14px",
                  borderRadius: 8,
                  fontSize: 12.5,
                }}
              >
                ⚠️ This account currently has an ongoing or pending loan. Please select another account or clear existing obligations first.
              </div>
            )}

            {/* Principal Amount */}
            <div>
              <label
                htmlFor="principal"
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-sub)",
                  marginBottom: 6,
                }}
              >
                Loan Amount (₱)
              </label>
              <input
                id="principal"
                type="number"
                min="1"
                step="0.01"
                required
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
                placeholder="0.00"
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

            {/* Term Months */}
            <div>
              <label
                htmlFor="termMonths"
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-sub)",
                  marginBottom: 6,
                }}
              >
                Loan Term (Months)
              </label>
              <input
                id="termMonths"
                type="number"
                min="1"
                step="1"
                required
                value={termMonths}
                onChange={(e) => setTermMonths(e.target.value)}
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

            {/* Calculation Preview Card */}
            {rate !== null && principalNum > 0 && termNum > 0 && (
              <div
                style={{
                  background: "var(--bg-card-hover)",
                  border: "1px solid var(--border-color)",
                  borderRadius: 8,
                  padding: 12,
                  display: "grid",
                  gap: 6,
                  fontSize: 13,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-sub)" }}>Monthly Interest ({rate}%):</span>
                  <strong>
                    ₱
                    {monthlyInterest.toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-sub)" }}>
                    Total Interest ({termNum} month{termNum === 1 ? "" : "s"}):
                  </span>
                  <strong style={{ color: "#10b981" }}>
                    ₱
                    {totalInterest.toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </strong>
                </div>
              </div>
            )}

            {/* Signature Area */}
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
                Borrower Signature
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

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || selectedAccObj?.hasActiveLoan}
              className="btn-approve-sm"
              style={{
                width: "100%",
                padding: "12px 0",
                fontSize: 14,
                fontWeight: 600,
                marginTop: 4,
                height: 44,
                opacity: selectedAccObj?.hasActiveLoan ? 0.5 : 1,
                cursor: selectedAccObj?.hasActiveLoan ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Submitting Application..." : "Submit Loan Application"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}