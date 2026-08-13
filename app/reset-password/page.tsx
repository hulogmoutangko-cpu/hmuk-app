"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSessionReady, setIsSessionReady] = useState(false);

  useEffect(() => {
    // 1. Listen for Supabase session establishment from the reset URL token
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "PASSWORD_RECOVERY" || session) {
          setIsSessionReady(true);
          setError(null);
        }
      }
    );

    // 2. Check if a session is already active
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsSessionReady(true);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isSessionReady) {
      setError("Auth session missing! Please click the link in your email again.");
      return;
    }

    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
    } else {
      // Password updated successfully -> redirect to dashboard or login
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "var(--bg-main, #0f172a)",
      }}
    >
      <div
        style={{
          background: "var(--bg-card, #1e293b)",
          border: "1px solid var(--border-color, #334155)",
          borderRadius: 16,
          padding: 28,
          maxWidth: 400,
          width: "100%",
          color: "#ffffff",
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
          Set New Password
        </h1>
        <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 20 }}>
          Enter your new password below.
        </p>

        {error && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#ef4444",
              padding: "10px 14px",
              borderRadius: 8,
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleReset} style={{ display: "grid", gap: 14 }}>
          <div>
            <label
              htmlFor="newPassword"
              style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}
            >
              New Password
            </label>
            <input
              id="newPassword"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid var(--border-color, #334155)",
                background: "var(--bg-card-hover, #0f172a)",
                color: "#ffffff",
                fontSize: 14,
                outline: "none",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !isSessionReady}
            style={{
              width: "100%",
              padding: "12px 0",
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 8,
              background: isSessionReady ? "#10b981" : "#475569",
              color: "#ffffff",
              border: "none",
              cursor: isSessionReady ? "pointer" : "not-allowed",
            }}
          >
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}