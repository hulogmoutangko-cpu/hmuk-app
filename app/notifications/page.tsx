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
  } | null;
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
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

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
      // Safely map and parse Supabase response to resolve TypeScript errors
      const formattedItems: NotificationItem[] = data.map((item: any) => ({
        id: item.id,
        is_read: item.is_read,
        created_at: item.created_at,
        notifications: Array.isArray(item.notifications)
          ? item.notifications[0] ?? null
          : item.notifications ?? null,
      }));

      setItems(formattedItems);
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

  async function markAllAsRead() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { error } = await supabase
      .from("user_notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    if (!error) {
      setItems((prev) => prev.map((item) => ({ ...item, is_read: true })));
    }
  }

  const hasUnread = items.some((item) => !item.is_read);

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 24, color: "#fff" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: "bold" }}>Notifications Center</h1>

        {hasUnread && (
          <button
            onClick={markAllAsRead}
            style={{
              background: "transparent",
              color: "#818cf8",
              border: "1px solid #334155",
              borderRadius: 6,
              padding: "6px 12px",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Mark all as read
          </button>
        )}
      </div>

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
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 6,
                }}
              >
                <h3 style={{ fontWeight: "bold", fontSize: 16 }}>
                  {item.notifications?.title ?? "Notification"}
                </h3>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>
                  {new Date(item.created_at).toLocaleDateString()}
                </span>
              </div>
              <p style={{ color: "#cbd5e1", fontSize: 14, marginBottom: 10 }}>
                {item.notifications?.message ?? ""}
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
                    padding: 0,
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