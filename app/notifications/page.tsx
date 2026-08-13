"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
    <div style={{ width: "100%", maxWidth: "100%", margin: "0 auto", padding: "12px 10px", color: "#f8fafc", fontFamily: "system-ui, sans-serif", boxSizing: "border-box", overflowX: "hidden" }}>
      
      {/* Navigation / Back to Dashboard Bar */}
      <div style={{ marginBottom: 12 }}>
        <Link
          href="/dashboard"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "#818cf8",
            fontSize: 12,
            fontWeight: 500,
            textDecoration: "none",
            background: "#1e293b66",
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid #1e293b",
          }}
        >
          ← Back to Dashboard
        </Link>
      </div>

      {/* Header Section */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginBottom: 16,
          borderBottom: "1px solid #1e293b",
          paddingBottom: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 2 }}>
              Notifications
            </h1>
            <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>
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
                padding: "6px 10px",
                cursor: "pointer",
                fontSize: 11,
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
          <p style={{ fontSize: 13 }}>Loading notifications...</p>
        </div>
      ) : items.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "32px 16px",
            background: "#0f172a",
            borderRadius: 12,
            border: "1px dashed #334155",
          }}
        >
          <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 4 }}>No notifications found</p>
          <p style={{ color: "#64748b", fontSize: 11 }}>We'll notify you when something important arrives.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {items.map((item) => {
            const notifType = item.notifications?.type ?? "info";
            return (
              <div
                key={item.id}
                onClick={() => handleOpenNotification(item)}
                style={{
                  padding: "12px",
                  borderRadius: 10,
                  border: "1px solid",
                  borderColor: item.is_read ? "#1e293b" : "#3730a3",
                  background: item.is_read ? "#0f172a88" : "#0f172a",
                  cursor: "pointer",
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  width: "100%",
                  boxSizing: "border-box",
                }}
              >
                {/* Unread Indicator Dot */}
                <div style={{ paddingTop: 4 }}>
                  <span
                    style={{
                      display: "block",
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: item.is_read ? "transparent" : "#6366f1",
                      boxShadow: item.is_read ? "none" : "0 0 5px #6366f1",
                    }}
                  />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 4,
                      gap: 6,
                    }}
                  >
                    <h3 style={{ fontWeight: 600, fontSize: 13, color: "#f8fafc", margin: 0, wordBreak: "break-word", lineHeight: 1.3 }}>
                      {item.notifications?.title ?? "Notification"}
                    </h3>
                    <span style={{ fontSize: 10, color: "#64748b", whiteSpace: "nowrap", flexShrink: 0, paddingTop: 1 }}>
                      {new Date(item.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span
                      style={{
                        fontSize: 8,
                        textTransform: "uppercase",
                        padding: "1px 4px",
                        borderRadius: 3,
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
                      fontSize: 12,
                      margin: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      lineHeight: 1.3,
                      wordBreak: "break-word",
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
            alignItems: "flex-end",
            zIndex: 1000,
            margin: 0,
          }}
          onClick={() => setSelectedNotification(null)}
        >
          <div
            style={{
              background: "#0f172a",
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              border: "1px solid #334155",
              borderBottom: "none",
              padding: "16px 14px 24px 14px",
              width: "100%",
              maxWidth: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              boxSizing: "border-box",
              boxShadow: "0 -10px 25px -5px rgba(0, 0, 0, 0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab handle indicator */}
            <div style={{ width: 32, height: 4, background: "#334155", borderRadius: 2, margin: "0 auto 12px auto" }} />

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 8,
                gap: 8,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <span
                  style={{
                    fontSize: 9,
                    textTransform: "uppercase",
                    padding: "2px 5px",
                    borderRadius: 3,
                    background: "#1e293b",
                    color: "#818cf8",
                    fontWeight: 600,
                    letterSpacing: "0.05em",
                    display: "inline-block",
                    marginBottom: 4,
                  }}
                >
                  {selectedNotification.notifications?.type ?? "Notification"}
                </span>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc", margin: 0, lineHeight: 1.3, wordBreak: "break-word" }}>
                  {selectedNotification.notifications?.title ?? "Notification Details"}
                </h2>
              </div>
              <button
                onClick={() => setSelectedNotification(null)}
                style={{
                  background: "#1e293b",
                  border: "none",
                  borderRadius: "50%",
                  width: 28,
                  height: 28,
                  color: "#94a3b8",
                  fontSize: 13,
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

            <p style={{ fontSize: 10, color: "#64748b", marginBottom: 12 }}>
              {new Date(selectedNotification.created_at).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>

            <div
              style={{
                background: "#1e293b55",
                border: "1px solid #1e293b",
                padding: 12,
                borderRadius: 8,
                color: "#cbd5e1",
                fontSize: 12,
                marginBottom: 16,
                lineHeight: 1.4,
                maxHeight: "35vh",
                overflowY: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
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
                borderRadius: 8,
                padding: "10px",
                cursor: "pointer",
                fontSize: 13,
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