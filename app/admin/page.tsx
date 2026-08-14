import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import SignOutButton from "../sign-out-button";
import AdminNav from "./admin-nav";
import { Users, FileText, AlertCircle, DollarSign, ArrowUpRight } from "lucide-react";

function fmt(amount: number) {
  return (amount || 0).toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
  });
}

export default async function AdminPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, first_name")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    redirect("/dashboard");
  }

  const [
    { count: pendingContributions },
    { count: pendingLoans },
    { count: totalMembers },
    { data: approvedContributions },
    { data: interestShares },
    { data: activeLoans },
    { data: approvedPayments },
    { data: interestPayments },
    { count: unpaidMembersCount },
    { data: penaltiesList },
  ] = await Promise.all([
    supabase
      .from("contributions")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("loans")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase
      .from("contributions")
      .select("amount")
      .eq("status", "approved"),
    supabase.from("member_interest_shares").select("amount"),
    supabase
      .from("loans")
      .select("id, principal_amount, base_interest_rate, referral_fee_rate")
      .in("status", ["approved", "active", "disbursed", "Approved", "Active"]),
    supabase
      .from("loan_payments")
      .select("loan_id, principal_portion, interest_portion, status")
      .eq("status", "approved"),
    supabase
      .from("loan_interest_payments")
      .select("interest_amount, pool_amount"),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("has_pending_contribution", true),
    // Fetch from your actual 'penalties' table schema
    supabase.from("penalties").select("amount"),
  ]);

  // 1. Total Approved Contributions
  const totalContributions = (approvedContributions ?? []).reduce(
    (sum, c) => sum + Number(c.amount || 0),
    0
  );

  // 2. Total Interest Earned by Members
  const totalInterestEarned = (interestShares ?? []).reduce(
    (sum, s) => sum + Number(s.amount || 0),
    0
  );

  // Map principal paid per loan
  const principalPaidMap: Record<string, number> = {};
  (approvedPayments ?? []).forEach((p) => {
    if (p.loan_id) {
      principalPaidMap[p.loan_id] =
        (principalPaidMap[p.loan_id] || 0) + Number(p.principal_portion || 0);
    }
  });

  // 3. Outstanding Active Principal
  const activePrincipal = (activeLoans ?? []).reduce((sum, loan) => {
    const paid = principalPaidMap[loan.id] || 0;
    const remaining = Math.max(0, Number(loan.principal_amount || 0) - paid);
    return sum + remaining;
  }, 0);

  // 4. Total Interest Income from loan_interest_payments
  const totalInterestIncome = (interestPayments ?? []).reduce(
    (sum, i) => sum + Number(i.interest_amount || 0),
    0
  );

  // 5. Total Penalties from the 'penalties' table
  const totalPenalties = (penaltiesList ?? []).reduce(
    (sum, p) => sum + Number(p.amount || 0),
    0
  );

  return (
    <div>
      <AdminNav email={user.email} firstName={profile?.first_name} />

      <div className="dashboard-container">
        {/* Header Title */}
        <div className="dashboard-hero">
          <div>
            <span className="badge admin">ADMIN DASHBOARD</span>
            <h1>Welcome back, {profile?.first_name ?? "Admin"}</h1>
            <p style={{ margin: "4px 0 0", color: "var(--text-sub)", fontSize: 13.5 }}>
              {user.email}
            </p>
          </div>
          <div style={{ width: 120 }}>
            <SignOutButton />
          </div>
        </div>

        {/* Quick Administrative Links */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          <Link
            href="/admin/contributions"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              padding: "10px 16px",
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              color: "var(--text-main)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <FileText size={15} color="#3b82f6" /> Manage Contributions <ArrowUpRight size={14} />
          </Link>
          <Link
            href="/admin/loans"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              padding: "10px 16px",
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              color: "var(--text-main)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <DollarSign size={15} color="#f59e0b" /> Manage Loans <ArrowUpRight size={14} />
          </Link>
          <Link
            href="/admin/members"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              padding: "10px 16px",
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              color: "var(--text-main)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Users size={15} color="#10b981" /> View Members Directory <ArrowUpRight size={14} />
          </Link>
        </div>

        {/* Action Queue Badges */}
        <div className="section-title">Pending Approvals & System Queue</div>
        <div className="grid-cards">
          <div className="stat-card">
            <div className="label">Pending Contributions</div>
            <div className="value">{pendingContributions ?? 0}</div>
          </div>
          <div className="stat-card">
            <div className="label">Pending Loans</div>
            <div className="value">{pendingLoans ?? 0}</div>
          </div>
          <div className="stat-card">
            <div className="label">Total Members</div>
            <div className="value">{totalMembers ?? 0}</div>
          </div>
          <div className="stat-card">
            <div className="label">Unpaid Member Contri</div>
            <div
              className="value"
              style={{ color: (unpaidMembersCount ?? 0) > 0 ? "#ef4444" : "inherit" }}
            >
              {unpaidMembersCount ?? 0}
            </div>
          </div>
        </div>

        {/* Financial Metrics Summary */}
        <div className="section-title">Financial Overview</div>
        <div className="grid-cards">
          <div className="stat-card">
            <div className="label">Total Contributions</div>
            <div className="value">{fmt(totalContributions)}</div>
          </div>
          <div className="stat-card">
            <div className="label">Total Interest Earned</div>
            <div className="value">{fmt(totalInterestEarned)}</div>
          </div>
          <div className="stat-card">
            <div className="label">Active Loan Principal</div>
            <div className="value">{fmt(activePrincipal)}</div>
          </div>
          <div className="stat-card">
            <div className="label">Total Interest Income</div>
            <div className="value">{fmt(totalInterestIncome)}</div>
          </div>
          <div className="stat-card" style={{ borderColor: totalPenalties > 0 ? "rgba(239, 68, 68, 0.3)" : undefined }}>
            <div className="label" style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <AlertCircle size={14} color="#ef4444" /> Total Penalties
            </div>
            <div className="value" style={{ color: totalPenalties > 0 ? "#ef4444" : "inherit" }}>
              {fmt(totalPenalties)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}