"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import SignaturePad, { SignaturePadHandle } from "../../signature-pad";

type Account = { id: string; account_name: string };

export default function PayContributionPage() {
  const router = useRouter();
  const supabase = createClient();
  const sigRef = useRef<SignaturePadHandle>(null);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [amount, setAmount] = useState("");
  const [payDate, setPayDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [loading, setLoading] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAccounts() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data } = await supabase
        .from("coop_accounts")
        .select("id, account_name")
        .eq("profile_id", user.id)
        .order("created_at", { ascending: true });

      const fetchedAccounts = data ?? [];
      setAccounts(fetchedAccounts);
      // Select all accounts by default
      setSelectedAccountIds(fetchedAccounts.map((a) => a.id));
      setLoadingAccounts(false);
    }
    loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleToggleAccount(id: string) {
    setSelectedAccountIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function handleSelectAll() {
    if (selectedAccountIds.length === accounts.length) {
      setSelectedAccountIds([]);
    } else {
      setSelectedAccountIds(accounts.map((a) => a.id));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (selectedAccountIds.length === 0) {
      setError("Please select at least one account to pay contributions.");
      return;
    }
    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setError("Please enter a valid contribution amount.");
      return;
    }
    if (!sigRef.current || sigRef.current.isEmpty()) {
      setError("Please provide your signature to confirm this payment.");
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
      // 1. Upload signature image
      const blob = await sigRef.current.getBlob();
      if (!blob) throw new Error("Could not capture signature.");

      const path = `${user.id}/contribution-${Date.now()}.png`;

      const { error: uploadError } = await supabase.storage
        .from("contribution-signatures")
        .upload(path, blob, { contentType: "image/png" });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("contribution-signatures").getPublicUrl(path);

      // 2. Prepare batch insert array for all selected accounts
      const recordsToInsert = selectedAccountIds.map((accId) => ({
        account_id: accId,
        amount: parsedAmount,
        signature_url: publicUrl,
        pay_date: payDate,
      }));

      // 3. Insert records
      const { error: insertError } = await supabase
        .from("contributions")
        .insert(recordsToInsert);

      if (insertError) throw insertError;

      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
      setLoading(false);
    }
  }

  const calculatedTotal =
    (Number(amount) || 0) * selectedAccountIds.length;

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

        {/* Title & Subtitle */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>
            Pay Contribution
          </h1>
          <p style={{ margin: 0, color: "var(--text-sub)", fontSize: 13 }}>
            Submitted payments are queued for admin review and posting.
          </p>
        </div>

        {/* Error Notification */}
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

        {loadingAccounts ? (
          <p style={{ color: "var(--text-sub)", fontSize: 14 }}>
            Loading your co-op accounts...
          </p>
        ) : accounts.length === 0 ? (
          <p style={{ color: "var(--text-sub)", fontSize: 14 }}>
            You don't have any registered accounts yet.{" "}
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
            {/* Account Selection Checkbox Group */}
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-sub)",
                  }}
                >
                  Target Accounts
                </label>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text-main)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  {selectedAccountIds.length === accounts.length
                    ? "Deselect All"
                    : "Select All"}
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 8,
                  maxHeight: 180,
                  overflowY: "auto",
                  padding: 10,
                  background: "var(--bg-card-hover)",
                  border: "1px solid var(--border-color)",
                  borderRadius: 8,
                }}
              >
                {accounts.map((acc) => {
                  const isChecked = selectedAccountIds.includes(acc.id);
                  return (
                    <label
                      key={acc.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        fontSize: 13.5,
                        fontWeight: 500,
                        cursor: "pointer",
                        userSelect: "none",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleAccount(acc.id)}
                        style={{
                          width: 16,
                          height: 16,
                          accentColor: "var(--text-main)",
                          cursor: "pointer",
                        }}
                      />
                      <span>{acc.account_name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Amount Per Account */}
            <div>
              <label
                htmlFor="amount"
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-sub)",
                  marginBottom: 6,
                }}
              >
                Amount Per Account (₱)
              </label>
              <input
                id="amount"
                type="number"
                min="1"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
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

            {/* Total Calculation Card */}
            {selectedAccountIds.length > 0 && Number(amount) > 0 && (
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
                <span style={{ color: "var(--text-sub)" }}>
                  Total Payment ({selectedAccountIds.length} account
                  {selectedAccountIds.length > 1 ? "s" : ""}):
                </span>
                <strong style={{ fontSize: 15, color: "#10b981" }}>
                  ₱
                  {calculatedTotal.toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </strong>
              </div>
            )}

            {/* Pay Date */}
            <div>
              <label
                htmlFor="payDate"
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
                  outline: "none",
                }}
              />
            </div>

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
                Member Signature
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

            {/* Submit Action */}
            <button
              type="submit"
              disabled={loading}
              className="btn-approve-sm"
              style={{
                width: "100%",
                padding: "12px 0",
                fontSize: 14,
                fontWeight: 600,
                marginTop: 4,
                height: 44,
              }}
            >
              {loading
                ? "Submitting Payment..."
                : `Submit Payment for ${selectedAccountIds.length} Account${
                    selectedAccountIds.length > 1 ? "s" : ""
                  }`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}