"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

interface Profile {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role?: string;
}

type TargetType = "all" | "selected";
type NotificationType = "info" | "warning" | "update";

const MAX_TITLE_LENGTH = 80;
const MAX_MESSAGE_LENGTH = 500;

const navItems = [
  { label: "Dashboard", href: "/admin", icon: "⌂" },
  { label: "Contributions", href: "/admin/contributions", icon: "◈" },
  { label: "Database", href: "/admin/database", icon: "▦" },
  { label: "Invites", href: "/admin/invites", icon: "✉" },
  { label: "Loan Payments", href: "/admin/loan-payments", icon: "₱" },
  { label: "Loans", href: "/admin/loans", icon: "▤" },
  { label: "Members", href: "/admin/members", icon: "♙" },
  { label: "Notifications", href: "/admin/notifications", icon: "♢" },
  { label: "Settings", href: "/admin/settings", icon: "⚙" },
];

const notificationTypes: {
  value: NotificationType;
  label: string;
  description: string;
  icon: string;
}[] = [
  {
    value: "info",
    label: "Information",
    description: "General announcements and updates",
    icon: "i",
  },
  {
    value: "warning",
    label: "Alert",
    description: "Important notices requiring attention",
    icon: "!",
  },
  {
    value: "update",
    label: "System Update",
    description: "Changes, maintenance, or new features",
    icon: "↻",
  },
];

