"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

interface NotificationItem {
  id: string; // user_notifications record ID
  is_read: boolean;
  created_at: string;
  notifications: {
    id: string;
    title: string;
    message: string;
    type: string;
  };
}

export default function NotificationsPage() {
  const supabase = createClient();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  async function fetchNotifications() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    const { data, error } = await supabase
      .from("user_notifications")
      .select(`
        id,
        is_read,
        created_at,
        notifications (
          id,
          title,
          message,
          type
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setItems(data as unknown as NotificationItem[]);
    }
    setLoading(false);
  }

  async function markAsRead(id: string) {
    const { error } = await supabase
      .from("user_notifications")
      .update({ is_read: true })
      .eq("id", id);

    if (!error) {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, is_read: true } : item))
      );
    }
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 24, color: "#fff" }}>
      <h1 style={{ fontSize: 24, fontWeight: "bold", marginBottom: 20 }}>
        Notifications Center
      </h1>

      {loading ? (
        <p style={{ color: "#94a3b8" }}>Loading notifications...</p>
      ) : items.length === 0 ? (
        <p style={{ color: "#94a3b8" }}>No notifications found.</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                padding: 16,
                borderRadius: 10,
                border: "1px solid #334155",
                background: item.is_read ? "#1e293b" : "#0f172a",
                borderLeft: item.is_read ? "1px solid #334155" : "4px solid #6366f1",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <h3 style={{ fontWeight: "bold", fontSize: 16 }}>
                  {item.notifications.title}
                </h3>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>
                  {new Date(item.created_at).toLocaleDateString()}
                </span>
              </div>
              <p style={{ color: "#cbd5e1", fontSize: 14, marginBottom: 10 }}>
                {item.notifications.message}
              </p>
              {!item.is_read && (
                <button
                  onClick={() => markAsRead(item.id)}
                  style={{
                    background: "transparent",
                    color: "#818cf8",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  Mark as Read
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}