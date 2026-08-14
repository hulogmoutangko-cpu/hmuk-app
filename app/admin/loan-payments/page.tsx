"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import AdminNav from "../admin-nav";

function fmt(amount: number) {
  return Number(amount || 0).toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
  });
}

type PendingPayment = {
  id: string;
  principal_portion: number;
  interest_portion: number;
  pay_date: string;
  submitted_by: string;
  signature_url: string | null;
  loans: {
    borrower_type: "member" | "non_member";
    borrower_name: string | null;
    coop_accounts: {
      account_name: string;
      profiles: { first_name: string | null; last_name: string | null } | null;
    } | null;
  } | null;
};

type ActiveLoan = {
  id: string;
  borrower_type: "member" | "non_member";
  borrower_name: string | null;
  principal_amount: number;
  coop_accounts: {
    account_name: string;
    profiles: { first_name: string | null; last_name: string | null } | null;
  } | null;
};

export default function AdminLoanPaymentsPage() {
  const supabase = createClient();

  const [pending, setPending] = useState<PendingPayment[]>([]);
  const [activeLoans, setActiveLoans] = useState<
    (ActiveLoan & { principal_paid: number; due?: any })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [activeSignature, setActiveSignature] = useState<string | null>(null);

  // record-payment form state
  const [recordLoanId, setRecordLoanId] = useState("");
  const [recordPrincipal, setRecordPrincipal] = useState("");
  const [recordInterest, setRecordInterest] = useState("");
  const [recordDate, setRecordDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [recording, setRecording] = useState(false);

  function selectRecordLoan(id: string) {
    setRecordLoanId(id);
    const l = activeLoans.find((x) => x.id === id);
    if (l?.due) {
      setRecordPrincipal(String(l.due.principal_due || ""));
      setRecordInterest(
        String(
          Number(l.due.interest_due || 0) +
            Number(l.due.extra_interest_due || 0) +
            Number(l.due.penalty_due || 0) || ""
        )
      );
    }
  }

  async function load() {
    setLoading(true);

    const { data: pendingData, error: pendingError } = await supabase
      .from("loan_payments")
      .select(
        `id, principal_portion, interest_portion, pay_date, submitted_by, signature_url,
         loans(borrower_type, borrower_name, coop_accounts(account_name, profiles(first_name,last_name)))`
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (pendingError) setError(pendingError.message);
    setPending((pendingData as any) ?? []);

    const { data: loansData } = await supabase
      .from("loans")
      .select(
        "id, borrower_type, borrower_name, principal_amount, coop_accounts(account_name, profiles(first_name,last_name))"
      )
      .in("status", ["approved", "active"]);

    const withBalances = [];
    for (const l of (loansData as any) ?? []) {
      const { data: payments } = await supabase
        .from("loan_payments")
        .select("principal_portion")
        .eq("loan_id", l.id)
        .eq("status", "approved");

      const paid = (payments ?? []).reduce(
        (s, p) => s + Number(p.principal_portion),
        0
      );
      const { data: dueData } = await supabase.rpc("get_loan_due_now", {
        p_loan_id: l.id,
      });

      withBalances.push({
        ...l,
        principal_paid: paid,
        due: dueData && dueData.length > 0 ? dueData[0] : null,
      });
    }

    setActiveLoans(withBalances);
    if (withBalances.length > 0 && !recordLoanId) {
      setRecordLoanId(withBalances[0].id);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function act(id: string, status: "approved" | "rejected") {
    setActingId(id);
    setError(null);
    setMessage(null);

    const { error } = await supabase
      .from("loan_payments")
      .update({ status })
      .eq("id", id);

    if (error) {
      setError(error.message);
    } else {
      setMessage(`Payment ${status}.`);
      await load();
    }
    setActingId(null);
  }

  async function handleRecord(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const principal = Number(recordPrincipal || 0);
    const interest = Number(recordInterest || 0);
    if (!recordLoanId || (principal <= 0 && interest <= 0)) {
      setError("Pick a loan and enter at least a principal or interest amount.");
      return;
    }

    setRecording(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("loan_payments").insert({
      loan_id: recordLoanId,
      principal_portion: principal,
      interest_portion: interest,
      pay_date: recordDate,
      post_date: recordDate,
      submitted_by: "admin",
      status: "approved",
      updated_by: user?.id,
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage("Payment recorded successfully.");
      setRecordPrincipal("");
      setRecordInterest("");
      await load();
    }
    setRecording(false);
  }

  function copyLink(loanId: string) {
    const url = `${window.location.origin}/loan-pay/${loanId}`;
    navigator.clipboard.writeText(url);
    setMessage("Payment link copied to clipboard.");
  }

  function borrowerLabel(loan: {
    borrower_type: "member" | "non_member";
    borrower_name: string | null;
    coop_accounts: {
      account_name: string;
      profiles: { first_name: string | null; last_name: string | null } | null;
    } | null;
  }) {
    if (loan.borrower_type === "member") {
      return (
        [
          loan.coop_accounts?.profiles?.first_name,
          loan.coop_accounts?.profiles?.last_name,
        ]
          .filter(Boolean)
          .join(" ") || "Member"
      );
    }
    return loan.borrower_name ?? "Non-Member";
  }

  return (
    <div>
      <AdminNav />

      <div className="dashboard-container">
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
            FINANCE MANAGEMENT
          </span>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: "4px 0" }}>
            Loan Payments
          </h1>
          <p style={{ margin: 0, color: "var(--text-sub)", fontSize: 13 }}>
            Review pending submissions, manage active loan balances, and log payments.
          </p>
        </div>

        {/* Global Notifications */}
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

        {/* 1. SECTION: PENDING PAYMENTS */}
        <div className="section-title">Pending Payments</div>

        {loading && (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text-sub)", fontSize: 14 }}>
            Loading pending payments...
          </div>
        )}

        {!loading && pending.length === 0 && (
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: 12,
              padding: 24,
              textAlign: "center",
              color: "var(--text-sub)",
              marginBottom: 28,
            }}
          >
            No pending payments awaiting review.
          </div>
        )}

        {!loading && pending.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            {/* Desktop Pending Table */}
            <div className="desktop-table-view">
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Borrower</th>
                      <th>Principal</th>
                      <th>Interest</th>
                      <th>Pay Date</th>
                      <th>Submitted By</th>
                      <th>Signature</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.map((p) => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 600 }}>
                          {p.loans ? borrowerLabel(p.loans) : "—"}
                        </td>
                        <td>{fmt(p.principal_portion)}</td>
                        <td>{fmt(p.interest_portion)}</td>
                        <td style={{ color: "var(--text-sub)", fontSize: 13 }}>
                          {p.pay_date}
                        </td>
                        <td>
                          <span
                            className="badge"
                            style={{
                              background: "var(--bg-card-hover)",
                              color: "var(--text-sub)",
                              border: "1px solid var(--border-color)",
                            }}
                          >
                            {p.submitted_by}
                          </span>
                        </td>
                        <td>
                          {p.signature_url ? (
                            <button
                              type="button"
                              className="btn-secondary-sm"
                              onClick={() => setActiveSignature(p.signature_url)}
                            >
                              View
                            </button>
                          ) : (
                            <span style={{ color: "var(--text-sub)", fontSize: 12 }}>—</span>
                          )}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                            <button
                              disabled={actingId === p.id}
                              onClick={() => act(p.id, "approved")}
                              className="btn-approve-sm"
                            >
                              {actingId === p.id ? "..." : "Approve"}
                            </button>
                            <button
                              disabled={actingId === p.id}
                              onClick={() => act(p.id, "rejected")}
                              className="btn-reject-sm"
                            >
                              {actingId === p.id ? "..." : "Reject"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Pending Cards */}
            <div className="mobile-card-list">
              {pending.map((p) => (
                <div key={p.id} className="mobile-member-card">
                  <div className="mobile-member-header">
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>
                        {p.loans ? borrowerLabel(p.loans) : "—"}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-sub)", marginTop: 2 }}>
                        Submitted by: {p.submitted_by}
                      </div>
                    </div>
                  </div>

                  <div className="mobile-member-details">
                    <div className="detail-row">
                      <span>Principal Portion</span>
                      <strong>{fmt(p.principal_portion)}</strong>
                    </div>
                    <div className="detail-row">
                      <span>Interest Portion</span>
                      <strong>{fmt(p.interest_portion)}</strong>
                    </div>
                    <div className="detail-row">
                      <span>Pay Date</span>
                      <span>{p.pay_date}</span>
                    </div>
                    <div className="detail-row">
                      <span>Signature Proof</span>
                      {p.signature_url ? (
                        <button
                          type="button"
                          className="btn-secondary-sm"
                          onClick={() => setActiveSignature(p.signature_url)}
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
                      disabled={actingId === p.id}
                      onClick={() => act(p.id, "approved")}
                      className="btn-approve-sm"
                      style={{ padding: "10px 0", fontSize: 13 }}
                    >
                      {actingId === p.id ? "..." : "Approve"}
                    </button>
                    <button
                      disabled={actingId === p.id}
                      onClick={() => act(p.id, "rejected")}
                      className="btn-reject-sm"
                      style={{ padding: "10px 0", fontSize: 13 }}
                    >
                      {actingId === p.id ? "..." : "Reject"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. SECTION: ACTIVE LOANS */}
        <div className="section-title">Active Loans Overview</div>

        {!loading && activeLoans.length === 0 && (
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: 12,
              padding: 24,
              textAlign: "center",
              color: "var(--text-sub)",
              marginBottom: 28,
            }}
          >
            No active or approved loans.
          </div>
        )}

        {!loading && activeLoans.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            {/* Desktop Active Loans Table */}
            <div className="desktop-table-view">
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Borrower</th>
                      <th>Type</th>
                      <th>Principal</th>
                      <th>Remaining Balance</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeLoans.map((l) => (
                      <tr key={l.id}>
                        <td style={{ fontWeight: 600 }}>{borrowerLabel(l)}</td>
                        <td>
                          <span
                            className={`badge ${
                              l.borrower_type === "member" ? "user" : "admin"
                            }`}
                          >
                            {l.borrower_type === "member" ? "Member" : "Referred"}
                          </span>
                        </td>
                        <td>{fmt(l.principal_amount)}</td>
                        <td style={{ fontWeight: 700 }}>
                          {fmt(Number(l.principal_amount) - l.principal_paid)}
                        </td>
                        <td>
                          {l.due && (
                            <span
                              className={`badge ${
                                l.due.loan_status === "overdue"
                                  ? "danger"
                                  : l.due.loan_status === "grace"
                                  ? "pending"
                                  : "user"
                              }`}
                            >
                              {l.due.loan_status}
                              {l.due.days_late > 0 ? ` · ${l.due.days_late}d late` : ""}
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {l.borrower_type === "non_member" && (
                            <button
                              type="button"
                              className="btn-secondary-sm"
                              onClick={() => copyLink(l.id)}
                            >
                              Copy Link
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Active Loans Cards */}
            <div className="mobile-card-list">
              {activeLoans.map((l) => (
                <div key={l.id} className="mobile-member-card">
                  <div className="mobile-member-header">
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{borrowerLabel(l)}</div>
                      <span
                        className={`badge ${
                          l.borrower_type === "member" ? "user" : "admin"
                        }`}
                        style={{ marginTop: 4 }}
                      >
                        {l.borrower_type === "member" ? "Member" : "Referred"}
                      </span>
                    </div>
                    {l.due && (
                      <span
                        className={`badge ${
                          l.due.loan_status === "overdue"
                            ? "danger"
                            : l.due.loan_status === "grace"
                            ? "pending"
                            : "user"
                        }`}
                      >
                        {l.due.loan_status}
                      </span>
                    )}
                  </div>

                  <div className="mobile-member-details">
                    <div className="detail-row">
                      <span>Total Principal</span>
                      <span>{fmt(l.principal_amount)}</span>
                    </div>
                    <div className="detail-row">
                      <span>Remaining Balance</span>
                      <strong style={{ fontSize: 15 }}>
                        {fmt(Number(l.principal_amount) - l.principal_paid)}
                      </strong>
                    </div>
                  </div>

                  {l.borrower_type === "non_member" && (
                    <button
                      type="button"
                      className="btn-secondary-sm"
                      onClick={() => copyLink(l.id)}
                      style={{ width: "100%", marginTop: 12, padding: "8px 0" }}
                    >
                      Copy Payment Link
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. SECTION: RECORD A PAYMENT FORM */}
        <div className="section-title">Manual Payment Entry</div>
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            borderRadius: 12,
            padding: 24,
            maxWidth: 600,
          }}
        >
          <form onSubmit={handleRecord} style={{ display: "grid", gap: 16 }}>
            <div>
              <label
                htmlFor="recordLoan"
                style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}
              >
                Select Active Loan
              </label>
              <select
                id="recordLoan"
                value={recordLoanId}
                onChange={(e) => selectRecordLoan(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-card-hover)",
                  color: "var(--text-main)",
                  fontSize: 14,
                }}
              >
                {activeLoans.map((l) => (
                  <option key={l.id} value={l.id}>
                    {borrowerLabel(l)} — Balance: {fmt(Number(l.principal_amount) - l.principal_paid)}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label
                  htmlFor="recordPrincipal"
                  style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}
                >
                  Principal Amount
                </label>
                <input
                  id="recordPrincipal"
                  type="number"
                  min="0"
                  step="0.01"
                  value={recordPrincipal}
                  onChange={(e) => setRecordPrincipal(e.target.value)}
                  placeholder="0.00"
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
                  htmlFor="recordInterest"
                  style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}
                >
                  Interest Amount
                </label>
                <input
                  id="recordInterest"
                  type="number"
                  min="0"
                  step="0.01"
                  value={recordInterest}
                  onChange={(e) => setRecordInterest(e.target.value)}
                  placeholder="0.00"
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

            <div>
              <label
                htmlFor="recordDate"
                style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}
              >
                Payment Date
              </label>
              <input
                id="recordDate"
                type="date"
                value={recordDate}
                onChange={(e) => setRecordDate(e.target.value)}
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

            <button
              type="submit"
              disabled={recording}
              className="btn-approve-sm"
              style={{
                width: "100%",
                padding: "12px 0",
                fontSize: 14,
                marginTop: 8,
              }}
            >
              {recording ? "Recording Payment..." : "Record Payment"}
            </button>
          </form>
        </div>
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
            <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Payment Signature</h3>
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
                alt="Payment Signature"
                style={{ maxWidth: "100%", maxHeight: 200, objectFit: "contain" }}
              />
            </div>
            <button
              type="button"
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