export default function AdminNotificationsPage() {
  const supabase = createClient();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [targetType, setTargetType] = useState<TargetType>("all");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] =
    useState<NotificationType>("info");

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<
    | {
        type: "success" | "error" | "warning";
        message: string;
      }
    | null
  >(null);

  const [mobileNavOpen, setMobileNavOpen] =
    useState(false);

  useEffect(() => {
    async function fetchProfiles() {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, email, first_name, last_name, role"
        )
        .neq("role", "admin")
        .order("first_name", {
          ascending: true,
        });

      if (error) {
        console.error(
          "Error fetching profiles:",
          error.message
        );

        setStatus({
          type: "error",
          message:
            "Unable to load member profiles.",
        });

        return;
      }

      if (data) {
        setProfiles(data);
      }
    }

    fetchProfiles();
  }, [supabase]);

  const filteredProfiles = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return profiles;

    return profiles.filter((profile) => {
      const name =
        `${profile.first_name ?? ""} ${
          profile.last_name ?? ""
        }`.trim();

      return (
        name.toLowerCase().includes(query) ||
        profile.email
          .toLowerCase()
          .includes(query)
      );
    });
  }, [profiles, search]);

  const selectedProfiles = useMemo(
    () =>
      profiles.filter((profile) =>
        selectedUserIds.includes(profile.id)
      ),
    [profiles, selectedUserIds]
  );

  const selectedType = notificationTypes.find(
    (item) => item.value === type
  );

  function getDisplayName(profile: Profile) {
    const name =
      `${profile.first_name ?? ""} ${
        profile.last_name ?? ""
      }`.trim();

    return name || profile.email;
  }

  function handleSelectUser(userId: string) {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );

    setStatus(null);
  }

  function selectAllFiltered() {
    const filteredIds = filteredProfiles.map(
      (profile) => profile.id
    );

    setSelectedUserIds((prev) =>
      Array.from(
        new Set([...prev, ...filteredIds])
      )
    );
  }

  function clearSelection() {
    setSelectedUserIds([]);
  }

  function handleTargetChange(
    value: TargetType
  ) {
    setTargetType(value);
    setStatus(null);

    if (value === "all") {
      setSelectedUserIds([]);
    }
  }

  async function handleSend(
    e: React.FormEvent
  ) {
    e.preventDefault();

    setStatus(null);

    const cleanTitle = title.trim();
    const cleanMessage = message.trim();

    if (!cleanTitle) {
      setStatus({
        type: "error",
        message:
          "Please enter a notification title.",
      });
      return;
    }

    if (!cleanMessage) {
      setStatus({
        type: "error",
        message:
          "Please enter a notification message.",
      });
      return;
    }

    if (
      targetType === "selected" &&
      selectedUserIds.length === 0
    ) {
      setStatus({
        type: "error",
        message:
          "Please select at least one recipient.",
      });
      return;
    }

    setLoading(true);

    try {
      // --------------------------------------------------
      // 1. Create notification in Supabase
      // --------------------------------------------------

      const { data: notif, error: notifErr } =
        await supabase
          .from("notifications")
          .insert({
            title: cleanTitle,
            message: cleanMessage,
            type,
            target_type: targetType,
          })
          .select()
          .single();

      if (notifErr || !notif) {
        throw (
          notifErr ??
          new Error(
            "Failed to create notification."
          )
        );
      }

      // --------------------------------------------------
      // 2. Determine recipients
      // --------------------------------------------------

      let recipientIds: string[] = [];

      if (targetType === "all") {
        recipientIds = profiles.map(
          (profile) => profile.id
        );
      } else {
        recipientIds = selectedUserIds;
      }

      // --------------------------------------------------
      // 3. Create user_notifications
      // --------------------------------------------------

      if (recipientIds.length > 0) {
        const userNotifs = recipientIds.map(
          (userId) => ({
            notification_id: notif.id,
            user_id: userId,
            is_read: false,
          })
        );

        const { error: userNotifErr } =
          await supabase
            .from("user_notifications")
            .insert(userNotifs);

        if (userNotifErr) {
          throw userNotifErr;
        }
      }

      // --------------------------------------------------
      // 4. Send OneSignal push
      // --------------------------------------------------

      const pushRes = await fetch(
        "/api/send-notification",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: cleanTitle,
            message: cleanMessage,
            targetType,
            recipientIds,
          }),
        }
      );

      const pushData = await pushRes
        .json()
        .catch(() => null);

      console.log(
        "OneSignal push HTTP status:",
        pushRes.status
      );

      console.log(
        "OneSignal push response:",
        pushData
      );

      if (!pushRes.ok) {
        console.error(
          "Push dispatch failed:",
          JSON.stringify(
            pushData,
            null,
            2
          )
        );

        setStatus({
          type: "warning",
          message:
            "The notification was saved, but the push notification could not be sent.",
        });

        return;
      }

      if (
        pushData &&
        typeof pushData.recipients ===
          "number" &&
        pushData.recipients === 0
      ) {
        setStatus({
          type: "warning",
          message:
            "The notification was saved, but OneSignal matched 0 push recipients.",
        });

        return;
      }

      console.log(
        "Push dispatched successfully:",
        JSON.stringify(
          pushData,
          null,
          2
        )
      );

      // --------------------------------------------------
      // 5. Success
      // --------------------------------------------------

      setStatus({
        type: "success",
        message:
          targetType === "all"
            ? `Notification sent to ${profiles.length} member accounts.`
            : `Notification sent to ${selectedUserIds.length} selected member${
                selectedUserIds.length === 1
                  ? ""
                  : "s"
              }.`,
      });

      // --------------------------------------------------
      // 6. Reset form
      // --------------------------------------------------

      setTitle("");
      setMessage("");
      setSelectedUserIds([]);
      setSearch("");
    } catch (error) {
      console.error(
        "Notification creation error:",
        error
      );

      setStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to send notification.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #070b14;
        }

        .admin-shell {
          min-height: 100vh;
          display: flex;
          background:
            radial-gradient(
              circle at 80% 0%,
              rgba(99, 102, 241, 0.08),
              transparent 30%
            ),
            #070b14;
          color: #f8fafc;
        }

        .sidebar {
          width: 248px;
          flex-shrink: 0;
          border-right: 1px solid #182033;
          background: rgba(9, 14, 25, 0.96);
          padding: 20px 14px;
          position: sticky;
          top: 0;
          height: 100vh;
          display: flex;
          flex-direction: column;
        }

        .brand {
          padding: 10px 12px 24px;
          border-bottom: 1px solid #182033;
          margin-bottom: 16px;
        }

        .brand-title {
          font-size: 18px;
          font-weight: 800;
          letter-spacing: -0.04em;
        }

        .brand-subtitle {
          margin-top: 4px;
          font-size: 11px;
          color: #64748b;
        }

        .nav {
          display: grid;
          gap: 4px;
        }

        .nav-link {
          display: flex;
          align-items: center;
          gap: 12px;
          min-height: 42px;
          padding: 0 12px;
          border-radius: 9px;
          color: #94a3b8;
          text-decoration: none;
          font-size: 13px;
          font-weight: 500;
          transition: 0.15s ease;
        }

        .nav-link:hover {
          color: #f8fafc;
          background: #111827;
        }

        .nav-link.active {
          color: #fff;
          background: linear-gradient(
            90deg,
            rgba(99, 102, 241, 0.2),
            rgba(99, 102, 241, 0.08)
          );
          border: 1px solid rgba(99, 102, 241, 0.2);
        }

        .nav-icon {
          width: 22px;
          text-align: center;
          font-size: 16px;
          opacity: 0.9;
        }

        .back-dashboard {
          margin-top: auto;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 11px 12px;
          border-radius: 9px;
          color: #cbd5e1;
          text-decoration: none;
          font-size: 13px;
          border: 1px solid #1e293b;
          background: #0d1422;
          transition: 0.15s ease;
        }

        .back-dashboard:hover {
          background: #111827;
          color: #fff;
        }

        .mobile-header {
          display: none;
        }

        .main {
          min-width: 0;
          flex: 1;
        }

        .content {
          width: 100%;
          max-width: 1180px;
          margin: 0 auto;
          padding: 36px;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: flex-start;
          margin-bottom: 28px;
        }

        .eyebrow {
          color: #818cf8;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          margin-bottom: 7px;
        }

        .page-title {
          margin: 0;
          font-size: clamp(26px, 4vw, 34px);
          line-height: 1.1;
          letter-spacing: -0.045em;
        }

        .page-description {
          color: #64748b;
          margin: 8px 0 0;
          font-size: 13px;
          line-height: 1.6;
        }

        .workspace {
          display: grid;
          grid-template-columns: minmax(0, 1.55fr) minmax(300px, 0.8fr);
          gap: 20px;
          align-items: start;
        }

        .card {
          background: rgba(13, 20, 34, 0.86);
          border: 1px solid #1b2638;
          border-radius: 14px;
          box-shadow: 0 15px 45px rgba(0, 0, 0, 0.18);
        }

        .composer {
          padding: 22px;
        }

        .card-header {
          margin-bottom: 20px;
        }

        .card-title {
          margin: 0;
          font-size: 15px;
          font-weight: 700;
        }

        .card-description {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 12px;
        }

        .section {
          margin-top: 24px;
        }

        .label-row {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 8px;
        }

        .label {
          color: #cbd5e1;
          font-size: 12px;
          font-weight: 600;
        }

        .counter {
          color: #475569;
          font-size: 11px;
        }

        .audience-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .audience-option {
          border: 1px solid #243149;
          background: #0b1220;
          border-radius: 10px;
          padding: 14px;
          cursor: pointer;
          text-align: left;
          color: #cbd5e1;
          transition: 0.15s ease;
        }

        .audience-option:hover {
          border-color: #394b6a;
        }

        .audience-option.active {
          border-color: rgba(99, 102, 241, 0.7);
          background: rgba(99, 102, 241, 0.09);
        }

        .audience-title {
          font-size: 13px;
          font-weight: 700;
          color: #f8fafc;
        }

        .audience-description {
          margin-top: 4px;
          color: #64748b;
          font-size: 11px;
          line-height: 1.5;
        }

        .type-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 9px;
        }

        .type-option {
          border: 1px solid #243149;
          background: #0b1220;
          border-radius: 10px;
          padding: 12px;
          cursor: pointer;
          text-align: left;
          color: #cbd5e1;
          transition: 0.15s ease;
        }

        .type-option:hover {
          border-color: #394b6a;
        }

        .type-option.active {
          border-color: rgba(99, 102, 241, 0.7);
          background: rgba(99, 102, 241, 0.09);
        }

        .type-icon {
          width: 25px;
          height: 25px;
          display: grid;
          place-items: center;
          border-radius: 7px;
          background: #182238;
          color: #a5b4fc;
          font-weight: 800;
          font-size: 12px;
          margin-bottom: 9px;
        }

        .type-name {
          font-size: 12px;
          font-weight: 700;
          color: #f8fafc;
        }

        .type-description {
          margin-top: 4px;
          font-size: 10px;
          color: #64748b;
          line-height: 1.4;
        }

        .input,
        .textarea,
        .search {
          width: 100%;
          border: 1px solid #243149;
          background: #090f1b;
          color: #f8fafc;
          border-radius: 9px;
          outline: none;
          font-family: inherit;
          transition: 0.15s ease;
        }

        .input,
        .search {
          height: 42px;
          padding: 0 12px;
          font-size: 13px;
        }

        .textarea {
          min-height: 130px;
          padding: 12px;
          resize: vertical;
          font-size: 13px;
          line-height: 1.6;
        }

        .input:focus,
        .textarea:focus,
        .search:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }

        .recipient-box {
          border: 1px solid #1f2c41;
          border-radius: 10px;
          overflow: hidden;
          background: #090f1b;
        }

        .recipient-toolbar {
          padding: 10px;
          border-bottom: 1px solid #1b2638;
          display: flex;
          gap: 8px;
        }

        .small-button {
          border: 1px solid #243149;
          background: #111827;
          color: #94a3b8;
          border-radius: 7px;
          padding: 7px 9px;
          font-size: 10px;
          cursor: pointer;
        }

        .small-button:hover {
          color: #fff;
          border-color: #3a4a65;
        }

        .recipient-list {
          max-height: 240px;
          overflow-y: auto;
        }

        .recipient-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-bottom: 1px solid #121c2d;
          cursor: pointer;
        }

        .recipient-row:last-child {
          border-bottom: 0;
        }

        .recipient-row:hover {
          background: #0d1524;
        }

        .checkbox {
          width: 15px;
          height: 15px;
          accent-color: #6366f1;
        }

        .avatar {
          width: 30px;
          height: 30px;
          flex-shrink: 0;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #1a2340;
          color: #a5b4fc;
          font-size: 11px;
          font-weight: 700;
        }

        .recipient-info {
          min-width: 0;
        }

        .recipient-name {
          color: #e2e8f0;
          font-size: 12px;
          font-weight: 600;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .recipient-email {
          color: #475569;
          font-size: 10px;
          margin-top: 2px;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .selection-summary {
          padding: 10px 12px;
          background: rgba(99, 102, 241, 0.06);
          border-top: 1px solid #1b2638;
          color: #818cf8;
          font-size: 11px;
        }

        .send-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          margin-top: 26px;
          padding-top: 20px;
          border-top: 1px solid #1b2638;
        }

        .send-meta {
          color: #475569;
          font-size: 11px;
          line-height: 1.5;
        }

        .send-button {
          min-width: 150px;
          height: 44px;
          border: 0;
          border-radius: 9px;
          background: linear-gradient(
            135deg,
            #6366f1,
            #4f46e5
          );
          color: #fff;
          font-weight: 700;
          font-size: 12px;
          cursor: pointer;
          box-shadow:
            0 8px 24px rgba(79, 70, 229, 0.2);
          transition: 0.15s ease;
        }

        .send-button:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow:
            0 12px 28px rgba(79, 70, 229, 0.3);
        }

        .send-button:disabled {
          background: #263248;
          color: #64748b;
          cursor: not-allowed;
          box-shadow: none;
        }

        .preview-card {
          position: sticky;
          top: 24px;
          overflow: hidden;
        }

        .preview-header {
          padding: 18px;
          border-bottom: 1px solid #1b2638;
        }

        .preview-label {
          color: #64748b;
          text-transform: uppercase;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.1em;
        }

        .preview-body {
          padding: 18px;
        }

        .phone {
          border: 1px solid #26344b;
          background: #080d17;
          border-radius: 16px;
          padding: 14px;
        }

        .phone-top {
          display: flex;
          justify-content: space-between;
          color: #475569;
          font-size: 9px;
          margin-bottom: 18px;
        }

        .push-notification {
          border: 1px solid #26344b;
          border-radius: 11px;
          padding: 13px;
          background: #111827;
        }

        .push-brand {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #94a3b8;
          font-size: 9px;
          margin-bottom: 9px;
        }

        .push-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #6366f1;
        }

        .push-title {
          color: #f8fafc;
          font-size: 12px;
          font-weight: 700;
          word-break: break-word;
        }

        .push-message {
          margin-top: 5px;
          color: #94a3b8;
          font-size: 11px;
          line-height: 1.5;
          word-break: break-word;
        }

        .preview-meta {
          display: grid;
          gap: 8px;
          margin-top: 16px;
        }

        .meta-row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          font-size: 11px;
        }

        .meta-label {
          color: #475569;
        }

        .meta-value {
          color: #cbd5e1;
          font-weight: 600;
          text-align: right;
        }

        .status {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 12px 14px;
          margin-bottom: 20px;
          border-radius: 10px;
          font-size: 12px;
          line-height: 1.5;
        }

        .status.success {
          background: rgba(34, 197, 94, 0.08);
          border: 1px solid rgba(34, 197, 94, 0.2);
          color: #86efac;
        }

        .status.warning {
          background: rgba(245, 158, 11, 0.08);
          border: 1px solid rgba(245, 158, 11, 0.2);
          color: #fcd34d;
        }

        .status.error {
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.2);
          color: #fca5a5;
        }

        .empty {
          padding: 25px;
          text-align: center;
          color: #475569;
          font-size: 11px;
        }

        .mobile-overlay {
          display: none;
        }

        @media (max-width: 950px) {
          .sidebar {
            position: fixed;
            z-index: 50;
            left: 0;
            top: 0;
            transform: translateX(-100%);
            transition: transform 0.2s ease;
          }

          .sidebar.open {
            transform: translateX(0);
          }

          .mobile-overlay {
            position: fixed;
            inset: 0;
            z-index: 40;
            background: rgba(0, 0, 0, 0.55);
          }

          .mobile-overlay.open {
            display: block;
          }

          .mobile-header {
            height: 58px;
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 0 16px;
            border-bottom: 1px solid #182033;
            background: #090e19;
          }

          .mobile-menu {
            border: 1px solid #243149;
            background: #111827;
            color: #fff;
            border-radius: 7px;
            width: 34px;
            height: 34px;
            cursor: pointer;
          }

          .content {
            padding: 24px 18px;
          }
        }

        @media (max-width: 800px) {
          .workspace {
            grid-template-columns: 1fr;
          }

          .preview-card {
            position: static;
          }
        }

        @media (max-width: 600px) {
          .content {
            padding: 20px 14px;
          }

          .page-header {
            margin-bottom: 20px;
          }

          .audience-grid,
          .type-grid {
            grid-template-columns: 1fr;
          }

          .composer {
            padding: 16px;
          }

          .send-row {
            flex-direction: column;
            align-items: stretch;
          }

          .send-button {
            width: 100%;
          }
        }
      `}</style>

      <div className="admin-shell">
        {/* Mobile overlay */}
        <div
          className={`mobile-overlay ${
            mobileNavOpen ? "open" : ""
          }`}
          onClick={() =>
            setMobileNavOpen(false)
          }
        />

        {/* Sidebar */}
        <aside
          className={`sidebar ${
            mobileNavOpen ? "open" : ""
          }`}
        >
          <div className="brand">
            <div className="brand-title">
              HMUK Admin
            </div>
            <div className="brand-subtitle">
              Management Console
            </div>
          </div>

          <nav className="nav">
            {navItems.map((item) => {
              const active =
                item.href ===
                "/admin/notifications";

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-link ${
                    active ? "active" : ""
                  }`}
                  onClick={() =>
                    setMobileNavOpen(false)
                  }
                >
                  <span className="nav-icon">
                    {item.icon}
                  </span>

                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <Link
            href="/admin"
            className="back-dashboard"
          >
            <span>←</span>
            Back to Dashboard
          </Link>
        </aside>

        <main className="main">
          {/* Mobile header */}
          <div className="mobile-header">
            <button
              className="mobile-menu"
              type="button"
              onClick={() =>
                setMobileNavOpen(true)
              }
              aria-label="Open admin navigation"
            >
              ☰
            </button>

            <strong
              style={{
                fontSize: 14,
                letterSpacing: "-0.02em",
              }}
            >
              HMUK Admin
            </strong>
          </div>

          <div className="content">
            {/* Header */}
            <div className="page-header">
              <div>
                <div className="eyebrow">
                  Administration
                </div>

                <h1 className="page-title">
                  Send Notification
                </h1>

                <p className="page-description">
                  Send announcements and important
                  updates directly to member accounts.
                </p>
              </div>
            </div>

            {/* Status */}
            {status && (
              <div
                className={`status ${status.type}`}
                role="status"
              >
                <strong>
                  {status.type === "success"
                    ? "✓"
                    : status.type === "warning"
                    ? "!"
                    : "×"}
                </strong>

                <span>{status.message}</span>
              </div>
            )}

            <form onSubmit={handleSend}>
              <div className="workspace">
                {/* Composer */}
                <section className="card composer">
                  <div className="card-header">
                    <h2 className="card-title">
                      Notification Composer
                    </h2>

                    <p className="card-description">
                      Configure the audience and message
                      you want to send.
                    </p>
                  </div>

                  {/* Audience */}
                  <div className="section">
                    <div className="label-row">
                      <label className="label">
                        Audience
                      </label>

                      <span className="counter">
                        {targetType === "all"
                          ? `${profiles.length} members`
                          : `${selectedUserIds.length} selected`}
                      </span>
                    </div>

                    <div className="audience-grid">
                      <button
                        type="button"
                        className={`audience-option ${
                          targetType === "all"
                            ? "active"
                            : ""
                        }`}
                        onClick={() =>
                          handleTargetChange("all")
                        }
                      >
                        <div className="audience-title">
                          All Members
                        </div>

                        <div className="audience-description">
                          Send to all registered member
                          subscriptions.
                        </div>
                      </button>

                      <button
                        type="button"
                        className={`audience-option ${
                          targetType === "selected"
                            ? "active"
                            : ""
                        }`}
                        onClick={() =>
                          handleTargetChange(
                            "selected"
                          )
                        }
                      >
                        <div className="audience-title">
                          Selected Members
                        </div>

                        <div className="audience-description">
                          Choose exactly which members
                          should receive it.
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Recipients */}
                  {targetType === "selected" && (
                    <div className="section">
                      <div className="label-row">
                        <label className="label">
                          Recipients
                        </label>

                        <span className="counter">
                          {selectedUserIds.length} selected
                        </span>
                      </div>

                      <div className="recipient-box">
                        <div className="recipient-toolbar">
                          <input
                            className="search"
                            placeholder="Search members..."
                            value={search}
                            onChange={(e) =>
                              setSearch(
                                e.target.value
                              )
                            }
                          />

                          <button
                            type="button"
                            className="small-button"
                            onClick={
                              selectAllFiltered
                            }
                          >
                            Select all
                          </button>

                          <button
                            type="button"
                            className="small-button"
                            onClick={
                              clearSelection
                            }
                          >
                            Clear
                          </button>
                        </div>

                        <div className="recipient-list">
                          {filteredProfiles.length ===
                          0 ? (
                            <div className="empty">
                              No members found.
                            </div>
                          ) : (
                            filteredProfiles.map(
                              (profile) => {
                                const selected =
                                  selectedUserIds.includes(
                                    profile.id
                                  );

                                const name =
                                  getDisplayName(
                                    profile
                                  );

                                const initials =
                                  name
                                    .split(" ")
                                    .map(
                                      (part) =>
                                        part[0]
                                    )
                                    .join("")
                                    .slice(0, 2)
                                    .toUpperCase();

                                return (
                                  <label
                                    key={
                                      profile.id
                                    }
                                    className="recipient-row"
                                  >
                                    <input
                                      type="checkbox"
                                      className="checkbox"
                                      checked={
                                        selected
                                      }
                                      onChange={() =>
                                        handleSelectUser(
                                          profile.id
                                        )
                                      }
                                    />

                                    <div className="avatar">
                                      {initials}
                                    </div>

                                    <div className="recipient-info">
                                      <div className="recipient-name">
                                        {name}
                                      </div>

                                      <div className="recipient-email">
                                        {
                                          profile.email
                                        }
                                      </div>
                                    </div>
                                  </label>
                                );
                              }
                            )
                          )}
                        </div>

                        <div className="selection-summary">
                          {selectedUserIds.length ===
                          0
                            ? "No recipients selected"
                            : `${selectedUserIds.length} member${
                                selectedUserIds.length ===
                                1
                                  ? ""
                                  : "s"
                              } will receive this notification`}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Type */}
                  <div className="section">
                    <div className="label-row">
                      <label className="label">
                        Notification Type
                      </label>
                    </div>

                    <div className="type-grid">
                      {notificationTypes.map(
                        (notificationType) => (
                          <button
                            key={
                              notificationType.value
                            }
                            type="button"
                            className={`type-option ${
                              type ===
                              notificationType.value
                                ? "active"
                                : ""
                            }`}
                            onClick={() =>
                              setType(
                                notificationType.value
                              )
                            }
                          >
                            <div className="type-icon">
                              {
                                notificationType.icon
                              }
                            </div>

                            <div className="type-name">
                              {
                                notificationType.label
                              }
                            </div>

                            <div className="type-description">
                              {
                                notificationType.description
                              }
                            </div>
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* Title */}
                  <div className="section">
                    <div className="label-row">
                      <label
                        htmlFor="notification-title"
                        className="label"
                      >
                        Title
                      </label>

                      <span className="counter">
                        {title.length}/
                        {MAX_TITLE_LENGTH}
                      </span>
                    </div>

                    <input
                      id="notification-title"
                      className="input"
                      type="text"
                      required
                      maxLength={
                        MAX_TITLE_LENGTH
                      }
                      placeholder="e.g. Scheduled Maintenance Update"
                      value={title}
                      onChange={(e) =>
                        setTitle(e.target.value)
                      }
                    />
                  </div>

                  {/* Message */}
                  <div className="section">
                    <div className="label-row">
                      <label
                        htmlFor="notification-message"
                        className="label"
                      >
                        Message
                      </label>

                      <span className="counter">
                        {message.length}/
                        {MAX_MESSAGE_LENGTH}
                      </span>
                    </div>

                    <textarea
                      id="notification-message"
                      className="textarea"
                      required
                      maxLength={
                        MAX_MESSAGE_LENGTH
                      }
                      placeholder="Write your notification message..."
                      value={message}
                      onChange={(e) =>
                        setMessage(e.target.value)
                      }
                    />
                  </div>

                  {/* Send */}
                  <div className="send-row">
                    <div className="send-meta">
                      {targetType === "all"
                        ? `This will notify ${profiles.length} member accounts.`
                        : `${selectedUserIds.length} selected recipient${
                            selectedUserIds.length ===
                            1
                              ? ""
                              : "s"
                          }.`}
                      <br />
                      Push delivery will be handled by
                      OneSignal.
                    </div>

                    <button
                      className="send-button"
                      type="submit"
                      disabled={
                        loading ||
                        (targetType ===
                          "selected" &&
                          selectedUserIds.length ===
                            0)
                      }
                    >
                      {loading
                        ? "Sending..."
                        : "Send Notification →"}
                    </button>
                  </div>
                </section>

                {/* Preview */}
                <aside className="card preview-card">
                  <div className="preview-header">
                    <div className="preview-label">
                      Live Preview
                    </div>

                    <h2
                      className="card-title"
                      style={{
                        marginTop: 6,
                      }}
                    >
                      Push notification
                    </h2>
                  </div>

                  <div className="preview-body">
                    <div className="phone">
                      <div className="phone-top">
                        <span>HMUK</span>
                        <span>now</span>
                      </div>

                      <div className="push-notification">
                        <div className="push-brand">
                          <span className="push-dot" />
                          HMUK
                        </div>

                        <div className="push-title">
                          {title.trim() ||
                            "Your notification title"}
                        </div>

                        <div className="push-message">
                          {message.trim() ||
                            "Your notification message will appear here."}
                        </div>
                      </div>
                    </div>

                    <div className="preview-meta">
                      <div className="meta-row">
                        <span className="meta-label">
                          Type
                        </span>

                        <span className="meta-value">
                          {selectedType?.label}
                        </span>
                      </div>

                      <div className="meta-row">
                        <span className="meta-label">
                          Audience
                        </span>

                        <span className="meta-value">
                          {targetType === "all"
                            ? "All Members"
                            : `${selectedUserIds.length} selected`}
                        </span>
                      </div>

                      <div className="meta-row">
                        <span className="meta-label">
                          Delivery
                        </span>

                        <span className="meta-value">
                          Push Notification
                        </span>
                      </div>
                    </div>
                  </div>
                </aside>
              </div>
            </form>
          </div>
        </main>
      </div>
    </>
  );
}