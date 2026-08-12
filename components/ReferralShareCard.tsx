"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function ReferralShareCard() {
  const supabase = createClient();

  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalReferred: 0, totalEarned: 0 });

  useEffect(() => {
    async function loadReferralData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // 1. Fetch or create referral code for the logged-in member
      let { data: profile } = await supabase
        .from("profiles")
        .select("referral_code")
        .eq("id", user.id)
        .single();

      if (profile?.referral_code) {
        setReferralCode(profile.referral_code);
      } else {
        // Fallback: Generate code via RPC function if code isn't assigned yet
        const { data: newCode } = await supabase.rpc("get_or_create_referral_code", {
          p_user_id: user.id,
        });
        setReferralCode(newCode);
      }

      // 2. Fetch total count of referred loans
      const { count } = await supabase
        .from("loans")
        .select("id", { count: "exact", head: true })
        .eq("referred_by", user.id);

      setStats((prev) => ({ ...prev, totalReferred: count || 0 }));
      setLoading(false);
    }

    loadReferralData();
  }, [supabase]);

  const shareUrl =
    typeof window !== "undefined" && referralCode
      ? `${window.location.origin}/refer/${referralCode}`
      : "";

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  if (loading) {
    return (
      <div style={cardStyle}>
        <p style={{ color: "var(--text-sub)", margin: 0, fontSize: 13 }}>
          Loading referral details...
        </p>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            display: "inline-block",
            background: "rgba(59, 130, 246, 0.12)",
            color: "#3b82f6",
            fontSize: 11,
            fontWeight: 700,
            padding: "3px 8px",
            borderRadius: 6,
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          Earn Commission
        </div>
        <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800 }}>
          Refer a Borrower
        </h3>
        <p style={{ margin: 0, color: "var(--text-sub)", fontSize: 13 }}>
          Share your unique link with non-members to earn a referral fee on their approved loans.
        </p>
      </div>

      {/* Link Input & Copy Button */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          type="text"
          readOnly
          value={shareUrl}
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid var(--border-color)",
            background: "var(--bg-card-hover)",
            color: "var(--text-main)",
            fontSize: 13,
            outline: "none",
            textOverflow: "ellipsis",
          }}
        />
        <button
          onClick={handleCopy}
          style={{
            padding: "0 16px",
            borderRadius: 8,
            border: "none",
            background: copied ? "#10b981" : "#3b82f6",
            color: "#ffffff",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
            transition: "all 0.2s ease",
            whiteSpace: "nowrap",
          }}
        >
          {copied ? "Copied! ✓" : "Copy Link"}
        </button>
      </div>

      {/* Referral Quick Stats */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: 12,
          borderTop: "1px dashed var(--border-color)",
          fontSize: 12,
          color: "var(--text-sub)",
        }}
      >
        <span>
          Your Code: <strong style={{ color: "var(--text-main)" }}>{referralCode}</strong>
        </span>
        <span>
          Total Referred: <strong style={{ color: "#3b82f6" }}>{stats.totalReferred}</strong>
        </span>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border-color)",
  borderRadius: 16,
  padding: 20,
  maxWidth: 480,
  width: "100%",
  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
};