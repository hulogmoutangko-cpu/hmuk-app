import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import AdminNav from "../admin-nav";

export default async function AdminMembersPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (me?.role !== "admin") {
    redirect("/dashboard");
  }

  const { data: members } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email, role, referral_code, created_at")
    .order("created_at", { ascending: false });

  return (
    <div>
      {/* Shared Admin Top Navigation */}
      <AdminNav email={user.email} />

      <div className="dashboard-container">
        {/* Back Link */}
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
            Member Directory
          </h1>
          <p style={{ margin: 0, color: "var(--text-sub)", fontSize: 13 }}>
            {members?.length ?? 0} registered members.
          </p>
        </div>

        {/* Desktop View: Full Table */}
        <div className="desktop-table-view">
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Referral Code</th>
                  <th>Joined Date</th>
                </tr>
              </thead>
              <tbody>
                {(members ?? []).map((m) => {
                  const fullName =
                    [m.first_name, m.last_name].filter(Boolean).join(" ") || "—";
                  const initial = (m.first_name?.[0] || m.email?.[0] || "M").toUpperCase();

                  return (
                    <tr key={m.id}>
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
                          <span style={{ fontWeight: 600 }}>{fullName}</span>
                        </div>
                      </td>
                      <td style={{ color: "var(--text-sub)" }}>{m.email}</td>
                      <td>
                        <span className={`badge ${m.role === "admin" ? "admin" : "user"}`}>
                          {m.role || "member"}
                        </span>
                      </td>
                      <td>
                        <code
                          style={{
                            background: "var(--bg-card-hover)",
                            padding: "3px 8px",
                            borderRadius: 6,
                            fontSize: 12,
                            border: "1px solid var(--border-color)",
                          }}
                        >
                          {m.referral_code ?? "—"}
                        </code>
                      </td>
                      <td style={{ color: "var(--text-sub)", fontSize: 13 }}>
                        {m.created_at
                          ? new Date(m.created_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile View: Card List */}
        <div className="mobile-card-list">
          {(members ?? []).map((m) => {
            const fullName =
              [m.first_name, m.last_name].filter(Boolean).join(" ") || "Unnamed Member";
            const initial = (m.first_name?.[0] || m.email?.[0] || "M").toUpperCase();

            return (
              <div key={m.id} className="mobile-member-card">
                <div className="mobile-member-header">
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{fullName}</div>
                      <div style={{ fontSize: 12, color: "var(--text-sub)" }}>{m.email}</div>
                    </div>
                  </div>
                  <span className={`badge ${m.role === "admin" ? "admin" : "user"}`}>
                    {m.role || "member"}
                  </span>
                </div>

                <div className="mobile-member-details">
                  <div className="detail-row">
                    <span>Referral Code</span>
                    <code
                      style={{
                        background: "var(--bg-card-hover)",
                        padding: "2px 6px",
                        borderRadius: 4,
                        fontSize: 12,
                        border: "1px solid var(--border-color)",
                      }}
                    >
                      {m.referral_code ?? "—"}
                    </code>
                  </div>
                  <div className="detail-row">
                    <span>Joined Date</span>
                    <span style={{ color: "var(--text-main)" }}>
                      {m.created_at
                        ? new Date(m.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}