"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import AdminNav from "../admin-nav";

export default function AdminSettingsPage() {
  const supabase = createClient();

  const [maxAccounts, setMaxAccounts] = useState("");
  const [loanRate, setLoanRate] = useState("");
  const [referralRate, setReferralRate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("app_settings")
        .select("max_coop_accounts, member_loan_interest_rate, referral_fee_rate")
        .eq("id", 1)
        .single();

      if (error) {
        setError(error.message);
      } else if (data) {
        setMaxAccounts(String(data.max_coop_accounts));
        setLoanRate(String(data.member_loan_interest_rate));
        setReferralRate(String(data.referral_fee_rate));
      }
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    const { error } = await supabase
      .from("app_settings")
      .update({
        max_coop_accounts: Number(maxAccounts),
        member_loan_interest_rate: Number(loanRate),
        referral_fee_rate: Number(referralRate),
      })
      .eq("id", 1);

    if (error) {
      setError(error.message);
    } else {
      setMessage("Settings saved successfully.");
    }
    setSaving(false);
  }

  return (
    <div>
      <AdminNav />

      <div className="dashboard-container" style={{ maxWidth: 640 }}>
        {/* Navigation Breadcrumb */}
        <div style={{ marginBottom: 12 }}>
          <Link
            href="/admin"
            style={{
              color: "var(--text-sub)",
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            ← Back to Dashboard
          </Link>
        </div>

        {/* Header Title */}
        <div style={{ marginBottom: 24 }}>
          <span className="badge admin" style={{ marginBottom: 6 }}>
            SYSTEM CONFIGURATION
          </span>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: "4px 0" }}>
            Co-op Settings
          </h1>
          <p style={{ margin: 0, color: "var(--text-sub)", fontSize: 13 }}>
            Global rules and rates. Rate adjustments apply only to new applications; existing active loans remain unchanged.
          </p>
        </div>

        {/* Notifications */}
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
        {message && (
          <div
            style={{
              background: "rgba(16, 185, 129, 0.1)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              color: "#10b981",
              padding: "10px 14px",
              borderRadius: 8,
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {message}
          </div>
        )}

        {/* Form Content */}
        {loading ? (
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: 12,
              padding: 24,
              textAlign: "center",
              color: "var(--text-sub)",
            }}
          >
            Loading settings...
          </div>
        ) : (
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: 12,
              padding: 24,
            }}
          >
            <form onSubmit={handleSubmit} style={{ display: "grid", gap: 20 }}>
              <div>
                <label
                  htmlFor="maxAccounts"
                  style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}
                >
                  Max Co-op Accounts Per Member
                </label>
                <span
                  style={{
                    display: "block",
                    fontSize: 12,
                    color: "var(--text-sub)",
                    marginBottom: 8,
                  }}
                >
                  Maximum number of active sub-accounts a single member can hold.
                </span>
                <input
                  id="maxAccounts"
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={maxAccounts}
                  onChange={(e) => setMaxAccounts(e.target.value)}
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
                  htmlFor="loanRate"
                  style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}
                >
                  Member Loan Interest Rate (% / month)
                </label>
                <span
                  style={{
                    display: "block",
                    fontSize: 12,
                    color: "var(--text-sub)",
                    marginBottom: 8,
                  }}
                >
                  Monthly interest rate applied to standard member loan applications.
                </span>
                <input
                  id="loanRate"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={loanRate}
                  onChange={(e) => setLoanRate(e.target.value)}
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
                  htmlFor="referralRate"
                  style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}
                >
                  Referral Fee Rate (% / month)
                </label>
                <span
                  style={{
                    display: "block",
                    fontSize: 12,
                    color: "var(--text-sub)",
                    marginBottom: 8,
                  }}
                >
                  Additional interest fee added on top of base rate for non-member loans.
                </span>
                <input
                  id="referralRate"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={referralRate}
                  onChange={(e) => setReferralRate(e.target.value)}
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

              <div style={{ paddingTop: 8 }}>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-approve-sm"
                  style={{
                    width: "100%",
                    padding: "12px 0",
                    fontSize: 14,
                  }}
                >
                  {saving ? "Saving Changes..." : "Save Settings"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}