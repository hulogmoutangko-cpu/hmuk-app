import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import SignOutButton from "../sign-out-button";
import PostInterestButton from "./post-interest-button";
import AdminNav from "./admin-nav";

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
    // Fetch total member interest earnings from member_interest_shares
    supabase.from("member_interest_shares").select("amount"),
    // Fetch active loans using principal_amount and base_interest_rate from schema
    supabase
      .from("loans")
      .select("id, principal_amount, base_interest_rate, referral_fee_rate")
      .in("status", ["approved", "active", "disbursed", "Approved", "Active"]),
    // Fetch approved payments to subtract principal already paid back
    supabase
      .from("loan_payments")
      .select("loan_id, principal_portion, interest_portion")
      .eq("status", "approved"),
    // Fetch posted monthly loan interest records
    supabase
      .from("loan_interest_payments")
      .select("interest_amount, pool_amount"),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("has_pending_contribution", true),
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

  // 4. Total Interest Earned across Posted Loans
  const activeInterest = (interestPayments ?? []).reduce(
    (sum, i) => sum + Number(i.interest_amount || 0),
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

        {/* Action Queue Badges */}
        <div className="section-title">Pending Approvals</div>
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
            <div className="value">{fmt(activeInterest)}</div>
          </div>
        </div>

        {/* Interest Automation Card */}
        <div className="stat-card" style={{ marginTop: 28, padding: 20 }}>
          <div className="section-title" style={{ margin: "0 0 6px" }}>
            Monthly Interest Distribution
          </div>
          <p style={{ margin: "0 0 16px", color: "var(--text-sub)", fontSize: 13 }}>
            Posts monthly interest across all active loans and distributes earnings by contribution shares.
          </p>
          <PostInterestButton />
        </div>
      </div>
    </div>
  );
}