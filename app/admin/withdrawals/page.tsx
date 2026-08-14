import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import AdminNav from "./../admin-nav";
import { Users, ArrowRight } from "lucide-react";

export default async function WithdrawalsListPage() {
  const supabase = createClient();
  
  // Fetch all coop accounts so you can pick one
  const { data: accounts, error } = await supabase
    .from("coop_accounts")
    .select("id, account_name, created_at");

  return (
    <div>
      <AdminNav />
      <div style={{ maxWidth: 800, margin: "32px auto", padding: "0 16px" }}>
        <div style={{ marginBottom: 24 }}>
          <span className="badge admin" style={{ marginBottom: 6 }}>PAYOUT & MATURITY</span>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: "4px 0" }}>Member Withdrawals</h1>
          <p style={{ color: "var(--text-sub)", fontSize: 13, margin: 0 }}>
            Select a member account below to process their 12-month contribution and share payout.
          </p>
        </div>

        {error && (
          <div style={{ color: "#ef4444", marginBottom: 16, fontSize: 13 }}>
            Error loading accounts: {error.message}
          </div>
        )}

        <div style={{ display: "grid", gap: 10 }}>
          {accounts?.map((acc) => (
            <Link
              key={acc.id}
              href={`/admin/withdrawals/${acc.id}`}
              style={{
                background: "var(--bg-card)",
                padding: "16px 20px",
                borderRadius: 10,
                border: "1px solid var(--border-color)",
                textDecoration: "none",
                color: "var(--text-main)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                transition: "all 0.2s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ background: "var(--bg-card-hover)", padding: 10, borderRadius: 8, color: "var(--primary)" }}>
                  <Users size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{acc.account_name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-sub)" }}>
                    Opened: {new Date(acc.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--primary)" }}>
                <span>Process Payout</span>
                <ArrowRight size={16} />
              </div>
            </Link>
          ))}

          {accounts?.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, color: "var(--text-sub)", background: "var(--bg-card)", borderRadius: 10 }}>
              No cooperative accounts found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}