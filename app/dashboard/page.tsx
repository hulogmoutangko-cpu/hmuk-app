import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/utils/supabase/server";
import SignOutButton from "../sign-out-button";
import ReferralShareCard from "@/components/ReferralShareCard";
import {
  Wallet,
  TrendingUp,
  CreditCard,
  Gift,
  PlusCircle,
  PiggyBank,
  FileText,
  DollarSign,
  Building,
  Home,
  User,
  LogOut,
} from "lucide-react";

function fmt(amount: number) {
  return (amount || 0).toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
  });
}

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "role, first_name, last_name, profile_picture_url, signature_url, referral_code"
    )
    .eq("id", user.id)
    .single();

  if (profile?.role === "admin") {
    redirect("/admin");
  }

  const { data: accounts } = await supabase
    .from("coop_accounts")
    .select("id, account_name, created_at")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: true });

  const accountIds = (accounts ?? []).map((a) => a.id);

  let totalContribution = 0;
  let interestEarned = 0;
  let currentLoanAmount = 0;
  let referralBonusEarned = 0;

  if (accountIds.length > 0) {
    const [{ data: contributions }, { data: shares }, { data: loans }] =
      await Promise.all([
        supabase
          .from("contributions")
          .select("amount")
          .in("account_id", accountIds)
          .eq("status", "approved"),
        supabase
          .from("member_interest_shares")
          .select("amount")
          .in("account_id", accountIds),
        supabase
          .from("loans")
          .select("id, principal_amount")
          .in("account_id", accountIds)
          .in("status", ["approved", "active", "disbursed", "Approved", "Active"]),
      ]);

    totalContribution = (contributions ?? []).reduce(
      (sum, c) => sum + Number(c.amount || 0),
      0
    );

    interestEarned = (shares ?? []).reduce(
      (sum, s) => sum + Number(s.amount || 0),
      0
    );

    const activeLoanIds = (loans ?? []).map((l) => l.id);
    let totalPrincipalPaid = 0;

    if (activeLoanIds.length > 0) {
      const { data: payments } = await supabase
        .from("loan_payments")
        .select("principal_portion")
        .in("loan_id", activeLoanIds)
        .eq("status", "approved");

      totalPrincipalPaid = (payments ?? []).reduce(
        (sum, p) => sum + Number(p.principal_portion || 0),
        0
      );
    }

    const totalPrincipalIssued = (loans ?? []).reduce(
      (sum, l) => sum + Number(l.principal_amount || 0),
      0
    );

    currentLoanAmount = Math.max(0, totalPrincipalIssued - totalPrincipalPaid);
  }

  // Safe Referral Earnings
  const { data: referredLoans } = await supabase
    .from("loans")
    .select("id")
    .eq("referred_by", user.id);

  const referredLoanIds = (referredLoans ?? []).map((l) => l.id);

  if (referredLoanIds.length > 0) {
    const [{ data: intPayments }, { data: standardPayments }] = await Promise.all([
      supabase
        .from("loan_interest_payments")
        .select("referral_amount")
        .in("loan_id", referredLoanIds),
      supabase
        .from("loan_payments")
        .select("referral_portion, referral_amount")
        .in("loan_id", referredLoanIds)
        .eq("status", "approved"),
    ]);

    const sum1 = (intPayments ?? []).reduce(
      (sum, r) => sum + Number(r.referral_amount || 0),
      0
    );

    const sum2 = (standardPayments ?? []).reduce(
      (sum, r) => sum + Number(r.referral_portion || r.referral_amount || 0),
      0
    );

    referralBonusEarned = sum1 + sum2;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        paddingBottom: 80, // Space for bottom navbar
        background: "var(--bg-main)",
      }}
    >
      <div
        style={{
          maxWidth: 600,
          margin: "0 auto",
          padding: "16px 16px 24px",
        }}
      >
        {/* App Top Header Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Image
              src="/icons/logo.png"
              alt="Logo"
              width={36}
              height={36}
              style={{ objectFit: "contain" }}
            />
            <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: 0.5 }}>
              HMUK PORTAL
            </span>
          </div>

          <div style={{ transform: "scale(0.9)" }}>
            <SignOutButton />
          </div>
        </div>

        {/* Member Profile Hero Card */}
        <div
          style={{
            background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
            borderRadius: 20,
            padding: 20,
            color: "#ffffff",
            marginBottom: 24,
            boxShadow: "0 10px 20px -5px rgba(0, 0, 0, 0.3)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {profile?.profile_picture_url ? (
              <img
                src={profile.profile_picture_url}
                alt="Profile"
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "2px solid rgba(255,255,255,0.2)",
                }}
              />
            ) : (
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 20,
                  border: "2px solid rgba(255,255,255,0.2)",
                }}
              >
                {profile?.first_name ? profile.first_name[0] : "M"}
              </div>
            )}
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  opacity: 0.7,
                  letterSpacing: 1,
                }}
              >
                Member Account
              </div>
              <h1 style={{ fontSize: 20, fontWeight: 700, margin: "2px 0" }}>
                {profile?.first_name} {profile?.last_name}
              </h1>
              <p style={{ margin: 0, opacity: 0.7, fontSize: 12 }}>
                {user.email}
              </p>
            </div>
          </div>
        </div>

        {/* Financial Overview Grid Cards */}
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              marginBottom: 12,
              color: "var(--text-main)",
            }}
          >
            Financial Overview
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            {/* Total Contributions */}
            <div
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                borderRadius: 16,
                padding: 16,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "rgba(59, 130, 246, 0.1)",
                  color: "#3b82f6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 10,
                }}
              >
                <Wallet size={20} />
              </div>
              <div style={{ fontSize: 12, color: "var(--text-sub)", fontWeight: 500 }}>
                Total Contributions
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  marginTop: 4,
                  color: "var(--text-main)",
                }}
              >
                {fmt(totalContribution)}
              </div>
            </div>

            {/* Interest Earned */}
            <div
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                borderRadius: 16,
                padding: 16,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "rgba(16, 185, 129, 0.1)",
                  color: "#10b981",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 10,
                }}
              >
                <TrendingUp size={20} />
              </div>
              <div style={{ fontSize: 12, color: "var(--text-sub)", fontWeight: 500 }}>
                Interest Earned
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  marginTop: 4,
                  color: "var(--text-main)",
                }}
              >
                {fmt(interestEarned)}
              </div>
            </div>

            {/* Active Loan Balance */}
            <div
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                borderRadius: 16,
                padding: 16,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "rgba(245, 158, 11, 0.1)",
                  color: "#f59e0b",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 10,
                }}
              >
                <CreditCard size={20} />
              </div>
              <div style={{ fontSize: 12, color: "var(--text-sub)", fontWeight: 500 }}>
                Loan Balance
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  marginTop: 4,
                  color: "var(--text-main)",
                }}
              >
                {fmt(currentLoanAmount)}
              </div>
            </div>

            {/* Referral Bonus */}
            <div
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                borderRadius: 16,
                padding: 16,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "rgba(168, 85, 247, 0.1)",
                  color: "#a855f7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 10,
                }}
              >
                <Gift size={20} />
              </div>
              <div style={{ fontSize: 12, color: "var(--text-sub)", fontWeight: 500 }}>
                Referral Bonus
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  marginTop: 4,
                  color: "#10b981",
                }}
              >
                {fmt(referralBonusEarned)}
              </div>
            </div>
          </div>
        </div>

        {/* App Action Buttons (Circle Icons) */}
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              marginBottom: 12,
              color: "var(--text-main)",
            }}
          >
            Quick Actions
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 12,
            }}
          >
            <Link
              href="/dashboard/new-account"
              style={{ textDecoration: "none", textAlign: "center" }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  margin: "0 auto 6px",
                  borderRadius: "50%",
                  background: "var(--bg-card-hover)",
                  border: "1px solid var(--border-color)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-main)",
                }}
              >
                <PlusCircle size={22} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-sub)" }}>
                + Account
              </span>
            </Link>

            <Link
              href="/dashboard/pay-contribution"
              style={{ textDecoration: "none", textAlign: "center" }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  margin: "0 auto 6px",
                  borderRadius: "50%",
                  background: "var(--bg-card-hover)",
                  border: "1px solid var(--border-color)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-main)",
                }}
              >
                <PiggyBank size={22} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-sub)" }}>
                Deposit
              </span>
            </Link>

            <Link
              href="/dashboard/apply-loan"
              style={{ textDecoration: "none", textAlign: "center" }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  margin: "0 auto 6px",
                  borderRadius: "50%",
                  background: "var(--bg-card-hover)",
                  border: "1px solid var(--border-color)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-main)",
                }}
              >
                <FileText size={22} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-sub)" }}>
                Apply Loan
              </span>
            </Link>

            <Link
              href="/dashboard/pay-loan"
              style={{ textDecoration: "none", textAlign: "center" }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  margin: "0 auto 6px",
                  borderRadius: "50%",
                  background: "var(--bg-card-hover)",
                  border: "1px solid var(--border-color)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-main)",
                }}
              >
                <DollarSign size={22} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-sub)" }}>
                Pay Loan
              </span>
            </Link>
          </div>
        </div>

        {/* Registered Accounts List */}
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              marginBottom: 12,
              color: "var(--text-main)",
            }}
          >
            Your Co-op Accounts
          </div>

          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: 16,
              overflow: "hidden",
            }}
          >
            {(accounts ?? []).length === 0 ? (
              <div
                style={{
                  padding: 24,
                  textAlign: "center",
                  color: "var(--text-sub)",
                  fontSize: 13,
                }}
              >
                No accounts found. Create your first co-op account above to begin contributing.
              </div>
            ) : (
              (accounts ?? []).map((a, idx) => (
                <div
                  key={a.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 16px",
                    borderBottom:
                      idx < (accounts?.length ?? 0) - 1
                        ? "1px solid var(--border-color)"
                        : "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        background: "var(--bg-card-hover)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--text-main)",
                      }}
                    >
                      <Building size={18} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {a.account_name}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-sub)" }}>
                        Created {new Date(a.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Referral Program Section */}
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              marginBottom: 12,
              color: "var(--text-main)",
            }}
          >
            Referral Program
          </div>
          <ReferralShareCard />
        </div>
      </div>

      {/* Floating Bottom App Nav Bar */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "var(--bg-card)",
          borderTop: "1px solid var(--border-color)",
          padding: "10px 24px",
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
          backdropFilter: "blur(10px)",
          zIndex: 100,
        }}
      >
        <Link
          href="/dashboard"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            textDecoration: "none",
            color: "#3b82f6",
          }}
        >
          <Home size={20} />
          <span style={{ fontSize: 10, fontWeight: 600 }}>Home</span>
        </Link>

        <Link
          href="/dashboard/pay-contribution"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            textDecoration: "none",
            color: "var(--text-sub)",
          }}
        >
          <PiggyBank size={20} />
          <span style={{ fontSize: 10, fontWeight: 600 }}>Savings</span>
        </Link>

        <Link
          href="/dashboard/apply-loan"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            textDecoration: "none",
            color: "var(--text-sub)",
          }}
        >
          <CreditCard size={20} />
          <span style={{ fontSize: 10, fontWeight: 600 }}>Loans</span>
        </Link>
      </div>
    </div>
  );
}