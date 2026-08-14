"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/utils/supabase/client";
import SignOutButton from "../sign-out-button";
import ReferralShareCard from "@/components/ReferralShareCard";
import OneSignalInit from "@/components/OneSignalInit";
import ThemeToggle from "@/app/theme-toggle";
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
  Bell,
} from "lucide-react";

// Types and Helper function
type Account = {
  id: string;
  account_name: string;
  created_at: string;
};

type Profile = {
  role: string;
  first_name: string;
  last_name: string;
  profile_picture_url: string | null;
  signature_url: string | null;
  referral_code: string | null;
};

interface DashboardClientProps {
  user: any;
  profile: Profile | null;
  accounts: Account[];
  unreadCount: number;
  totalContribution: number;
  interestEarned: number;
  interestPerAccountShare: number;
  currentLoanAmount: number;
  referralBonusEarned: number;
}

function fmt(amount: number) {
  return (amount || 0).toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
  });
}

export default function DashboardClient({
  user,
  profile,
  accounts,
  unreadCount,
  totalContribution,
  interestEarned,
  interestPerAccountShare,
  currentLoanAmount,
  referralBonusEarned,
}: DashboardClientProps) {
  const router = useRouter();
  const supabase = createClient();

  // Enable Realtime Subscriptions to instantly update values on DB mutations
  useEffect(() => {
    const channel = supabase
      .channel("realtime-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "loan_payments" },
        () => {
          router.refresh();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "contributions" },
        () => {
          router.refresh();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "loans" },
        () => {
          router.refresh();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_notifications" },
        () => {
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, router]);

  return (
    <div
      style={{
        minHeight: "100vh",
        paddingBottom: 80,
        background: "var(--bg-main)",
      }}
    >
      <OneSignalInit userId={user?.id} />

      <div
        style={{
          maxWidth: 600,
          margin: "0 auto",
          padding: "16px 16px 24px",
        }}
      >
        {/* =====================================================
            APP TOP HEADER BAR
        ===================================================== */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Image
              src="/icons/logo.png"
              alt="Logo"
              width={36}
              height={36}
              style={{ objectFit: "contain" }}
            />

            <span
              style={{
                fontWeight: 800,
                fontSize: 16,
                letterSpacing: 0.5,
              }}
            >
              HMUK PORTAL
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div style={{ transform: "scale(0.9)" }}>
              <ThemeToggle />
            </div>

            <Link
              href="/notifications"
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 38,
                height: 38,
                borderRadius: "50%",
                background: "var(--bg-card-hover)",
                border: "1px solid var(--border-color)",
                color: "var(--text-main)",
                textDecoration: "none",
              }}
            >
              <Bell size={18} />

              {(unreadCount ?? 0) > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: -2,
                    right: -2,
                    background: "#ef4444",
                    color: "#ffffff",
                    fontSize: 10,
                    fontWeight: 800,
                    borderRadius: "50%",
                    width: 18,
                    height: 18,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "2px solid var(--bg-main)",
                  }}
                >
                  {unreadCount! > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>

            <div style={{ transform: "scale(0.9)" }}>
              <SignOutButton />
            </div>
          </div>
        </div>

        {/* =====================================================
            MEMBER PROFILE HERO CARD
        ===================================================== */}
        <div
          style={{
            background:
              "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
            borderRadius: 20,
            padding: 20,
            color: "#ffffff",
            marginBottom: 24,
            boxShadow: "0 10px 20px -5px rgba(0, 0, 0, 0.3)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
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

              <h1
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  margin: "2px 0",
                }}
              >
                {profile?.first_name} {profile?.last_name}
              </h1>

              <p
                style={{
                  margin: 0,
                  opacity: 0.7,
                  fontSize: 12,
                }}
              >
                {user?.email}
              </p>
            </div>
          </div>
        </div>

        {/* =====================================================
            FINANCIAL OVERVIEW
        ===================================================== */}
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
            {/* TOTAL CONTRIBUTIONS */}
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

              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-sub)",
                  fontWeight: 500,
                }}
              >
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

            {/* INTEREST EARNED */}
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

              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-sub)",
                  fontWeight: 500,
                }}
              >
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

              <div
                style={{
                  fontSize: 10,
                  color: "var(--text-sub)",
                  marginTop: 2,
                }}
              >
                ({fmt(interestPerAccountShare)} per account)
              </div>
            </div>

            {/* LOAN BALANCE */}
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

              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-sub)",
                  fontWeight: 500,
                }}
              >
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

            {/* REFERRAL BONUS */}
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

              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-sub)",
                  fontWeight: 500,
                }}
              >
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

        {/* =====================================================
            QUICK ACTIONS
        ===================================================== */}
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
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: 8,
            }}
          >
            <Link
              href="/dashboard/new-account"
              style={{ textDecoration: "none", textAlign: "center" }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
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
                <PlusCircle size={20} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-sub)" }}>
                + Account
              </span>
            </Link>

            <Link
              href="/dashboard/pay-contribution"
              style={{ textDecoration: "none", textAlign: "center" }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
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
                <PiggyBank size={20} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-sub)" }}>
                Deposit
              </span>
            </Link>

            <Link
              href="/dashboard/apply-loan"
              style={{ textDecoration: "none", textAlign: "center" }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
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
                <FileText size={20} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-sub)" }}>
                Apply Loan
              </span>
            </Link>

            <Link
              href="/dashboard/pay-loan"
              style={{ textDecoration: "none", textAlign: "center" }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
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
                <DollarSign size={20} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-sub)" }}>
                Pay Loan
              </span>
            </Link>

            <Link
              href="/dashboard/history"
              style={{ textDecoration: "none", textAlign: "center" }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
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
                <TrendingUp size={20} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-sub)" }}>
                History
              </span>
            </Link>
          </div>
        </div>

        {/* =====================================================
            REGISTERED ACCOUNTS
        ===================================================== */}
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
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
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

        {/* =====================================================
            REFERRAL PROGRAM
        ===================================================== */}
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

      {/* =======================================================
          FLOATING BOTTOM APP NAV BAR
      ================================================       */}
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