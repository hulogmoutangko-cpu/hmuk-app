"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

// --- Types based on your database schema ---
interface UnifiedTransaction {
  id: string;
  type: "Contribution" | "Loan Payment";
  date: string;
  amount: number;
  interest_portion?: number;
  penalty_amount?: number;
  penalty_name?: string;
  status: string;
  entityName: string;
}

export default function FinancialReportPage() {
  const supabase = createClient();
  const [transactions, setTransactions] = useState<UnifiedTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<"7d" | "30d" | "all">("30d");

  // Summary Metrics State
  const [metrics, setMetrics] = useState({
    totalContributions: 0,
    totalLoanRepayments: 0,
    totalInterestEarned: 0,
    totalPenalties: 0,
    pendingAmounts: 0,
  });

  useEffect(() => {
    fetchFinancialData();
  }, [timeframe]);

  async function fetchFinancialData() {
    setLoading(true);
    
    // Calculate date filter
    let dateFilter = new Date();
    if (timeframe === "7d") dateFilter.setDate(dateFilter.getDate() - 7);
    if (timeframe === "30d") dateFilter.setDate(dateFilter.getDate() - 30);
    const dateString = timeframe !== "all" ? dateFilter.toISOString() : null;

    try {
      // 1. Fetch Contributions with linked Coop Account AND linked Penalties
      let contribQuery = supabase
        .from("contributions")
        .select(`
          id,
          amount,
          pay_date,
          status,
          coop_accounts ( account_name ),
          penalties ( name, amount )
        `)
        .order("pay_date", { ascending: false });

      if (dateString) {
        contribQuery = contribQuery.gte("pay_date", dateString);
      }

      // 2. Fetch Loan Payments with linked Loans
      let loanPayQuery = supabase
        .from("loan_payments")
        .select(`
          id,
          total_amount,
          interest_portion,
          pay_date,
          status,
          loans ( borrower_name )
        `)
        .order("pay_date", { ascending: false });

      if (dateString) {
        loanPayQuery = loanPayQuery.gte("pay_date", dateString);
      }

      const [contribRes, loanPayRes] = await Promise.all([contribQuery, loanPayQuery]);

      const unifiedData: UnifiedTransaction[] = [];
      let tempContributions = 0;
      let tempLoanRepayments = 0;
      let tempInterestEarned = 0;
      let tempPenalties = 0;
      let tempPending = 0;

      // Process Contributions
      if (contribRes.data) {
        contribRes.data.forEach((c: any) => {
          const amount = Number(c.amount) || 0;
          const penaltyData = Array.isArray(c.penalties) ? c.penalties[0] : c.penalties; // Handle potential array return
          const penaltyAmount = penaltyData ? Number(penaltyData.amount) : 0;
          const penaltyName = penaltyData ? penaltyData.name : undefined;

          if (c.status?.toLowerCase() === "completed" || c.status?.toLowerCase() === "approved") {
            tempContributions += amount;
            tempPenalties += penaltyAmount;
          } else if (c.status?.toLowerCase() === "pending") {
            tempPending += (amount + penaltyAmount); // Assuming pending includes the penalty
          }

          unifiedData.push({
            id: c.id,
            type: "Contribution",
            date: c.pay_date,
            amount: amount,
            penalty_amount: penaltyAmount > 0 ? penaltyAmount : undefined,
            penalty_name: penaltyName,
            status: c.status || "unknown",
            entityName: c.coop_accounts?.account_name || "Unknown Account",
          });
        });
      }

      // Process Loan Payments
      if (loanPayRes.data) {
        loanPayRes.data.forEach((lp: any) => {
          const totalAmount = Number(lp.total_amount) || 0;
          const interestAmount = Number(lp.interest_portion) || 0;
          
          if (lp.status?.toLowerCase() === "completed" || lp.status?.toLowerCase() === "approved") {
            tempLoanRepayments += totalAmount;
            tempInterestEarned += interestAmount;
          } else if (lp.status?.toLowerCase() === "pending") {
            tempPending += totalAmount;
          }

          unifiedData.push({
            id: lp.id,
            type: "Loan Payment",
            date: lp.pay_date,
            amount: totalAmount,
            interest_portion: interestAmount,
            status: lp.status || "unknown",
            entityName: lp.loans?.borrower_name || "Unknown Borrower",
          });
        });
      }

      // Sort combined data by date descending
      unifiedData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setTransactions(unifiedData);
      setMetrics({
        totalContributions: tempContributions,
        totalLoanRepayments: tempLoanRepayments,
        totalInterestEarned: tempInterestEarned,
        totalPenalties: tempPenalties,
        pendingAmounts: tempPending,
      });

    } catch (error) {
      console.error("Error fetching financial data:", error);
    }
    
    setLoading(false);
  }

  // --- CSV Export Function ---
  function exportToCSV() {
    if (transactions.length === 0) return;
    
    const headers = ["Date", "Transaction ID", "Type", "Account/Borrower", "Status", "Base Amount", "Interest Portion", "Penalty Amount", "Penalty Reason"];
    const rows = transactions.map(t => [
      new Date(t.date).toLocaleDateString(),
      t.id,
      t.type,
      t.entityName.replace(/,/g, ""), // Sanitize commas for CSV
      t.status,
      t.amount.toString(),
      t.interest_portion ? t.interest_portion.toString() : "0",
      t.penalty_amount ? t.penalty_amount.toString() : "0",
      t.penalty_name ? t.penalty_name.replace(/,/g, "") : "N/A"
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(e => e.join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `coop_financial_report_${timeframe}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div style={{ width: "100%", maxWidth: "1200px", margin: "0 auto", padding: "16px", color: "#f8fafc", fontFamily: "system-ui, sans-serif", boxSizing: "border-box" }}>
      
      {/* Navigation */}
      <div style={{ marginBottom: 16 }}>
        <Link
          href="/dashboard"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "#818cf8",
            fontSize: 13,
            fontWeight: 500,
            textDecoration: "none",
            background: "#1e293b66",
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #1e293b",
          }}
        >
          ← Back to Dashboard
        </Link>
      </div>

      {/* Header & Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16, marginBottom: 24, borderBottom: "1px solid #1e293b", paddingBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 4px 0" }}>Financial Report</h1>
          <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>Detailed overview of contributions, loan repayments, and penalties.</p>
        </div>
        
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <select 
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as any)}
            style={{ background: "#0f172a", color: "#f8fafc", border: "1px solid #334155", borderRadius: 6, padding: "8px 12px", fontSize: 13, cursor: "pointer", outline: "none" }}
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="all">All Time</option>
          </select>
          
          <button
            onClick={exportToCSV}
            style={{ background: "#4f46e5", color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
          >
            ↓ Export CSV
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: 20 }}>
          <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 8px 0", fontWeight: 500 }}>Total Contributions</p>
          <h2 style={{ color: "#10b981", fontSize: 24, margin: 0, fontWeight: 700 }}>
            ${metrics.totalContributions.toFixed(2)}
          </h2>
        </div>
        <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: 20 }}>
          <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 8px 0", fontWeight: 500 }}>Loan Repayments</p>
          <h2 style={{ color: "#3b82f6", fontSize: 24, margin: 0, fontWeight: 700 }}>
            ${metrics.totalLoanRepayments.toFixed(2)}
          </h2>
        </div>
        <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: 20 }}>
          <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 8px 0", fontWeight: 500 }}>Interest Earned</p>
          <h2 style={{ color: "#8b5cf6", fontSize: 24, margin: 0, fontWeight: 700 }}>
            ${metrics.totalInterestEarned.toFixed(2)}
          </h2>
        </div>
        <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: 20 }}>
          <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 8px 0", fontWeight: 500 }}>Penalties Collected</p>
          <h2 style={{ color: "#f43f5e", fontSize: 24, margin: 0, fontWeight: 700 }}>
            ${metrics.totalPenalties.toFixed(2)}
          </h2>
        </div>
        <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: 20 }}>
          <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 8px 0", fontWeight: 500 }}>Pending Approvals</p>
          <h2 style={{ color: "#f59e0b", fontSize: 24, margin: 0, fontWeight: 700 }}>
            ${metrics.pendingAmounts.toFixed(2)}
          </h2>
        </div>
      </div>

      {/* Data Table */}
      <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e293b" }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Combined Transaction Ledger</h3>
        </div>
        
        <div style={{ overflowX: "auto" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#64748b", fontSize: 13 }}>Loading financial data...</div>
          ) : transactions.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#64748b", fontSize: 13 }}>No transactions found for this period.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#1e293b44" }}>
                  <th style={{ padding: "12px 20px", color: "#94a3b8", fontWeight: 500, borderBottom: "1px solid #1e293b" }}>Date</th>
                  <th style={{ padding: "12px 20px", color: "#94a3b8", fontWeight: 500, borderBottom: "1px solid #1e293b" }}>Type</th>
                  <th style={{ padding: "12px 20px", color: "#94a3b8", fontWeight: 500, borderBottom: "1px solid #1e293b" }}>Account / Borrower</th>
                  <th style={{ padding: "12px 20px", color: "#94a3b8", fontWeight: 500, borderBottom: "1px solid #1e293b" }}>Status</th>
                  <th style={{ padding: "12px 20px", color: "#94a3b8", fontWeight: 500, borderBottom: "1px solid #1e293b", textAlign: "right" }}>Amount Details</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => {
                  const isCompleted = t.status.toLowerCase() === "completed" || t.status.toLowerCase() === "approved";
                  const isPending = t.status.toLowerCase() === "pending";
                  
                  return (
                    <tr key={`${t.type}-${t.id}`} style={{ borderBottom: "1px solid #1e293b" }}>
                      <td style={{ padding: "12px 20px", color: "#cbd5e1" }}>
                        {t.date ? new Date(t.date).toLocaleDateString() : "N/A"}
                      </td>
                      <td style={{ padding: "12px 20px" }}>
                        <span style={{ 
                          color: t.type === "Contribution" ? "#10b981" : "#3b82f6",
                          fontWeight: 500,
                          fontSize: 12
                        }}>
                          {t.type}
                        </span>
                      </td>
                      <td style={{ padding: "12px 20px", color: "#f8fafc", fontWeight: 500 }}>
                        {t.entityName}
                      </td>
                      <td style={{ padding: "12px 20px" }}>
                        <span style={{
                          padding: "2px 8px",
                          borderRadius: 12,
                          fontSize: 11,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          background: isCompleted ? "#10b98122" : isPending ? "#f59e0b22" : "#ef444422",
                          color: isCompleted ? "#10b981" : isPending ? "#f59e0b" : "#ef4444"
                        }}>
                          {t.status}
                        </span>
                      </td>
                      <td style={{ padding: "12px 20px", textAlign: "right" }}>
                        <div style={{ fontWeight: 600, color: "#f8fafc" }}>
                          ${t.amount.toFixed(2)}
                        </div>
                        {t.interest_portion ? (
                          <div style={{ color: "#8b5cf6", fontSize: 11, marginTop: 2 }}>
                            + ${t.interest_portion.toFixed(2)} interest
                          </div>
                        ) : null}
                        {t.penalty_amount ? (
                          <div style={{ color: "#f43f5e", fontSize: 11, marginTop: 2 }}>
                            + ${t.penalty_amount.toFixed(2)} penalty <br/>
                            <span style={{ opacity: 0.8, fontSize: 10 }}>({t.penalty_name})</span>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}