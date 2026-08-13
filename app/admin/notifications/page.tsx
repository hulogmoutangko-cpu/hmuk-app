"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

interface Profile {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role?: string;
}

export default function AdminSendNotification() {
  const supabase = createClient();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [targetType, setTargetType] = useState<"all" | "selected">("all");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("info");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchProfiles() {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name, role")
        .neq("role", "admin");

      if (error) {
        console.error("Error fetching profiles:", error.message);
        return;
      }

      if (data) {
        setProfiles(data);
      }
    }

    fetchProfiles();
  }, [supabase]);

  function handleSelectUser(userId: string) {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: notif, error: notifErr } = await supabase
        .from("notifications")
        .insert({ title, message, type, target_type: targetType })
        .select()
        .single();

      if (notifErr || !notif) throw notifErr;

      let recipientIds: string[] = [];
      if (targetType === "all") {
        recipientIds = profiles.map((p) => p.id);
      } else {
        recipientIds = selectedUserIds;
      }

      if (recipientIds.length > 0) {
        const userNotifs = recipientIds.map((userId) => ({
          notification_id: notif.id,
          user_id: userId,
          is_read: false,
        }));

        const { error: userNotifErr } = await supabase
          .from("user_notifications")
          .insert(userNotifs);

        if (userNotifErr) throw userNotifErr;
      }

      let pushWarning: string | null = null;
      try {
        const pushRes = await fetch("/api/send-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, message, targetType, recipientIds }),
        });

        if (!pushRes.ok) {
          const errData = await pushRes.json().catch(() => null);
          console.error("Push dispatch failed:", JSON.stringify(errData, null, 2));
          pushWarning = "Notification saved, but push failed to send.";
        }
      } catch (pushErr) {
        console.error("OneSignal push error:", pushErr);
        pushWarning = "Notification saved, but push failed to send.";
      }

      alert(pushWarning ?? "Notification dispatched successfully!");
      setTitle("");
      setMessage("");
      setSelectedUserIds([]);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to send notification.";
      alert(errorMsg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px", color: "#f8fafc", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ marginBottom: 24, borderBottom: "1px solid #1e293b", paddingBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 4 }}>
          Send Notification
        </h1>
        <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>
          Broadcast alerts or announcements directly to member accounts.
        </p>
      </div>

      <form onSubmit={handleSend} style={{ display: "grid", gap: 20 }}>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "#cbd5e1" }}>
            Target Audience
          </label>
          <select
            value={targetType}
            onChange={(e) => setTargetType(e.target.value as "all" | "selected")}
            style={{
              width: "100%",
              padding: "10px 12px",
              background: "#0f172a",
              color: "#fff",
              border: "1px solid #334155",
              borderRadius: 8,
              fontSize: 14,
            }}
          >
            <option value="all">All Members ({profiles.length})</option>
            <option value="selected">Select Specific Profiles</option>
          </select>
        </div>

        {targetType === "selected" && (
          <div
            style={{
              maxHeight: 200,
              overflowY: "auto",
              border: "1px solid #334155",
              padding: 12,
              borderRadius: 8,
              background: "#0f172a",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4, fontWeight: 600 }}>
              Select Recipients ({selectedUserIds.length} selected)
            </div>
            {profiles.map((p) => {
              const displayName =
                p.first_name || p.last_name
                  ? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim()
                  : p.email;

              return (
                <label
                  key={p.id}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    cursor: "pointer",
                    fontSize: 13,
                    color: "#e2e8f0",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedUserIds.includes(p.id)}
                    onChange={() => handleSelectUser(p.id)}
                    style={{ accentColor: "#6366f1", width: 16, height: 16 }}
                  />
                  <span>{displayName} <span style={{ color: "#64748b" }}>({p.email})</span></span>
                </label>
              );
            })}
          </div>
        )}

        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "#cbd5e1" }}>
            Notification Type
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              background: "#0f172a",
              color: "#fff",
              border: "1px solid #334155",
              borderRadius: 8,
              fontSize: 14,
            }}
          >
            <option value="info">Info / General</option>
            <option value="warning">Warning / Alert</option>
            <option value="update">System Update</option>
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "#cbd5e1" }}>
            Title
          </label>
          <input
            type="text"
            required
            placeholder="e.g., Scheduled Maintenance Update"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              background: "#0f172a",
              color: "#fff",
              border: "1px solid #334155",
              borderRadius: 8,
              fontSize: 14,
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "#cbd5e1" }}>
            Message Content
          </label>
          <textarea
            required
            rows={4}
            placeholder="Type your notification message here..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              background: "#0f172a",
              color: "#fff",
              border: "1px solid #334155",
              borderRadius: 8,
              fontSize: 14,
              resize: "vertical",
            }}
          />
        </div>

        <button
          type="submit"
          disabled={
            loading || (targetType === "selected" && selectedUserIds.length === 0)
          }
          style={{
            padding: "12px 20px",
            background: loading || (targetType === "selected" && selectedUserIds.length === 0) ? "#334155" : "#6366f1",
            color: "#fff",
            fontWeight: 600,
            borderRadius: 8,
            border: "none",
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: 14,
            boxShadow: "0 2px 10px rgba(99, 102, 241, 0.3)",
            transition: "background 0.2s",
          }}
        >
          {loading ? "Dispatching Broadcast..." : "Send Notification"}
        </button>
      </form>
    </div>
  );
}