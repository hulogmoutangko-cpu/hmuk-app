import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  ArrowLeft,
  PiggyBank,
  CreditCard,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
} from "lucide-react";

function fmt(amount: number) {
  return (amount || 0).toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
  });
}

function StatusBadge({ status }: { status: string }) {
  const normalized = (status || "pending").toLowerCase();

  if (normalized === "approved" || normalized === "posted") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "2px 8px",
          borderRadius: 12,
          fontSize: 11,
          fontWeight: 600,
          background: "rgba(16, 185, 129, 0.1)",
          color: "#10b981",
        }}
      >
        <CheckCircle2 size={12} /> Approved
      </span>
    );
  }

  if (normalized === "rejected" || normalized === "declined") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "2px 8px",
          borderRadius: 12,
          fontSize: 11,
          fontWeight: 600,
          background: "rgba(239, 68, 68, 0.1)",
          color: "#ef4444",
        }}
      >
        <XCircle size={12} /> Rejected
      </span>
    );
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 600,
        background: "rgba(245, 158, 11, 0.1)",
        color: "#f59e0b",
      }}
    >
      <Clock size={12} /> Pending
    </span>
  );
}

export default async function HistoryPage() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 1. Fetch user's coop accounts
  const { data: accounts } = await supabase
    .from("coop_accounts")
    .select("id, account_name")
    .eq("profile_id", user.id);

  const accountIds = (accounts ?? []).map((a) => a.id);
  const accountMap = new Map((accounts ?? []).map((a) => [a.id, a.account_name]));

  let contributions: any[] = [];
  let loanPayments: any[] = [];

  if (accountIds.length > 0) {
    // 2. Query contributions with exact schema column names
    const { data: contribData } = await supabase
      .from("contributions")
      .select("id, account_id, amount, status, pay_date, post_date, signature_url")
      .in("account_id", accountIds)
      .order("pay_date", { ascending: false });

    contributions = contribData ?? [];

    // 3. Get user's loans
    const { data: loans } = await supabase
      .from("loans")
      .select("id")
      .in("account_id", accountIds);

    const loanIds = (loans ?? []).map((l) => l.id);

    if (loanIds.length > 0) {
      // 4. Query loan payments
      const { data: paymentData } = await supabase
        .from("loan_payments")
        .select("id, loan_id, amount, status, created_at, receipt_url")
        .in("loan_id", loanIds)
        .order("created_at", { ascending: false });

      loanPayments = paymentData ?? [];
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        paddingBottom: 80,
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
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <Link
            href="/dashboard"
            style={{
              color: "var(--text-main)",
              display: "flex",
              alignItems: "center",
            }}
          >
            <ArrowLeft size={22} />
          </Link>
          <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
            Transaction History
          </h1>
        </div>

        {/* Contributions / Savings Section */}
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 15,
              fontWeight: 700,
              marginBottom: 12,
              color: "var(--text-main)",
            }}
          >
            <PiggyBank size={18} color="#3b82f6" />
            <span>Contributions / Savings</span>
          </div>

          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: 16,
              overflow: "hidden",
            }}
          >
            {contributions.length === 0 ? (
              <div
                style={{
                  padding: 24,
                  textAlign: "center",
                  color: "var(--text-sub)",
                  fontSize: 13,
                }}
              >
                No contribution deposits recorded yet.
              </div>
            ) : (
              contributions.map((c, idx) => (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 16px",
                    borderBottom:
                      idx < contributions.length - 1
                        ? "1px solid var(--border-color)"
                        : "none",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 4,
                      }}
                    >
                      <span style={{ fontWeight: 700, fontSize: 14 }}>
                        {fmt(Number(c.amount))}
                      </span>
                      <StatusBadge status={c.status} />
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-sub)" }}>
                      {accountMap.get(c.account_id) || "Co-op Account"} •{" "}
                      {c.pay_date
                        ? new Date(c.pay_date).toLocaleDateString("en-PH", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "No Date"}
                    </div>
                  </div>

                  {c.signature_url && (
                    <a
                      href={c.signature_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: "#3b82f6",
                        fontSize: 12,
                        fontWeight: 600,
                        textDecoration: "none",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <FileText size={14} /> View File
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Loan Payments Section */}
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 15,
              fontWeight: 700,
              marginBottom: 12,
              color: "var(--text-main)",
            }}
          >
            <CreditCard size={18} color="#f59e0b" />
            <span>Loan Payments</span>
          </div>

          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: 16,
              overflow: "hidden",
            }}
          >
            {loanPayments.length === 0 ? (
              <div
                style={{
                  padding: 24,
                  textAlign: "center",
                  color: "var(--text-sub)",
                  fontSize: 13,
                }}
              >
                No loan payment records found.
              </div>
            ) : (
              loanPayments.map((p, idx) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 16px",
                    borderBottom:
                      idx < loanPayments.length - 1
                        ? "1px solid var(--border-color)"
                        : "none",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 4,
                      }}
                    >
                      <span style={{ fontWeight: 700, fontSize: 14 }}>
                        {fmt(Number(p.amount))}
                      </span>
                      <StatusBadge status={p.status} />
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-sub)" }}>
                      Payment •{" "}
                      {new Date(p.created_at).toLocaleDateString("en-PH", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </div>
                  </div>

                  {p.receipt_url && (
                    <a
                      href={p.receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: "#3b82f6",
                        fontSize: 12,
                        fontWeight: 600,
                        textDecoration: "none",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <FileText size={14} /> Receipt
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}