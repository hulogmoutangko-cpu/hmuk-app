"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import AdminNav from "../admin-nav";
import { Printer, FileText, CheckCircle2, XCircle, Eye } from "lucide-react";

type LoanStatus = "pending" | "active" | "completed";

type Row = {
  id: string;
  status: string;
  borrower_type: "member" | "non_member";
  borrower_name: string | null;
  borrower_contact: string | null;
  principal_amount: number;
  term_months: number;
  base_interest_rate: number;
  referral_fee_rate: number;
  signature_url: string;
  applied_at: string;
  coop_accounts: {
    profile_id?: string;
    account_name: string;
    profiles: { id?: string; first_name: string | null; last_name: string | null } | null;
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
  const [activeTab, setActiveTab] = useState<LoanStatus>("pending");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [activeSignature, setActiveSignature] = useState<string | null>(null);
  const [selectedContractLoan, setSelectedContractLoan] = useState<Row | null>(null);

  async function load(status: LoanStatus) {
    setLoading(true);
    setError(null);

    // Map tab values to DB status matching
    let statusFilter: string[];

    switch (status) {
      case "pending":
        statusFilter = ["pending", "Pending"];
        break;
      case "active":
        statusFilter = ["active", "approved", "disbursed", "Active"];
        break;
      case "completed":
        statusFilter = ["completed", "settled", "Completed"];
        break;
      default:
        statusFilter = [status];
    }

    const { data, error } = await supabase
      .from("loans")
      .select(
        `id, status, borrower_type, borrower_name, borrower_contact,
         principal_amount, term_months, base_interest_rate, referral_fee_rate, signature_url, applied_at,
         coop_accounts(profile_id, account_name, profiles(id, first_name, last_name)),
         referrer:referred_by(first_name,last_name)`
      )
      .in("status", statusFilter)
      .order("applied_at", { ascending: false });

    if (error) setError(error.message);
    setRows((data as any) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load(activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Helper function to send notification upon loan approval
  async function sendLoanApprovalNotification(userId: string, loanAmountText: string) {
    if (!userId) return;

    try {
      const title = "Loan Application Approved";
      const message = `Your loan application for ${loanAmountText} has been verified and approved.`;

      const { data: notif, error: notifErr } = await supabase
        .from("notifications")
        .insert({
          title,
          message,
          type: "info",
          target_type: "selected",
        })
        .select()
        .single();

      if (notifErr || !notif) {
        console.error("Failed to create notification record:", notifErr?.message);
        return;
      }

      const { error: userNotifErr } = await supabase
        .from("user_notifications")
        .insert({
          notification_id: notif.id,
          user_id: userId,
          is_read: false,
        });

      if (userNotifErr) {
        console.error("Failed to link user notification:", userNotifErr.message);
      }

      await fetch("/api/send-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          message,
          targetType: "selected",
          recipientIds: [userId],
        }),
      });
    } catch (err) {
      console.error("Error triggering loan approval notifications:", err);
    }
  }

  async function act(id: string, status: "approved" | "rejected" | "completed") {
    setActingId(id);
    setError(null);

    const targetRow = rows.find((r) => r.id === id);

    const { error } = await supabase
      .from("loans")
      .update({ status })
      .eq("id", id);

    if (error) {
      setError(error.message);
    } else {
      // If approved, trigger notification for member borrowers
      if (status === "approved" && targetRow && targetRow.borrower_type === "member") {
        const userId = targetRow.coop_accounts?.profile_id || targetRow.coop_accounts?.profiles?.id;
        if (userId) {
          await sendLoanApprovalNotification(userId, fmt(targetRow.principal_amount));
        }
      }
      await load(activeTab);
    }
    setActingId(null);
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <div>
      <div className="no-print">
        <AdminNav />
      </div>

      <div className="dashboard-container no-print">
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
            Loan Management
          </h1>
          <p style={{ margin: 0, color: "var(--text-sub)", fontSize: 13 }}>
            Review pending applications, monitor active loans, and issue contracts.
          </p>
        </div>

        {/* Navigation Filter Tabs */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 20,
            borderBottom: "1px solid var(--border-color)",
            paddingBottom: 10,
          }}
        >
          {(["pending", "active", "completed"] as LoanStatus[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                textTransform: "capitalize",
                border: "none",
                cursor: "pointer",
                background:
                  activeTab === tab ? "#3b82f6" : "var(--bg-card-hover)",
                color: activeTab === tab ? "#ffffff" : "var(--text-main)",
                transition: "all 0.2s ease",
              }}
            >
              {tab} Applications
            </button>
          ))}
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
          <div
            style={{
              padding: 32,
              textAlign: "center",
              color: "var(--text-sub)",
              fontSize: 14,
            }}
          >
            Loading {activeTab} loan applications...
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
            No {activeTab} loan records found.
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
                              style={{ display: "inline-flex", gap: 4, alignItems: "center" }}
                            >
                              <Eye size={12} /> View Sig
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
                            {/* Contract Generator Button */}
                            <button
                              type="button"
                              onClick={() => setSelectedContractLoan(r)}
                              style={{
                                padding: "6px 12px",
                                borderRadius: 6,
                                background: "#4f46e5",
                                color: "#ffffff",
                                border: "none",
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <FileText size={13} /> Contract
                            </button>

                            {/* Conditional Action Buttons Based on Tab Status */}
                            {activeTab === "pending" && (
                              <>
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
                              </>
                            )}

                            {activeTab === "active" && (
                              <button
                                disabled={actingId === r.id}
                                onClick={() => act(r.id, "completed")}
                                className="btn-approve-sm"
                              >
                                Mark Completed
                              </button>
                            )}
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
      </div>

      {/* Signature Modal */}
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

      {/* Printable Dual Copy Contract Modal */}
      {selectedContractLoan && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            justifyContent: "center",
            padding: 20,
            overflowY: "auto",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              color: "#000000",
              width: "100%",
              maxWidth: "800px",
              padding: "40px",
              borderRadius: "8px",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            className="printable-contract"
          >
            {/* Modal Actions Bar (Hidden on print) */}
            <div
              className="no-print"
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 20,
                paddingBottom: 12,
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <button
                type="button"
                onClick={handlePrint}
                style={{
                  background: "#2563eb",
                  color: "#fff",
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "none",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Printer size={16} /> Print / Export to PDF
              </button>
              <button
                type="button"
                onClick={() => setSelectedContractLoan(null)}
                style={{
                  background: "#e5e7eb",
                  color: "#374151",
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "none",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>

            {/* Contract Body Render Function */}
            <ContractView loan={selectedContractLoan} copyType="CO-OP COPY" />
            <div
              style={{
                borderTop: "2px dashed #9ca3af",
                margin: "40px 0",
                position: "relative",
              }}
              className="cut-line"
            >
              <span
                style={{
                  position: "absolute",
                  top: "-12px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "#fff",
                  padding: "0 10px",
                  fontSize: "12px",
                  color: "#6b7280",
                }}
              >
                ✂ Cut along line
              </span>
            </div>
            <ContractView loan={selectedContractLoan} copyType="MEMBER / BORROWER COPY" />
          </div>

          {/* CSS Print Styles */}
          <style jsx global>{`
            @media print {
              body * {
                visibility: hidden;
              }
              .no-print {
                display: none !important;
              }
              .printable-contract,
              .printable-contract * {
                visibility: visible;
              }
              .printable-contract {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                max-width: 100% !important;
                padding: 0 !important;
                background: white !important;
                color: black !important;
              }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}

// Sub-component rendering individual contract copy layout
function ContractView({ loan, copyType }: { loan: Row; copyType: string }) {
  const borrowerName =
    loan.borrower_type === "member"
      ? [
          loan.coop_accounts?.profiles?.first_name,
          loan.coop_accounts?.profiles?.last_name,
        ]
          .filter(Boolean)
          .join(" ") || "Member"
      : loan.borrower_name || "Non-Member";

  const totalRate = (
    Number(loan.base_interest_rate || 0) + Number(loan.referral_fee_rate || 0)
  ).toFixed(2);

  return (
    <div style={{ padding: "10px 0", fontSize: "13px", lineHeight: "1.5" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: "bold", margin: 0 }}>
            LOAN AGREEMENT CONTRACT
          </h2>
          <p style={{ margin: 0, color: "#4b5563", fontSize: "12px" }}>
            Cooperative Credit Facilities
          </p>
        </div>
        <span
          style={{
            border: "1px solid #000",
            padding: "4px 8px",
            fontSize: "11px",
            fontWeight: "bold",
            borderRadius: "4px",
          }}
        >
          {copyType}
        </span>
      </div>

      <p>
        This Agreement is entered into on{" "}
        <strong>{new Date(loan.applied_at || Date.now()).toLocaleDateString("en-PH")}</strong>, by and between the <strong>Cooperative Organization</strong> and the undersigned borrower:
      </p>

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          margin: "12px 0",
        }}
      >
        <tbody>
          <tr>
            <td style={{ padding: "6px", border: "1px solid #d1d5db", fontWeight: "bold", width: "30%" }}>
              Borrower Name:
            </td>
            <td style={{ padding: "6px", border: "1px solid #d1d5db" }}>{borrowerName}</td>
          </tr>
          <tr>
            <td style={{ padding: "6px", border: "1px solid #d1d5db", fontWeight: "bold" }}>
              Principal Amount:
            </td>
            <td style={{ padding: "6px", border: "1px solid #d1d5db" }}>
              ₱{Number(loan.principal_amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </td>
          </tr>
          <tr>
            <td style={{ padding: "6px", border: "1px solid #d1d5db", fontWeight: "bold" }}>
              Interest Rate:
            </td>
            <td style={{ padding: "6px", border: "1px solid #d1d5db" }}>{totalRate}% / Month</td>
          </tr>
          <tr>
            <td style={{ padding: "6px", border: "1px solid #d1d5db", fontWeight: "bold" }}>
              Loan Duration:
            </td>
            <td style={{ padding: "6px", border: "1px solid #d1d5db" }}>{loan.term_months || 1} Months</td>
          </tr>
        </tbody>
      </table>

      <p style={{ fontSize: "11px", color: "#374151", margin: "12px 0" }}>
        <strong>Terms:</strong> The borrower agrees to repay the total principal along with monthly accrued interest based on agreed timelines. Failure to comply with terms will incur appropriate penalty fees under cooperative guidelines.
      </p>

      {/* Signature Section */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "30px" }}>
        <div style={{ width: "45%", textAlign: "center" }}>
          {loan.signature_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={loan.signature_url}
              alt="Borrower Signature"
              style={{ maxHeight: "40px", marginBottom: "4px" }}
            />
          ) : (
            <div style={{ height: "40px" }} />
          )}
          <div style={{ borderTop: "1px solid #000", paddingTop: "4px", fontWeight: "bold" }}>
            {borrowerName}
          </div>
          <span style={{ fontSize: "11px", color: "#6b7280" }}>Borrower Signature</span>
        </div>

        <div style={{ width: "45%", textAlign: "center" }}>
          <div style={{ height: "40px" }} />
          <div style={{ borderTop: "1px solid #000", paddingTop: "4px", fontWeight: "bold" }}>
            Authorized Co-op Officer
          </div>
          <span style={{ fontSize: "11px", color: "#6b7280" }}>Approved By</span>
        </div>
      </div>
    </div>
  );
}