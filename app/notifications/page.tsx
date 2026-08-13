"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

interface NotificationItem {
  id: string;
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

  async function handleOpenNotification(item: NotificationItem) {
    setSelectedNotification(item);
    if (!item.is_read) {
      await markAsRead(item.id);
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
    <div style={{ width: "100%", maxWidth: 600, margin: "0 auto", padding: "16px 12px", color: "#f8fafc", fontFamily: "system-ui, sans-serif", boxSizing: "border-box" }}>
      {/* Header Section */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          marginBottom: 20,
          borderBottom: "1px solid #1e293b",
          paddingBottom: 14,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", width: "100%" }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 2 }}>
              Notifications
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
                padding: "6px 12px",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 500,
                whiteSpace: "nowrap",
              }}
            >
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Content Section */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>
          <p style={{ fontSize: 14 }}>Loading notifications...</p>
        </div>
      ) : items.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "40px 16px",
            background: "#0f172a",
            borderRadius: 14,
            border: "1px dashed #334155",
          }}
        >
          <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 4 }}>No notifications found</p>
          <p style={{ color: "#64748b", fontSize: 12 }}>We'll notify you when something important arrives.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {items.map((item) => {
            const notifType = item.notifications?.type ?? "info";
            return (
              <div
                key={item.id}
                onClick={() => handleOpenNotification(item)}
                style={{
                  padding: "14px 16px",
                  borderRadius: 12,
                  border: "1px solid",
                  borderColor: item.is_read ? "#1e293b" : "#3730a3",
                  background: item.is_read ? "#0f172a88" : "#0f172a",
                  cursor: "pointer",
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                }}
              >
                {/* Unread Indicator Dot */}
                <div style={{ paddingTop: 5 }}>
                  <span
                    style={{
                      display: "block",
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: item.is_read ? "transparent" : "#6366f1",
                      boxShadow: item.is_read ? "none" : "0 0 6px #6366f1",
                    }}
                  />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 4,
                      gap: 8,
                    }}
                  >
                    <h3 style={{ fontWeight: 600, fontSize: 14, color: "#f8fafc", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.notifications?.title ?? "Notification"}
                    </h3>
                    <span style={{ fontSize: 11, color: "#64748b", whiteSpace: "nowrap", flexShrink: 0 }}>
                      {new Date(item.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span
                      style={{
                        fontSize: 9,
                        textTransform: "uppercase",
                        padding: "1px 5px",
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

                  <p
                    style={{
                      color: "#94a3b8",
                      fontSize: 13,
                      margin: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      lineHeight: 1.3,
                    }}
                  >
                    {item.notifications?.message ?? "Tap to view details..."}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Mobile-Optimized Bottom Modal Sheet */}
      {selectedNotification && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(3, 7, 18, 0.8)",
            backdropFilter: "blur(4px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-end", // Bottom aligned for mobile ergonomics
            zIndex: 1000,
          }}
          onClick={() => setSelectedNotification(null)}
        >
          <div
            style={{
              background: "#0f172a",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              border: "1px solid #334155",
              borderBottom: "none",
              padding: "20px 16px 28px 16px",
              width: "100%",
              maxWidth: 600,
              maxHeight: "85vh",
              overflowY: "auto",
              boxSizing: "border-box",
              boxShadow: "0 -10px 25px -5px rgba(0, 0, 0, 0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab handle indicator */}
            <div style={{ width: 36, height: 4, background: "#334155", borderRadius: 2, margin: "0 auto 16px auto" }} />

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 10,
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: 10,
                    textTransform: "uppercase",
                    padding: "2px 6px",
                    borderRadius: 4,
                    background: "#1e293b",
                    color: "#818cf8",
                    fontWeight: 600,
                    letterSpacing: "0.05em",
                    display: "inline-block",
                    marginBottom: 6,
                  }}
                >
                  {selectedNotification.notifications?.type ?? "Notification"}
                </span>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "#f8fafc", margin: 0, lineHeight: 1.3 }}>
                  {selectedNotification.notifications?.title ?? "Notification Details"}
                </h2>
              </div>
              <button
                onClick={() => setSelectedNotification(null)}
                style={{
                  background: "#1e293b",
                  border: "none",
                  borderRadius: "50%",
                  width: 30,
                  height: 30,
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

            <p style={{ fontSize: 11, color: "#64748b", marginBottom: 14 }}>
              {new Date(selectedNotification.created_at).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>

            <div
              style={{
                background: "#1e293b55",
                border: "1px solid #1e293b",
                padding: 14,
                borderRadius: 10,
                color: "#cbd5e1",
                fontSize: 13,
                marginBottom: 20,
                lineHeight: 1.5,
                maxHeight: "40vh",
                overflowY: "auto",
                whiteSpace: "pre-wrap",
              }}
            >
              {selectedNotification.notifications?.message ?? "No text details provided."}
            </div>

            <button
              onClick={() => setSelectedNotification(null)}
              style={{
                width: "100%",
                background: "#1e293b",
                color: "#cbd5e1",
                border: "1px solid #334155",
                borderRadius: 10,
                padding: "12px",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
                textAlign: "center",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}