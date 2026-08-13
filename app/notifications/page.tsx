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
  const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null);

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
      if (selectedNotification?.id === id) {
        setSelectedNotification((prev) => (prev ? { ...prev, is_read: true } : null));
      }
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

  const unreadCount = items.filter((item) => !item.is_read).length;

  return (
    <div style={{ maxWidth: 840, margin: "0 auto", padding: "32px 20px", color: "#f8fafc", fontFamily: "system-ui, sans-serif" }}>
      {/* Header Section */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 28,
          borderBottom: "1px solid #1e293b",
          paddingBottom: 16,
        }}
      >
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 4 }}>
            Notifications Center
          </h1>
          <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>
            {unreadCount > 0 ? `You have ${unreadCount} unread message${unreadCount > 1 ? 's' : ''}` : "You're all caught up!"}
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            style={{
              background: "#1e293b",
              color: "#a5b4fc",
              border: "1px solid #334155",
              borderRadius: 8,
              padding: "8px 14px",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
              transition: "background 0.2s",
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = "#334155")}
            onMouseOut={(e) => (e.currentTarget.style.background = "#1e293b")}
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Content Section */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#64748b" }}>
          <p style={{ fontSize: 14 }}>Loading your notifications...</p>
        </div>
      ) : items.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            background: "#0f172a",
            borderRadius: 16,
            border: "1px dashed #334155",
          }}
        >
          <p style={{ color: "#94a3b8", fontSize: 15, marginBottom: 4 }}>No notifications found</p>
          <p style={{ color: "#64748b", fontSize: 13 }}>We'll notify you when something important arrives.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {items.map((item) => {
            const notifType = item.notifications?.type ?? "info";
            return (
              <div
                key={item.id}
                onClick={() => setSelectedNotification(item)}
                style={{
                  padding: "18px 20px",
                  borderRadius: 12,
                  border: "1px solid",
                  borderColor: item.is_read ? "#1e293b" : "#3730a3",
                  background: item.is_read ? "#0f172a88" : "#0f172a",
                  boxShadow: item.is_read ? "none" : "0 4px 20px -2px rgba(99, 102, 241, 0.15)",
                  cursor: "pointer",
                  display: "flex",
                  gap: 16,
                  alignItems: "flex-start",
                  transition: "transform 0.15s ease, border-color 0.15s ease",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.borderColor = item.is_read ? "#334155" : "#6366f1";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.borderColor = item.is_read ? "#1e293b" : "#3730a3";
                }}
              >
                {/* Unread Indicator Dot */}
                <div style={{ paddingTop: 6 }}>
                  <span
                    style={{
                      display: "block",
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: item.is_read ? "transparent" : "#6366f1",
                      boxShadow: item.is_read ? "none" : "0 0 8px #6366f1",
                    }}
                  />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 6,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <h3 style={{ fontWeight: 600, fontSize: 15, color: "#f8fafc", margin: 0 }}>
                        {item.notifications?.title ?? "Notification"}
                      </h3>
                      <span
                        style={{
                          fontSize: 10,
                          textTransform: "uppercase",
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: "#1e293b",
                          color: "#94a3b8",
                          fontWeight: 600,
                          letterSpacing: "0.05em",
                        }}
                      >
                        {notifType}
                      </span>
                    </div>
                    <span style={{ fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>
                      {new Date(item.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <p
                    style={{
                      color: "#94a3b8",
                      fontSize: 13,
                      margin: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      lineHeight: 1.4,
                    }}
                  >
                    {item.notifications?.message ?? "Click to inspect details..."}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modern Modal Overlay */}
      {selectedNotification && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(3, 7, 18, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setSelectedNotification(null)}
        >
          <div
            style={{
              background: "#0f172a",
              borderRadius: 16,
              padding: 28,
              width: "100%",
              maxWidth: 520,
              border: "1px solid #334155",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)",
              animation: "fadeIn 0.2s ease-out",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 14,
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: 11,
                    textTransform: "uppercase",
                    padding: "2px 8px",
                    borderRadius: 4,
                    background: "#1e293b",
                    color: "#818cf8",
                    fontWeight: 600,
                    letterSpacing: "0.05em",
                    display: "inline-block",
                    marginBottom: 8,
                  }}
                >
                  {selectedNotification.notifications?.type ?? "Notification"}
                </span>
                <h2 style={{ fontSize: 19, fontWeight: 700, color: "#f8fafc", margin: 0, lineHeight: 1.3 }}>
                  {selectedNotification.notifications?.title ?? "Notification Details"}
                </h2>
              </div>
              <button
                onClick={() => setSelectedNotification(null)}
                style={{
                  background: "#1e293b",
                  border: "none",
                  borderRadius: "50%",
                  width: 32,
                  height: 32,
                  color: "#94a3b8",
                  fontSize: 14,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: 12, color: "#64748b", marginBottom: 18 }}>
              Received on {new Date(selectedNotification.created_at).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>

            <div
              style={{
                background: "#1e293b66",
                border: "1px solid #1e293b",
                padding: 16,
                borderRadius: 10,
                color: "#cbd5e1",
                fontSize: 14,
                marginBottom: 24,
                lineHeight: 1.6,
                maxHeight: 280,
                overflowY: "auto",
                whiteSpace: "pre-wrap",
              }}
            >
              {selectedNotification.notifications?.message ?? "No text details provided for this entry."}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, borderTop: "1px solid #1e293b", paddingTop: 16 }}>
              {!selectedNotification.is_read && (
                <button
                  onClick={() => markAsRead(selectedNotification.id)}
                  style={{
                    background: "#6366f1",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "9px 18px",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                    boxShadow: "0 2px 10px rgba(99, 102, 241, 0.4)",
                  }}
                >
                  Mark as Read
                </button>
              )}
              <button
                onClick={() => setSelectedNotification(null)}
                style={{
                  background: "#1e293b",
                  color: "#cbd5e1",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  padding: "9px 18px",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}