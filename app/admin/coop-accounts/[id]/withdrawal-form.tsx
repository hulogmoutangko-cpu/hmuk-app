"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function CoopAccountWithdrawal({ coopAccountId }: { coopAccountId: string }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [contributionsTotal, setContributionsTotal] = useState("");
  const [interestsTotal, setInterestsTotal] = useState("");
  const [deductions, setDeductions] = useState("0");
  const [acknowledgmentNotes, setAcknowledgmentNotes] = useState("");

  const netPayout = 
    (Number(contributionsTotal) || 0) + 
    (Number(interestsTotal) || 0) - 
    (Number(deductions) || 0);

  async function handleProcessWithdrawal(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { error: insertError } = await supabase.from("coop_account_withdrawals").insert([
        {
          coop_account_id: coopAccountId,
          total_contributions: Number(contributionsTotal),
          total_interests: Number(interestsTotal),
          deductions: Number(deductions),
          net_payout: netPayout,
          acknowledgment_notes: acknowledgmentNotes,
        },
      ]);

      if (insertError) throw insertError;

      setSuccessMsg(`Successfully processed 12-month payout of ₱${netPayout.toLocaleString()}. Acknowledgment recorded.`);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to process withdrawal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ background: "var(--bg-card)", padding: 24, borderRadius: 12, border: "1px solid var(--border-color)" }}>
      <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>12-Month Account Share & Contribution Payout</h3>
      <p style={{ color: "var(--text-sub)", fontSize: 13, marginBottom: 20 }}>
        Process the 12-month maturity payout and record member acknowledgment.
      </p>

      {errorMsg && <div style={{ color: "#ef4444", marginBottom: 12, fontSize: 13 }}>{errorMsg}</div>}
      {successMsg && <div style={{ color: "#10b981", marginBottom: 12, fontSize: 13 }}>{successMsg}</div>}

      <form onSubmit={handleProcessWithdrawal} style={{ display: "grid", gap: 16 }}>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Total Contributions (₱)</label>
          <input
            type="number"
            step="0.01"
            required
            value={contributionsTotal}
            onChange={(e) => setContributionsTotal(e.target.value)}
            style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-card-hover)", color: "var(--text-main)" }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Total Interest Shares (₱)</label>
          <input
            type="number"
            step="0.01"
            required
            value={interestsTotal}
            onChange={(e) => setInterestsTotal(e.target.value)}
            style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-card-hover)", color: "var(--text-main)" }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Deductions / Penalties (₱)</label>
          <input
            type="number"
            step="0.01"
            value={deductions}
            onChange={(e) => setDeductions(e.target.value)}
            style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-card-hover)", color: "var(--text-main)" }}
          />
        </div>

        <div style={{ background: "rgba(59, 130, 246, 0.1)", padding: 12, borderRadius: 8, border: "1px solid rgba(59, 130, 246, 0.3)" }}>
          <span style={{ fontSize: 13, color: "var(--text-sub)" }}>Net Payout Amount:</span>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-main)" }}>₱{netPayout.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
        </div>

        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Acknowledgment Details</label>
          <input
            type="text"
            required
            placeholder="e.g., Acknowledged and received via Cash/Check by account holder"
            value={acknowledgmentNotes}
            onChange={(e) => setAcknowledgmentNotes(e.target.value)}
            style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-card-hover)", color: "var(--text-main)" }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{ padding: "12px", background: "#10b981", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}
        >
          {loading ? "Processing..." : "Confirm & Save Acknowledgment"}
        </button>
      </form>
    </div>
  );
}