"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

export default function NewAccountPage() {
  const router = useRouter();
  const supabase = createClient();

  const [accountName, setAccountName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = accountName.trim();
    if (!trimmedName) {
      setError("Please provide a valid account name.");
      return;
    }

    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    // Inserts into coop_accounts table using schema: profile_id, account_name
    const { error: insertError } = await supabase.from("coop_accounts").insert({
      profile_id: user.id,
      account_name: trimmedName,
    });

    if (insertError) {
      if (insertError.message.toLowerCase().includes("row-level security")) {
        setError(
          "You've reached your maximum allowed accounts. Please contact an admin to increase your limit."
        );
      } else {
        setError(insertError.message);
      }
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        background: "var(--bg-main)",
      }}
    >
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-color)",
          borderRadius: 16,
          padding: 28,
          maxWidth: 440,
          width: "100%",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.12)",
        }}
      >
        {/* Navigation Link */}
        <Link
          href="/dashboard"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-sub)",
            textDecoration: "none",
            marginBottom: 20,
          }}
        >
          ← Back to Dashboard
        </Link>

        {/* Header Title */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>
            Create Co-op Account
          </h1>
          <p style={{ margin: 0, color: "var(--text-sub)", fontSize: 13.5 }}>
            Assign a label to help organize your contributions and earnings.
          </p>
        </div>

        {/* Alert Notification */}
        {error && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#ef4444",
              padding: "10px 14px",
              borderRadius: 8,
              fontSize: 13,
              marginBottom: 18,
            }}
          >
            {error}
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
          <div>
            <label
              htmlFor="accountName"
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-sub)",
                marginBottom: 6,
              }}
            >
              Account Name
            </label>
            <input
              id="accountName"
              type="text"
              required
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="e.g. Primary Savings, Family Fund"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid var(--border-color)",
                background: "var(--bg-card-hover)",
                color: "var(--text-main)",
                fontSize: 14,
                outline: "none",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-approve-sm"
            style={{
              width: "100%",
              padding: "12px 0",
              fontSize: 14,
              fontWeight: 600,
              marginTop: 4,
              height: 44,
            }}
          >
            {loading ? "Creating Account..." : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}