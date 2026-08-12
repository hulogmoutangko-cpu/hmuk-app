"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import AdminNav from "../admin-nav";

type Invitation = {
  id: string;
  code: string;
  is_used: boolean;
  expires_at: string;
  created_at: string;
};

export default function AdminInvitesPage() {
  const supabase = createClient();

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchInvitations = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("invitations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) setError(error.message);
    else setInvitations(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  async function generateInviteCode() {
    setGenerating(true);
    setError(null);
    setMessage(null);

    // Generate random alphanumeric code (e.g. HMUK-7X2P9)
    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
    const code = `HMUK-${randomStr}`;

    // Set 12 hours expiration from current time
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();

    const { error: insertError } = await supabase.from("invitations").insert({
      code,
      expires_at: expiresAt,
      is_used: false,
    });

    if (insertError) {
      setError(insertError.message);
    } else {
      setMessage(`Generated Invite Code: ${code}`);
      await fetchInvitations();
    }
    setGenerating(false);
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setMessage(`Code ${code} copied to clipboard!`);
  }

  return (
    <div>
      <AdminNav />
      <div className="dashboard-container" style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Invite Code Management</h1>
        <p style={{ color: "var(--text-sub)", fontSize: 14, marginBottom: 20 }}>
          Generate single-use invitation codes that expire after 12 hours.
        </p>

        {error && (
          <div style={{ padding: 10, background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", borderRadius: 8, marginBottom: 16 }}>
            {error}
          </div>
        )}
        {message && (
          <div style={{ padding: 10, background: "rgba(16, 185, 129, 0.1)", color: "#10b981", borderRadius: 8, marginBottom: 16 }}>
            {message}
          </div>
        )}

        <button
          onClick={generateInviteCode}
          disabled={generating}
          className="btn-approve-sm"
          style={{ padding: "10px 16px", fontSize: 14, marginBottom: 24 }}
        >
          {generating ? "Generating..." : "+ Generate New 12-Hour Invite Code"}
        </button>

        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, overflow: "hidden" }}>
          <table className="table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Status</th>
                <th>Expires At</th>
                <th style={{ textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: 16 }}>Loading...</td>
                </tr>
              ) : invitations.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: 16, color: "var(--text-sub)" }}>
                    No invitation codes generated yet.
                  </td>
                </tr>
              ) : (
                invitations.map((inv) => {
                  const isExpired = new Date(inv.expires_at) < new Date();
                  return (
                    <tr key={inv.id}>
                      <td style={{ fontWeight: 700, fontFamily: "monospace" }}>{inv.code}</td>
                      <td>
                        {inv.is_used ? (
                          <span className="badge danger">Used</span>
                        ) : isExpired ? (
                          <span className="badge pending">Expired</span>
                        ) : (
                          <span className="badge user">Active</span>
                        )}
                      </td>
                      <td style={{ fontSize: 13, color: "var(--text-sub)" }}>
                        {new Date(inv.expires_at).toLocaleString()}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {!inv.is_used && !isExpired && (
                          <button
                            onClick={() => copyCode(inv.code)}
                            className="btn-secondary-sm"
                          >
                            Copy Code
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}