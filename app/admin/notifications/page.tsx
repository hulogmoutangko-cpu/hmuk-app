"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

interface Profile {
  id: string;
  email: string;
  full_name?: string;
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
    // Fetch profiles for selective sending
    supabase
      .from("profiles")
      .select("id, email, full_name")
      .then(({ data }) => {
        if (data) setProfiles(data);
      });
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
      // 1. Insert global notification record
      const { data: notif, error: notifErr } = await supabase
        .from("notifications")
        .insert({ title, message, type, target_type: targetType })
        .select()
        .single();

      if (notifErr || !notif) throw notifErr;

      // 2. Determine target user list
      let recipientIds: string[] = [];

      if (targetType === "all") {
        recipientIds = profiles.map((p) => p.id);
      } else {
        recipientIds = selectedUserIds;
      }

      // 3. Insert notification receipt records for each targeted user in Supabase
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

      // 4. Dispatch System Web Push Notification via OneSignal
      try {
        await fetch("https://onesignal.com/api/v1/notifications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${process.env.NEXT_PUBLIC_ONESIGNAL_REST_KEY || ""}`,
          },
          body: JSON.stringify({
            app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
            headings: { en: title },
            contents: { en: message },
            // Target selected users via External ID (linked via OneSignal.login) or broadcast to all
            ...(targetType === "selected"
              ? { include_aliases: { external_id: recipientIds }, target_channel: "push" }
              : { included_segments: ["Total Subscriptions"] }),
          }),
        });
      } catch (pushErr) {
        console.error("In-app saved, but Web Push dispatch failed:", pushErr);
      }

      alert("Notification dispatched successfully!");
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
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 24, color: "#fff" }}>
      <h1 style={{ fontSize: 22, fontWeight: "bold", marginBottom: 16 }}>
        Send Notification
      </h1>

      <form onSubmit={handleSend} style={{ display: "grid", gap: 16 }}>
        <div>
          <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
            Target Audience
          </label>
          <select
            value={targetType}
            onChange={(e) =>
              setTargetType(e.target.value as "all" | "selected")
            }
            style={{
              width: "100%",
              padding: 10,
              background: "#1e293b",
              color: "#fff",
              borderRadius: 6,
            }}
          >
            <option value="all">All Members ({profiles.length})</option>
            <option value="selected">Select Specific Profiles</option>
          </select>
        </div>

        {targetType === "selected" && (
          <div
            style={{
              maxHeight: 180,
              overflowY: "auto",
              border: "1px solid #334155",
              padding: 10,
              borderRadius: 6,
            }}
          >
            {profiles.map((p) => (
              <label
                key={p.id}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedUserIds.includes(p.id)}
                  onChange={() => handleSelectUser(p.id)}
                />
                <span style={{ fontSize: 13 }}>{p.full_name || p.email}</span>
              </label>
            ))}
          </div>
        )}

        <div>
          <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
            Title
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              width: "100%",
              padding: 10,
              background: "#1e293b",
              color: "#fff",
              borderRadius: 6,
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
            Message
          </label>
          <textarea
            required
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            style={{
              width: "100%",
              padding: 10,
              background: "#1e293b",
              color: "#fff",
              borderRadius: 6,
            }}
          />
        </div>

        <button
          type="submit"
          disabled={
            loading || (targetType === "selected" && selectedUserIds.length === 0)
          }
          style={{
            padding: 12,
            background: "#6366f1",
            color: "#fff",
            fontWeight: "bold",
            borderRadius: 6,
            border: "none",
            cursor: "pointer",
          }}
        >
          {loading ? "Dispatching..." : "Send Notification"}
        </button>
      </form>
    </div>
  );
}