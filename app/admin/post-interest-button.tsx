"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

function firstOfMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function PostInterestButton() {
  const supabase = createClient();
  const [month, setMonth] = useState(firstOfMonth());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePost() {
    // Confirmation prompt to avoid accidental execution
    const confirmed = window.confirm(
      `Are you sure you want to run interest distribution for ${month}? This action will post records across active loans and member accounts.`
    );
    if (!confirmed) return;

    setLoading(true);
    setMessage(null);
    setError(null);

    const { error } = await supabase.rpc("post_monthly_interest", {
      target_month: month,
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage(`Monthly interest successfully posted for ${month}.`);
    }
    setLoading(false);
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Alert Notifications */}
      {error && (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#ef4444",
            padding: "10px 14px",
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}
      {message && (
        <div
          style={{
            background: "rgba(16, 185, 129, 0.1)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            color: "#10b981",
            padding: "10px 14px",
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          {message}
        </div>
      )}

      {/* Control Input Group */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          gap: 12,
        }}
      >
        <div style={{ flex: 1, minWidth: 200 }}>
          <label
            htmlFor="month"
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-sub)",
              marginBottom: 6,
            }}
          >
            Target Period (First of Month)
          </label>
          <input
            id="month"
            type="date"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid var(--border-color)",
              background: "var(--bg-card-hover)",
              color: "var(--text-main)",
              fontSize: 14,
            }}
          />
        </div>

        <button
          onClick={handlePost}
          disabled={loading}
          className="btn-approve-sm"
          style={{
            padding: "11px 20px",
            fontSize: 13,
            fontWeight: 600,
            whiteSpace: "nowrap",
            height: 42,
          }}
        >
          {loading ? "Posting Interest..." : "Post Monthly Interest"}
        </button>
      </div>
    </div>
  );
}