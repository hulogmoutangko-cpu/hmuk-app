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

// Helper to count total semi-monthly periods (twice a month) between start date and now
function getExpectedSemiMonthlyPeriods(startDateStr: string): number {
  const start = new Date(startDateStr);
  const now = new Date();
  
  if (isNaN(start.getTime())) return 1;

  let periods = 0;
  let curr = new Date(start.getFullYear(), start.getMonth(), 1);

  while (curr <= now) {
    const p1End = new Date(curr.getFullYear(), curr.getMonth(), 15);
    if (p1End <= now && curr <= now) periods++;

    const p2Start = new Date(curr.getFullYear(), curr.getMonth(), 16);
    if (p2Start <= now) periods++;

    curr.setMonth(curr.getMonth() + 1);
  }

  return Math.max(1, periods);
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
    { data: penaltiesList },
    { data: allProfiles },
    { data: allAccounts },
    { data: allContributions },
    { data: settingsRows },
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
    supabase.from("penalties").select("amount"),
    supabase.from("profiles").select("id, role"),
    supabase.from("coop_accounts").select("id, profile_id"),
    supabase
      .from("contributions")
      .select("account_id, amount, status, pay_date, created_at")
      .in("status", ["approved", "pending"]),
    // Fetch settings from your existing system_settings table
    supabase.from("system_settings").select("key, value").in("key", ["coop_start_date", "monthly_contribution_amount"]),
  ]);

  // Convert settings rows array into an easy object map
  const settingsMap: Record<string, string> = {};
  (settingsRows ?? []).forEach((row) => {
    if (row.key && row.value) {
      settingsMap[row.key] = row.value;
    }
  });

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

  // 4. Total Interest Income
  const totalInterestIncome = (interestPayments ?? []).reduce(
    (sum, i) => sum + Number(i.interest_amount || 0),
    0
  );

  // 5. Total Penalties
  const totalPenalties = (penaltiesList ?? []).reduce(
    (sum, p) => sum + Number(p.amount || 0),
    0
  );

  // 6. Calculate Unpaid Members based on System Settings
  const coopStartDate = settingsMap["coop_start_date"] || "2026-01-01";
  const monthlyAmount = Number(settingsMap["monthly_contribution_amount"] || 1000);
  const semiMonthlyTargetAmount = monthlyAmount / 2; // Split payment twice a month

  const totalExpectedPeriods = getExpectedSemiMonthlyPeriods(coopStartDate);
  const totalExpectedAmountPerMember = totalExpectedPeriods * semiMonthlyTargetAmount;

  const accountPaidTotals: Record<string, number> = {};
  (allContributions ?? []).forEach((c) => {
    if (c.account_id) {
      accountPaidTotals[c.account_id] =
        (accountPaidTotals[c.account_id] || 0) + Number(c.amount || 0);
    }
  });

  const profileToAccounts: Record<string, string[]> = {};
  (allAccounts ?? []).forEach((acc) => {
    if (!profileToAccounts[acc.profile_id]) {
      profileToAccounts[acc.profile_id] = [];
    }
    profileToAccounts[acc.profile_id].push(acc.id);
  });

  const unpaidMembersCount = (allProfiles ?? []).filter((p) => {
    if (p.role === "admin") return false;
    const userAccs = profileToAccounts[p.id] || [];
    if (userAccs.length === 0) return true;

    const userTotalPaid = userAccs.reduce((sum, accId) => sum + (accountPaidTotals[accId] || 0), 0);
    return userTotalPaid < totalExpectedAmountPerMember;
  }).length;

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
              {user.email} • Co-op Start: {coopStartDate} ({fmt(semiMonthlyTargetAmount)} / semi-monthly)
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
            <div className="label">Unpaid / Behind Members</div>
            <div
              className="value"
              style={{ color: unpaidMembersCount > 0 ? "#ef4444" : "inherit" }}
            >
              {unpaidMembersCount}
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