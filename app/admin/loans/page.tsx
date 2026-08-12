"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import AdminNav from "../admin-nav";

type Row = {
  id: string;
  borrower_type: "member" | "non_member";
  borrower_name: string | null;
  borrower_contact: string | null;
  principal_amount: number;
  base_interest_rate: number;
  referral_fee_rate: number;
  signature_url: string;
  coop_accounts: {
    account_name: string;
    profiles: { first_name: string | null; last_name: string | null } | null;
  } | null;
  referrer: { first_name: string | null; last_name: string | null } | null;
};

function fmt(amount: number) {
  return Number(amount || 0).toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
  });
}

export default function AdminLoansPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSignature, setActiveSignature] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("loans")
      .select(
        `id, borrower_type, borrower_name, borrower_contact,
         principal_amount, base_interest_rate, referral_fee_rate, signature_url,
         coop_accounts(account_name, profiles(first_name,last_name)),
         referrer:referred_by(first_name,last_name)`
      )
      .eq("status", "pending")
      .order("applied_at", { ascending: true });

    if (error) setError(error.message);
    setRows((data as any) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function act(id: string, status: "approved" | "rejected") {
    setActingId(id);
    setError(null);
    const { error } = await supabase
      .from("loans")
      .update({ status })
      .eq("id", id);

    if (error) {
      setError(error.message);
    } else {
      await load();
    }
    setActingId(null);
  }

  return (
    <div>
      <AdminNav />

      <div className="dashboard-container">
        {/* Breadcrumb Navigation */}
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
        <div style={{ marginBottom: 20 }}>
          <span className="badge admin" style={{ marginBottom: 6 }}>
            ADMINISTRATION
          </span>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: "4px 0" }}>
            Pending Loan Applications
          </h1>
          <p style={{ margin: 0, color: "var(--text-sub)", fontSize: 13 }}>
            Review, approve, or reject pending loan applications.
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
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        {/* Loading Indicator */}
        {loading && (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-sub)", fontSize: 14 }}>
            Loading pending applications...
          </div>
        )}

        {/* Empty State */}
        {!loading && rows.length === 0 && (
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: 12,
              padding: 40,
              textAlign: "center",
              color: "var(--text-sub)",
            }}
          >
            No pending loan applications right now.
          </div>
        )}

        {/* Desktop View: Data Table */}
        {!loading && rows.length > 0 && (
          <div className="desktop-table-view">
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Borrower</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Monthly Rate</th>
                    <th>Signature</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const borrowerName =
                      r.borrower_type === "member"
                        ? [
                            r.coop_accounts?.profiles?.first_name,
                            r.coop_accounts?.profiles?.last_name,
                          ]
                            .filter(Boolean)
                            .join(" ") || "Member"
                        : r.borrower_name || "Non-Member";

                    const totalRate = (
                      Number(r.base_interest_rate || 0) +
                      Number(r.referral_fee_rate || 0)
                    ).toFixed(2);

                    const referrerName = [
                      r.referrer?.first_name,
                      r.referrer?.last_name,
                    ]
                      .filter(Boolean)
                      .join(" ");

                    return (
                      <tr key={r.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{borrowerName}</div>
                          {r.borrower_type === "non_member" && (
                            <div style={{ fontSize: 12, color: "var(--text-sub)" }}>
                              {r.borrower_contact ?? "No Contact"}
                              {referrerName ? ` · Ref: ${referrerName}` : ""}
                            </div>
                          )}
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              r.borrower_type === "member" ? "user" : "admin"
                            }`}
                          >
                            {r.borrower_type === "member" ? "Member" : "Referred"}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700 }}>{fmt(r.principal_amount)}</td>
                        <td>
                          <code
                            style={{
                              background: "var(--bg-card-hover)",
                              padding: "2px 6px",
                              borderRadius: 4,
                              fontSize: 12,
                              border: "1px solid var(--border-color)",
                            }}
                          >
                            {totalRate}% / mo
                          </code>
                        </td>
                        <td>
                          {r.signature_url ? (
                            <button
                              type="button"
                              className="btn-secondary-sm"
                              onClick={() => setActiveSignature(r.signature_url)}
                            >
                              View Sig
                            </button>
                          ) : (
                            <span style={{ color: "var(--text-sub)", fontSize: 12 }}>—</span>
                          )}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              justifyContent: "flex-end",
                            }}
                          >
                            <button
                              disabled={actingId === r.id}
                              onClick={() => act(r.id, "approved")}
                              className="btn-approve-sm"
                            >
                              {actingId === r.id ? "..." : "Approve"}
                            </button>
                            <button
                              disabled={actingId === r.id}
                              onClick={() => act(r.id, "rejected")}
                              className="btn-reject-sm"
                            >
                              {actingId === r.id ? "..." : "Reject"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Mobile View: Responsive Cards */}
        {!loading && rows.length > 0 && (
          <div className="mobile-card-list">
            {rows.map((r) => {
              const borrowerName =
                r.borrower_type === "member"
                  ? [
                      r.coop_accounts?.profiles?.first_name,
                      r.coop_accounts?.profiles?.last_name,
                    ]
                      .filter(Boolean)
                      .join(" ") || "Member"
                  : r.borrower_name || "Non-Member";

              const totalRate = (
                Number(r.base_interest_rate || 0) +
                Number(r.referral_fee_rate || 0)
              ).toFixed(2);

              const referrerName = [
                r.referrer?.first_name,
                r.referrer?.last_name,
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <div key={r.id} className="mobile-member-card">
                  <div className="mobile-member-header">
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{borrowerName}</div>
                      {r.borrower_type === "non_member" && (
                        <div style={{ fontSize: 12, color: "var(--text-sub)", marginTop: 2 }}>
                          {r.borrower_contact ?? "No Contact"}
                        </div>
                      )}
                    </div>
                    <span
                      className={`badge ${
                        r.borrower_type === "member" ? "user" : "admin"
                      }`}
                    >
                      {r.borrower_type === "member" ? "Member" : "Referred"}
                    </span>
                  </div>

                  <div className="mobile-member-details">
                    <div className="detail-row">
                      <span>Principal Amount</span>
                      <strong style={{ fontSize: 15 }}>{fmt(r.principal_amount)}</strong>
                    </div>
                    <div className="detail-row">
                      <span>Monthly Interest</span>
                      <code>{totalRate}% / mo</code>
                    </div>
                    {r.borrower_type === "non_member" && referrerName && (
                      <div className="detail-row">
                        <span>Referred By</span>
                        <span style={{ color: "var(--text-main)" }}>{referrerName}</span>
                      </div>
                    )}
                    <div className="detail-row">
                      <span>Signature</span>
                      {r.signature_url ? (
                        <button
                          type="button"
                          className="btn-secondary-sm"
                          onClick={() => setActiveSignature(r.signature_url)}
                        >
                          View Signature
                        </button>
                      ) : (
                        <span>—</span>
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 8,
                      marginTop: 14,
                    }}
                  >
                    <button
                      disabled={actingId === r.id}
                      onClick={() => act(r.id, "approved")}
                      className="btn-approve-sm"
                      style={{ padding: "10px 0", fontSize: 13 }}
                    >
                      {actingId === r.id ? "Processing..." : "Approve"}
                    </button>
                    <button
                      disabled={actingId === r.id}
                      onClick={() => act(r.id, "rejected")}
                      className="btn-reject-sm"
                      style={{ padding: "10px 0", fontSize: 13 }}
                    >
                      {actingId === r.id ? "Processing..." : "Reject"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Signature Lightbox Modal */}
      {activeSignature && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setActiveSignature(null)}
        >
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: 16,
              padding: 20,
              maxWidth: 400,
              width: "100%",
              textAlign: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Borrower Signature</h3>
            <div
              style={{
                background: "#fff",
                borderRadius: 8,
                padding: 12,
                marginBottom: 16,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activeSignature}
                alt="Signature"
                style={{ maxWidth: "100%", maxHeight: 200, objectFit: "contain" }}
              />
            </div>
            <button
              className="btn-secondary-sm"
              style={{ width: "100%", padding: 10 }}
              onClick={() => setActiveSignature(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}