"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Bell, ArrowLeft, Check, X, Info } from "lucide-react";

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
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-main)",
        color: "var(--text-main)",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 600,
          margin: "0 auto",
          padding: "16px",
          boxSizing: "border-box",
        }}
      >
        {/* Navigation / Back to Dashboard Bar */}
        <div style={{ marginBottom: 20 }}>
          <Link
            href="/dashboard"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: "var(--text-main)",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              background: "var(--bg-card)",
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--border-color)",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            }}
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </Link>
        </div>

        {/* Header Section */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
            paddingBottom: 16,
            borderBottom: "1px solid var(--border-color)",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 700,
                margin: "0 0 4px 0",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Bell size={24} color="#3b82f6" />
              Notifications
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-sub)", margin: 0 }}>
              {unreadCount > 0
                ? `You have ${unreadCount} unread message${unreadCount > 1 ? "s" : ""}`
                : "You're all caught up!"}
            </p>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              style={{
                background: "var(--bg-card-hover)",
                color: "var(--text-main)",
                border: "1px solid var(--border-color)",
                borderRadius: 8,
                padding: "8px 12px",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.2s",
              }}
            >
              <Check size={14} />
              Mark all read
            </button>
          )}
        </div>

        {/* Content Section */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-sub)" }}>
            <p style={{ fontSize: 14, fontWeight: 500 }}>Loading notifications...</p>
          </div>
        ) : items.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "48px 24px",
              background: "var(--bg-card)",
              borderRadius: 16,
              border: "1px dashed var(--border-color)",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "var(--bg-card-hover)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
                color: "var(--text-sub)",
              }}
            >
              <Bell size={24} />
            </div>
            <p style={{ color: "var(--text-main)", fontSize: 16, fontWeight: 600, margin: "0 0 8px 0" }}>
              No notifications yet
            </p>
            <p style={{ color: "var(--text-sub)", fontSize: 13, margin: 0 }}>
              We'll notify you when something important arrives.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {items.map((item) => {
              const notifType = item.notifications?.type ?? "info";
              return (
                <div
                  key={item.id}
                  onClick={() => handleOpenNotification(item)}
                  style={{
                    padding: "16px",
                    borderRadius: 12,
                    border: "1px solid",
                    borderColor: item.is_read ? "var(--border-color)" : "#3b82f6",
                    background: item.is_read ? "var(--bg-card)" : "rgba(59, 130, 246, 0.05)",
                    cursor: "pointer",
                    display: "flex",
                    gap: 14,
                    alignItems: "flex-start",
                    width: "100%",
                    boxSizing: "border-box",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
                    transition: "transform 0.1s",
                  }}
                >
                  {/* Icon / Unread Indicator */}
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: item.is_read ? "var(--bg-card-hover)" : "#3b82f6",
                      color: item.is_read ? "var(--text-sub)" : "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Info size={18} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: 6,
                        gap: 8,
                      }}
                    >
                      <h3
                        style={{
                          fontWeight: item.is_read ? 600 : 700,
                          fontSize: 15,
                          color: "var(--text-main)",
                          margin: 0,
                          wordBreak: "break-word",
                          lineHeight: 1.3,
                        }}
                      >
                        {item.notifications?.title ?? "Notification"}
                      </h3>
                      <span
                        style={{
                          fontSize: 11,
                          color: "var(--text-sub)",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        {new Date(item.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>

                    <p
                      style={{
                        color: "var(--text-sub)",
                        fontSize: 13,
                        margin: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        lineHeight: 1.4,
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

        {/* =====================================================
            CENTERED POPUP MODAL (Replaces Bottom Sheet)
        ===================================================== */}
        {selectedNotification && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              background: "rgba(0, 0, 0, 0.6)",
              backdropFilter: "blur(4px)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 9999,
              padding: 20,
              boxSizing: "border-box",
            }}
            onClick={() => setSelectedNotification(null)}
          >
            <div
              style={{
                background: "var(--bg-card)",
                borderRadius: 20,
                border: "1px solid var(--border-color)",
                padding: "24px",
                width: "100%",
                maxWidth: 400,
                maxHeight: "85vh",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 16,
                  gap: 12,
                }}
              >
                <div style={{ flex: 1 }}>
                  <span
                    style={{
                      fontSize: 10,
                      textTransform: "uppercase",
                      padding: "4px 8px",
                      borderRadius: 6,
                      background: "rgba(59, 130, 246, 0.1)",
                      color: "#3b82f6",
                      fontWeight: 700,
                      letterSpacing: "0.05em",
                      display: "inline-block",
                      marginBottom: 8,
                    }}
                  >
                    {selectedNotification.notifications?.type ?? "Notification"}
                  </span>
                  <h2
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: "var(--text-main)",
                      margin: 0,
                      lineHeight: 1.3,
                      wordBreak: "break-word",
                    }}
                  >
                    {selectedNotification.notifications?.title ?? "Notification Details"}
                  </h2>
                </div>

                <button
                  onClick={() => setSelectedNotification(null)}
                  style={{
                    background: "var(--bg-card-hover)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "50%",
                    width: 32,
                    height: 32,
                    color: "var(--text-sub)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    transition: "all 0.2s",
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Timestamp */}
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-sub)",
                  marginBottom: 16,
                  paddingBottom: 16,
                  borderBottom: "1px solid var(--border-color)",
                }}
              >
                {new Date(selectedNotification.created_at).toLocaleString(undefined, {
                  dateStyle: "full",
                  timeStyle: "short",
                })}
              </div>

              {/* Message Body */}
              <div
                style={{
                  color: "var(--text-main)",
                  fontSize: 14,
                  lineHeight: 1.6,
                  marginBottom: 24,
                  overflowY: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {selectedNotification.notifications?.message ?? "No text details provided."}
              </div>

              {/* Close Button */}
              <button
                onClick={() => setSelectedNotification(null)}
                style={{
                  width: "100%",
                  background: "#3b82f6",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 10,
                  padding: "14px",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                  textAlign: "center",
                  transition: "background 0.2s",
                  marginTop: "auto",
                }}
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}