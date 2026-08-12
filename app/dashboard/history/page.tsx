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
  Calendar,
  Wallet,
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
  let userLoans: any[] = [];
  let loanPaymentsGrouped: Record<string, any[]> = {};

  if (accountIds.length > 0) {
    // 2. Fetch contributions
    const { data: contribData } = await supabase
      .from("contributions")
      .select("id, account_id, amount, status, pay_date, post_date, signature_url")
      .in("account_id", accountIds)
      .order("pay_date", { ascending: false });

    contributions = contribData ?? [];

    // 3. Fetch user's full loan details
    const { data: loans } = await supabase
      .from("loans")
      .select("id, principal_amount, balance, start_date, due_date, status")
      .in("account_id", accountIds)
      .order("created_at", { ascending: false });

    userLoans = loans ?? [];
    const loanIds = userLoans.map((l) => l.id);

    if (loanIds.length > 0) {
      // 4. Query loan payments
      const { data: paymentData } = await supabase
        .from("loan_payments")
        .select("id, loan_id, total_amount, principal_portion, interest_portion, status, pay_date, signature_url")
        .in("loan_id", loanIds)
        .order("pay_date", { ascending: false });

      // Group payments by loan_id
      (paymentData ?? []).forEach((payment) => {
        if (!loanPaymentsGrouped[payment.loan_id]) {
          loanPaymentsGrouped[payment.loan_id] = [];
        }
        loanPaymentsGrouped[payment.loan_id].push(payment);
      });
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

        {/* Loans & Payments Section */}
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
            <span>Loans & Payments</span>
          </div>

          {userLoans.length === 0 ? (
            <div
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                borderRadius: 16,
                padding: 24,
                textAlign: "center",
                color: "var(--text-sub)",
                fontSize: 13,
              }}
            >
              No active or past loans found.
            </div>
          ) : (
            userLoans.map((loan) => {
              const payments = loanPaymentsGrouped[loan.id] || [];

              return (
                <div
                  key={loan.id}
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-color)",
                    borderRadius: 16,
                    overflow: "hidden",
                    marginBottom: 16,
                  }}
                >
                  {/* Loan Header Card Summary */}
                  <div
                    style={{
                      padding: "16px",
                      background: "rgba(245, 158, 11, 0.05)",
                      borderBottom: "1px solid var(--border-color)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 12,
                      }}
                    >
                      <div>
                        <span style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-sub)", letterSpacing: 0.5 }}>
                          Loan Amount
                        </span>
                        <div style={{ fontSize: 18, fontWeight: 800 }}>
                          {fmt(Number(loan.principal_amount))}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-sub)", letterSpacing: 0.5 }}>
                          Remaining Balance
                        </span>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "#f59e0b" }}>
                          {fmt(Number(loan.balance))}
                        </div>
                      </div>
                    </div>

                    {/* Loan Dates */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                        fontSize: 12,
                        color: "var(--text-sub)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Calendar size={13} />
                        <span>
                          Loan Date:{" "}
                          <strong>
                            {loan.start_date
                              ? new Date(loan.start_date).toLocaleDateString("en-PH", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : "N/A"}
                          </strong>
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Clock size={13} />
                        <span>
                          Due:{" "}
                          <strong>
                            {loan.due_date
                              ? new Date(loan.due_date).toLocaleDateString("en-PH", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : "N/A"}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Loan Payments Sub-list */}
                  <div>
                    <div
                      style={{
                        padding: "10px 16px",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "var(--text-sub)",
                        background: "rgba(0, 0, 0, 0.02)",
                        borderBottom: "1px solid var(--border-color)",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Wallet size={14} />
                      <span>Payment History ({payments.length})</span>
                    </div>

                    {payments.length === 0 ? (
                      <div
                        style={{
                          padding: 16,
                          textAlign: "center",
                          color: "var(--text-sub)",
                          fontSize: 12,
                        }}
                      >
                        No payment records submitted for this loan yet.
                      </div>
                    ) : (
                      payments.map((p, idx) => (
                        <div
                          key={p.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "12px 16px",
                            borderBottom:
                              idx < payments.length - 1
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
                                marginBottom: 2,
                              }}
                            >
                              <span style={{ fontWeight: 700, fontSize: 14 }}>
                                {fmt(Number(p.total_amount))}
                              </span>
                              <StatusBadge status={p.status} />
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-sub)" }}>
                              Paid on:{" "}
                              {p.pay_date
                                ? new Date(p.pay_date).toLocaleDateString("en-PH", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })
                                : "No Date"}
                            </div>
                          </div>

                          {p.signature_url && (
                            <a
                              href={p.signature_url}
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
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}