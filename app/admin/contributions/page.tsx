"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import AdminNav from "../admin-nav";

type SingleOrArray<T> = T | T[];

type SupabaseProfile = {
  id?: string;
  first_name: string | null;
  last_name: string | null;
};

type SupabaseCoopAccount = {
  account_name: string;
  profile_id?: string;
  profiles: SingleOrArray<SupabaseProfile> | null;
};

type Row = {
  id: string;
  amount: number | null;
  pay_date: string | null;
  signature_url: string | null;
  status: "pending" | "approved" | "rejected";
  coop_accounts: SingleOrArray<SupabaseCoopAccount> | null;
};

function fmt(amount: number | null | undefined) {
  return Number(amount || 0).toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
  });
}

function getCoopAccount(row: Row): SupabaseCoopAccount | null {
  if (!row.coop_accounts) return null;
  return Array.isArray(row.coop_accounts)
    ? row.coop_accounts[0] ?? null
    : row.coop_accounts;
}

function getProfile(account: SupabaseCoopAccount | null): SupabaseProfile | null {
  if (!account?.profiles) return null;
  return Array.isArray(account.profiles)
    ? account.profiles[0] ?? null
    : account.profiles;
}

function getMemberDetails(row: Row) {
  const account = getCoopAccount(row);
  const profile = getProfile(account);

  const memberName =
    [profile?.first_name, profile?.last_name]
      .filter(Boolean)
      .join(" ") || "Unnamed Member";

  const initial = (profile?.first_name?.[0] || "M").toUpperCase();
  const accountName = account?.account_name ?? "—";
  
  // profile_id from coop_accounts corresponds to the user/profile id
  const userId = account?.profile_id ?? profile?.id;

  return { memberName, initial, accountName, userId };
}

