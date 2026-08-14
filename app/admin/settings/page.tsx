"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import AdminNav from "../admin-nav";

export default function AdminSettingsPage() {
  const supabase = createClient();

  // App Settings State (Row ID based)
  const [maxAccounts, setMaxAccounts] = useState("");
  const [loanRate, setLoanRate] = useState("");
  const [referralRate, setReferralRate] = useState("");
  const [latePenaltyRate, setLatePenaltyRate] = useState("");

  // System Settings State (Key-Value based)
  const [coopStartDate, setCoopStartDate] = useState("");
  const [loanTermsPdfUrl, setLoanTermsPdfUrl] = useState("");
  const [monthlyContributionAmount, setMonthlyContributionAmount] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      // 1. Fetch App Settings
      const { data: appData, error: appError } = await supabase
        .from("app_settings")
        .select("max_coop_accounts, member_loan_interest_rate, referral_fee_rate, late_penalty_rate")
        .eq("id", 1)
        .single();

      // 2. Fetch System Settings
      const { data: sysData, error: sysError } = await supabase
        .from("system_settings")
        .select("key, value");

      if (appError) {
        setError(appError.message);
      } else if (sysError) {
        setError(sysError.message);
      } else {
        if (appData) {
          setMaxAccounts(String(appData.max_coop_accounts ?? ""));
          setLoanRate(String(appData.member_loan_interest_rate ?? ""));
          setReferralRate(String(appData.referral_fee_rate ?? ""));
          setLatePenaltyRate(String(appData.late_penalty_rate ?? ""));
        }
        
        if (sysData) {
          sysData.forEach((item) => {
            if (item.key === "coop_start_date") setCoopStartDate(item.value);
            if (item.key === "loan_terms_pdf_url") setLoanTermsPdfUrl(item.value);
            if (item.key === "monthly_contribution_amount") setMonthlyContributionAmount(item.value);
          });
        }
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

    const now = new Date().toISOString();

    // 1. Update App Settings
    const { error: appError } = await supabase
      .from("app_settings")
      .update({
        max_coop_accounts: Number(maxAccounts),
        member_loan_interest_rate: Number(loanRate),
        referral_fee_rate: Number(referralRate),
        late_penalty_rate: Number(latePenaltyRate),
      })
      .eq("id", 1);

    // 2. Upsert System Settings (using 'key' as the conflict resolution column)
    const { error: sysError } = await supabase
      .from("system_settings")
      .upsert(
        [
          { key: "coop_start_date", value: coopStartDate, updated_at: now },
          { key: "loan_terms_pdf_url", value: loanTermsPdfUrl, updated_at: now },
          { key: "monthly_contribution_amount", value: String(monthlyContributionAmount), updated_at: now },
        ],
        { onConflict: "key" }
      );

    if (appError) {
      setError(`App Settings Error: ${appError.message}`);
    } else if (sysError) {
      setError(`System Settings Error: ${sysError.message}`);
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
            Global rules, rates, and application parameters.
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
            <form onSubmit={handleSubmit} style={{ display: "grid", gap: 24 }}>
              
              {/* --- APP SETTINGS SECTION --- */}
              <div style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px 0" }}>App Thresholds & Rates</h3>
                <div style={{ display: "grid", gap: 16 }}>
                  <div>
                    <label htmlFor="maxAccounts" style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                      Max Co-op Accounts Per Member
                    </label>
                    <span style={{ display: "block", fontSize: 12, color: "var(--text-sub)", marginBottom: 8 }}>
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
                    <label htmlFor="loanRate" style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                      Member Loan Interest Rate (% / month)
                    </label>
                    <span style={{ display: "block", fontSize: 12, color: "var(--text-sub)", marginBottom: 8 }}>
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
                    <label htmlFor="referralRate" style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                      Referral Fee Rate (% / month)
                    </label>
                    <span style={{ display: "block", fontSize: 12, color: "var(--text-sub)", marginBottom: 8 }}>
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

                  <div>
                    <label htmlFor="latePenaltyRate" style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                      Late Penalty Rate (%)
                    </label>
                    <span style={{ display: "block", fontSize: 12, color: "var(--text-sub)", marginBottom: 8 }}>
                      Penalty percentage applied for overdue loan installments.
                    </span>
                    <input
                      id="latePenaltyRate"
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={latePenaltyRate}
                      onChange={(e) => setLatePenaltyRate(e.target.value)}
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
                </div>
              </div>

              {/* --- SYSTEM SETTINGS SECTION --- */}
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px 0" }}>System Parameters</h3>
                <div style={{ display: "grid", gap: 16 }}>
                  <div>
                    <label htmlFor="monthlyContributionAmount" style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                      Monthly Contribution Amount (₱)
                    </label>
                    <span style={{ display: "block", fontSize: 12, color: "var(--text-sub)", marginBottom: 8 }}>
                      The required fixed monthly contribution.
                    </span>
                    <input
                      id="monthlyContributionAmount"
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={monthlyContributionAmount}
                      onChange={(e) => setMonthlyContributionAmount(e.target.value)}
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
                    <label htmlFor="coopStartDate" style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                      Co-op Start Date
                    </label>
                    <span style={{ display: "block", fontSize: 12, color: "var(--text-sub)", marginBottom: 8 }}>
                      Official start date of the co-op system tracking.
                    </span>
                    <input
                      id="coopStartDate"
                      type="date"
                      required
                      value={coopStartDate}
                      onChange={(e) => setCoopStartDate(e.target.value)}
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
                    <label htmlFor="loanTermsPdfUrl" style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                      Loan Terms PDF URL
                    </label>
                    <span style={{ display: "block", fontSize: 12, color: "var(--text-sub)", marginBottom: 8 }}>
                      Direct public link to the terms and conditions PDF.
                    </span>
                    <input
                      id="loanTermsPdfUrl"
                      type="url"
                      required
                      value={loanTermsPdfUrl}
                      onChange={(e) => setLoanTermsPdfUrl(e.target.value)}
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
                </div>
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