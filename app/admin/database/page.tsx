"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import AdminNav from "../admin-nav";
import { Database, AlertTriangle, RefreshCw, ArrowLeft, CheckCircle2 } from "lucide-react";

export default function AdminDatabasePage() {
  const supabase = createClient();
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error" | null; message: string }>({
    type: null,
    message: "",
  });

  const CONFIRMATION_KEYWORD = "RESET TRANSACTIONS";

  async function handleResetDatabase(e: React.FormEvent) {
    e.preventDefault();

    if (confirmText !== CONFIRMATION_KEYWORD) {
      setStatus({
        type: "error",
        message: `Please type "${CONFIRMATION_KEYWORD}" to confirm.`,
      });
      return;
    }

    setLoading(true);
    setStatus({ type: null, message: "" });

    try {
      // Execute Supabase RPC call to wipe only transactional data
      const { error } = await supabase.rpc("reset_transactional_database");

      if (error) throw error;

      setStatus({
        type: "success",
        message: "Transactional database successfully reset! All ledger entries, loans, and contributions have been cleared.",
      });
      setConfirmText("");
    } catch (err: any) {
      setStatus({
        type: "error",
        message: err.message || "Failed to reset transactional database.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <AdminNav />

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 16px" }}>
        {/* Navigation */}
        <div style={{ marginBottom: 16 }}>
          <Link
            href="/admin"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: "var(--text-sub)",
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            <ArrowLeft size={16} /> Back to Dashboard
          </Link>
        </div>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <span className="badge admin" style={{ marginBottom: 6 }}>
            SYSTEM TOOLS
          </span>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: "4px 0" }}>
            Database Management
          </h1>
          <p style={{ margin: 0, color: "var(--text-sub)", fontSize: 13 }}>
            Manage environment state and purge transaction records.
          </p>
        </div>

        {/* Reset Danger Box */}
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: 16,
            padding: 24,
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.12)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div
              style={{
                background: "rgba(239, 68, 68, 0.1)",
                padding: 10,
                borderRadius: 10,
                color: "#ef4444",
              }}
            >
              <AlertTriangle size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#ef4444" }}>
                Reset Transactional Data
              </h2>
              <p style={{ margin: "2px 0 0", color: "var(--text-sub)", fontSize: 13 }}>
                This action will wipe financial logs and cannot be undone.
              </p>
            </div>
          </div>

          <p style={{ fontSize: 13, lineHeight: "1.6", color: "var(--text-main)" }}>
            Executing this function will permanently delete:
          </p>
          <ul
            style={{
              fontSize: 13,
              color: "var(--text-sub)",
              paddingLeft: 20,
              marginBottom: 20,
            }}
          >
            <li>All contributions and payment history records</li>
            <li>All loan applications, active contracts, and payment schedules</li>
            <li>Member interest shares and system notifications</li>
          </ul>

          <div
            style={{
              background: "rgba(16, 185, 129, 0.1)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              color: "#10b981",
              padding: "10px 14px",
              borderRadius: 8,
              fontSize: 12.5,
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <CheckCircle2 size={16} />
            <span>Member accounts, user profiles, and system settings will remain safe.</span>
          </div>

          {/* Confirmation Form */}
          <form onSubmit={handleResetDatabase} style={{ display: "grid", gap: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-sub)" }}>
              To confirm, type <strong style={{ color: "#ef4444" }}>{CONFIRMATION_KEYWORD}</strong> below:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="RESET TRANSACTIONS"
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid var(--border-color)",
                background: "var(--bg-card-hover)",
                color: "var(--text-main)",
                fontSize: 14,
                outline: "none",
              }}
            />

            <button
              type="submit"
              disabled={loading || confirmText !== CONFIRMATION_KEYWORD}
              style={{
                padding: "12px",
                borderRadius: 8,
                background: confirmText === CONFIRMATION_KEYWORD ? "#ef4444" : "var(--bg-card-hover)",
                color: confirmText === CONFIRMATION_KEYWORD ? "#ffffff" : "var(--text-sub)",
                border: "none",
                fontWeight: 700,
                fontSize: 13,
                cursor: confirmText === CONFIRMATION_KEYWORD && !loading ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "all 0.2s ease",
              }}
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" /> Purging Transactions...
                </>
              ) : (
                <>
                  <Database size={16} /> Purge Transaction Data
                </>
              )}
            </button>
          </form>

          {/* Feedback Status */}
          {status.type && (
            <div
              style={{
                marginTop: 16,
                padding: "12px 14px",
                borderRadius: 8,
                fontSize: 13,
                background:
                  status.type === "success"
                    ? "rgba(16, 185, 129, 0.1)"
                    : "rgba(239, 68, 68, 0.1)",
                border: `1px solid ${
                  status.type === "success"
                    ? "rgba(16, 185, 129, 0.3)"
                    : "rgba(239, 68, 68, 0.3)"
                }`,
                color: status.type === "success" ? "#10b981" : "#ef4444",
              }}
            >
              {status.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}