export default function AdminContributionsPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSignature, setActiveSignature] = useState<string | null>(null);

  // Tab State
  const [activeTab, setActiveTab] = useState<"pending" | "approved">("pending");

  // Search & Date Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Batch Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("contributions")
      .select(
        "id, amount, pay_date, signature_url, status, coop_accounts(account_name, profile_id, profiles(id, first_name, last_name))"
      )
      .eq("status", activeTab)
      .order("created_at", { ascending: false });

    if (error) setError(error.message);
    setRows((data as unknown as Row[]) ?? []);
    setSelectedIds([]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Combined Filter logic (Search query + Date range)
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const { memberName, accountName } = getMemberDetails(r);
      const query = searchQuery.toLowerCase().trim();
      const nameMatch = memberName.toLowerCase().includes(query);
      const accountMatch = accountName.toLowerCase().includes(query);
      const amountMatch = (r.amount ?? 0).toString().includes(query);
      const matchesSearch = !query || nameMatch || accountMatch || amountMatch;

      let matchesDate = true;
      if (r.pay_date) {
        const payDate = new Date(r.pay_date).getTime();
        if (startDate) {
          const start = new Date(startDate).getTime();
          if (payDate < start) matchesDate = false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (payDate > end.getTime()) matchesDate = false;
        }
      } else if (startDate || endDate) {
        matchesDate = false;
      }

      return matchesSearch && matchesDate;
    });
  }, [rows, searchQuery, startDate, endDate]);

  // Helper function to send notification to targeted users upon approval
  async function sendApprovalNotification(targetUserIds: string[], amountText: string) {
    if (targetUserIds.length === 0) return;

    try {
      const title = "Contribution Approved";
      const message = `Your contribution of ${amountText} has been verified and approved by the administrator.`;

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

      const userNotifs = targetUserIds.map((userId) => ({
        notification_id: notif.id,
        user_id: userId,
        is_read: false,
      }));

      const { error: userNotifErr } = await supabase
        .from("user_notifications")
        .insert(userNotifs);

      if (userNotifErr) {
        console.error("Failed to link user notifications:", userNotifErr.message);
      }

      await fetch("/api/send-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          message,
          targetType: "selected",
          recipientIds: targetUserIds,
        }),
      });
    } catch (err) {
      console.error("Error triggering approval notifications:", err);
    }
  }

  // Bulk Selection Handlers
  function toggleSelectAll() {
    if (selectedIds.length === filteredRows.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredRows.map((r) => r.id));
    }
  }

  function toggleSelectOne(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  // Single Item Action
  async function act(id: string, status: "approved" | "rejected") {
    setActingId(id);
    setError(null);

    const targetRow = rows.find((r) => r.id === id);

    const { error } = await supabase
      .from("contributions")
      .update({ status })
      .eq("id", id);

    if (error) {
      setError(error.message);
    } else {
      if (status === "approved" && targetRow) {
        const { userId } = getMemberDetails(targetRow);
        if (userId) {
          await sendApprovalNotification([userId], fmt(targetRow.amount));
        }
      }
      await load();
    }
    setActingId(null);
  }

  // Bulk Action Handler
  async function handleBatchAction(status: "approved" | "rejected") {
    if (selectedIds.length === 0) return;

    const confirmMsg = `Are you sure you want to mark ${selectedIds.length} contribution(s) as ${status}?`;
    if (!window.confirm(confirmMsg)) return;

    setBulkProcessing(true);
    setError(null);

    const targetRows = rows.filter((r) => selectedIds.includes(r.id));

    const { error } = await supabase
      .from("contributions")
      .update({ status })
      .in("id", selectedIds);

    if (error) {
      setError(error.message);
    } else {
      if (status === "approved") {
        for (const row of targetRows) {
          const { userId } = getMemberDetails(row);
          if (userId) {
            await sendApprovalNotification([userId], fmt(row.amount));
          }
        }
      }
      await load();
    }
    setBulkProcessing(false);
  }

  const batchTotalAmount = useMemo(() => {
    return rows
      .filter((r) => selectedIds.includes(r.id))
      .reduce((sum, r) => sum + (r.amount || 0), 0);
  }, [rows, selectedIds]);

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
            Member Contributions
          </h1>
          <p style={{ margin: 0, color: "var(--text-sub)", fontSize: 13 }}>
            Review, approve, or reject contribution records submitted by members.
          </p>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: "flex",
            gap: 8,
            borderBottom: "1px solid var(--border-color)",
            marginBottom: 20,
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("pending")}
            style={{
              padding: "10px 16px",
              fontSize: 14,
              fontWeight: 600,
              background: "transparent",
              border: "none",
              borderBottom: activeTab === "pending" ? "2px solid var(--primary)" : "2px solid transparent",
              color: activeTab === "pending" ? "var(--primary)" : "var(--text-sub)",
              cursor: "pointer",
            }}
          >
            Pending
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("approved")}
            style={{
              padding: "10px 16px",
              fontSize: 14,
              fontWeight: 600,
              background: "transparent",
              border: "none",
              borderBottom: activeTab === "approved" ? "2px solid var(--primary)" : "2px solid transparent",
              color: activeTab === "approved" ? "var(--primary)" : "var(--text-sub)",
              cursor: "pointer",
            }}
          >
            Approved
          </button>
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

        {/* Controls Toolbar: Search, Date Range, & Actions */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 16,
            background: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            padding: 12,
            borderRadius: 12,
          }}
        >
          {/* Search Box */}
          <input
            type="text"
            placeholder="Search member, account, amount..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--border-color)",
              background: "var(--bg-card-hover)",
              color: "var(--text-main)",
              fontSize: 13,
              outline: "none",
              minWidth: 200,
              flex: "1 1 200px",
            }}
          />

          {/* Date Filter Inputs */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: "var(--text-sub)", fontWeight: 500 }}>From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-card-hover)",
                  color: "var(--text-main)",
                  fontSize: 13,
                }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: "var(--text-sub)", fontWeight: 500 }}>To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-card-hover)",
                  color: "var(--text-main)",
                  fontSize: 13,
                }}
              />
            </div>
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
                style={{
                  padding: "6px 10px",
                  fontSize: 12,
                  borderRadius: 6,
                  border: "1px solid var(--border-color)",
                  background: "transparent",
                  color: "var(--text-sub)",
                  cursor: "pointer",
                }}
              >
                Clear Dates
              </button>
            )}
          </div>

          {/* Batch Actions (Only visible in 'pending' tab) */}
          {activeTab === "pending" && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {selectedIds.length > 0 && (
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-sub)" }}>
                  {selectedIds.length} selected ({fmt(batchTotalAmount)})
                </span>
              )}

              <button
                type="button"
                disabled={selectedIds.length === 0 || bulkProcessing}
                onClick={() => handleBatchAction("approved")}
                className="btn-approve-sm"
                style={{ padding: "8px 14px", fontSize: 13 }}
              >
                {bulkProcessing ? "Processing..." : `Approve Selected (${selectedIds.length})`}
              </button>

              <button
                type="button"
                disabled={selectedIds.length === 0 || bulkProcessing}
                onClick={() => handleBatchAction("rejected")}
                className="btn-reject-sm"
                style={{ padding: "8px 14px", fontSize: 13 }}
              >
                Reject Selected
              </button>
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-sub)", fontSize: 14 }}>
            Loading {activeTab} contributions...
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredRows.length === 0 && (
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
            No {activeTab} contributions found matching your filters.
          </div>
        )}

        {/* Desktop View: Table */}
        {!loading && filteredRows.length > 0 && (
          <div className="desktop-table-view">
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    {activeTab === "pending" && (
                      <th style={{ width: 40 }}>
                        <input
                          type="checkbox"
                          checked={
                            filteredRows.length > 0 &&
                            selectedIds.length === filteredRows.length
                          }
                          onChange={toggleSelectAll}
                          style={{ cursor: "pointer" }}
                        />
                      </th>
                    )}
                    <th>Member</th>
                    <th>Account</th>
                    <th>Amount</th>
                    <th>Payment Date</th>
                    <th>Signature</th>
                    {activeTab === "pending" && <th style={{ textAlign: "right" }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r) => {
                    const { memberName, initial, accountName } = getMemberDetails(r);
                    const isChecked = selectedIds.includes(r.id);

                    return (
                      <tr key={r.id}>
                        {activeTab === "pending" && (
                          <td>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleSelectOne(r.id)}
                              style={{ cursor: "pointer" }}
                            />
                          </td>
                        )}
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: "50%",
                                background: "var(--primary-light)",
                                color: "var(--primary)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 700,
                                fontSize: 12,
                              }}
                            >
                              {initial}
                            </div>
                            <span style={{ fontWeight: 600 }}>{memberName}</span>
                          </div>
                        </td>
                        <td style={{ color: "var(--text-sub)" }}>{accountName}</td>
                        <td style={{ fontWeight: 700 }}>{fmt(r.amount)}</td>
                        <td style={{ color: "var(--text-sub)", fontSize: 13 }}>
                          {r.pay_date
                            ? new Date(r.pay_date).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "—"}
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
                        {activeTab === "pending" && (
                          <td style={{ textAlign: "right" }}>
                            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                              <button
                                disabled={actingId === r.id || bulkProcessing}
                                onClick={() => act(r.id, "approved")}
                                className="btn-approve-sm"
                              >
                                {actingId === r.id ? "..." : "Approve"}
                              </button>
                              <button
                                disabled={actingId === r.id || bulkProcessing}
                                onClick={() => act(r.id, "rejected")}
                                className="btn-reject-sm"
                              >
                                {actingId === r.id ? "..." : "Reject"}
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Mobile View: Cards */}
        {!loading && filteredRows.length > 0 && (
          <div className="mobile-card-list">
            {activeTab === "pending" && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 4px",
                }}
              >
                <label style={{ fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={
                      filteredRows.length > 0 && selectedIds.length === filteredRows.length
                    }
                    onChange={toggleSelectAll}
                    style={{ marginRight: 8 }}
                  />
                  Select All ({filteredRows.length})
                </label>
              </div>
            )}

            {filteredRows.map((r) => {
              const { memberName, initial, accountName } = getMemberDetails(r);
              const isChecked = selectedIds.includes(r.id);

              return (
                <div
                  key={r.id}
                  className="mobile-member-card"
                  style={{
                    borderLeft:
                      activeTab === "pending" && isChecked
                        ? "4px solid var(--primary)"
                        : "1px solid var(--border-color)",
                  }}
                >
                  <div className="mobile-member-header">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {activeTab === "pending" && (
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectOne(r.id)}
                          style={{ cursor: "pointer", width: 18, height: 18 }}
                        />
                      )}
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          background: "var(--primary-light)",
                          color: "var(--primary)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          fontSize: 13,
                        }}
                      >
                        {initial}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{memberName}</div>
                        <div style={{ fontSize: 12, color: "var(--text-sub)" }}>
                          {accountName}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mobile-member-details">
                    <div className="detail-row">
                      <span>Contribution Amount</span>
                      <strong style={{ fontSize: 15 }}>{fmt(r.amount)}</strong>
                    </div>
                    <div className="detail-row">
                      <span>Payment Date</span>
                      <span style={{ color: "var(--text-main)" }}>
                        {r.pay_date
                          ? new Date(r.pay_date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "—"}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span>Proof / Signature</span>
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

                  {activeTab === "pending" && (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 8,
                        marginTop: 14,
                      }}
                    >
                      <button
                        disabled={actingId === r.id || bulkProcessing}
                        onClick={() => act(r.id, "approved")}
                        className="btn-approve-sm"
                        style={{ padding: "10px 0", fontSize: 13 }}
                      >
                        {actingId === r.id ? "Processing..." : "Approve"}
                      </button>
                      <button
                        disabled={actingId === r.id || bulkProcessing}
                        onClick={() => act(r.id, "rejected")}
                        className="btn-reject-sm"
                        style={{ padding: "10px 0", fontSize: 13 }}
                      >
                        {actingId === r.id ? "Processing..." : "Reject"}
                      </button>
                    </div>
                  )}
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
            <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Signature Proof</h3>
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
                alt="Signature Proof"
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