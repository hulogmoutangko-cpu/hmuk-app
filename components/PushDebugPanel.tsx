"use client";

import { useEffect, useState } from "react";
import OneSignal from "react-onesignal";

interface DebugInfo {
  browserPermission: string;
  oneSignalPermission: boolean | null;
  subscriptionId: string | null;
  pushToken: string | null;
  optedIn: boolean | null;
  onesignalId: string | null;
  externalId: string | null;
  lastError: string | null;
}

export default function PushDebugPanel() {
  const [info, setInfo] = useState<DebugInfo>({
    browserPermission:
      typeof window !== "undefined" && "Notification" in window
        ? Notification.permission
        : "unsupported",
    oneSignalPermission: null,
    subscriptionId: null,
    pushToken: null,
    optedIn: null,
    onesignalId: null,
    externalId: null,
    lastError: null,
  });
  const [busy, setBusy] = useState(false);

  function refresh() {
    try {
      setInfo((prev) => ({
        ...prev,
        browserPermission:
          "Notification" in window ? Notification.permission : "unsupported",
        oneSignalPermission: OneSignal.Notifications.permission ?? null,
        subscriptionId: OneSignal.User.PushSubscription.id ?? null,
        pushToken: OneSignal.User.PushSubscription.token ?? null,
        optedIn: OneSignal.User.PushSubscription.optedIn ?? null,
        onesignalId: OneSignal.User.onesignalId ?? null,
        externalId: OneSignal.User.externalId ?? null,
      }));
    } catch (err: any) {
      setInfo((prev) => ({ ...prev, lastError: `refresh() failed: ${err?.message}` }));
    }
  }

  useEffect(() => {
    refresh();
    // Re-check whenever the subscription changes (e.g. token arrives async)
    const handler = () => refresh();
    OneSignal.User.PushSubscription.addEventListener("change", handler);
    const interval = setInterval(refresh, 3000);
    return () => {
      OneSignal.User.PushSubscription.removeEventListener("change", handler);
      clearInterval(interval);
    };
  }, []);

  async function handleEnable() {
    setBusy(true);
    setInfo((prev) => ({ ...prev, lastError: null }));
    try {
      const permission = await OneSignal.Notifications.requestPermission();
      console.log("[PushDebug] requestPermission result:", permission);
      await OneSignal.User.PushSubscription.optIn();
      console.log("[PushDebug] optIn() completed");
    } catch (err: any) {
      console.error("[PushDebug] handleEnable error:", err);
      setInfo((prev) => ({ ...prev, lastError: err?.message ?? String(err) }));
    } finally {
      refresh();
      setBusy(false);
    }
  }

  const rowStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    padding: "6px 0",
    borderBottom: "1px solid #334155",
    fontSize: 12,
  };

  return (
    <div
      style={{
        background: "#1e293b",
        border: "1px solid #334155",
        borderRadius: 12,
        padding: 16,
        color: "#fff",
        margin: "16px 0",
        fontFamily: "monospace",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 10, fontFamily: "sans-serif" }}>
        Push Debug Panel
      </div>

      <button
        onClick={handleEnable}
        disabled={busy}
        style={{
          width: "100%",
          padding: "10px 0",
          marginBottom: 12,
          background: "#10b981",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontWeight: 600,
          fontFamily: "sans-serif",
          fontSize: 13,
          cursor: busy ? "not-allowed" : "pointer",
        }}
      >
        {busy ? "Requesting..." : "Enable Push Notifications"}
      </button>

      <div style={rowStyle}>
        <span>Browser permission</span>
        <span>{info.browserPermission}</span>
      </div>
      <div style={rowStyle}>
        <span>OneSignal permission</span>
        <span>{String(info.oneSignalPermission)}</span>
      </div>
      <div style={rowStyle}>
        <span>Opted in</span>
        <span>{String(info.optedIn)}</span>
      </div>
      <div style={rowStyle}>
        <span>OneSignal ID</span>
        <span style={{ wordBreak: "break-all", textAlign: "right" }}>
          {info.onesignalId ?? "(none)"}
        </span>
      </div>
      <div style={rowStyle}>
        <span>External ID</span>
        <span style={{ wordBreak: "break-all", textAlign: "right" }}>
          {info.externalId ?? "(none)"}
        </span>
      </div>
      <div style={rowStyle}>
        <span>Subscription ID</span>
        <span style={{ wordBreak: "break-all", textAlign: "right" }}>
          {info.subscriptionId ?? "(none)"}
        </span>
      </div>
      <div style={{ ...rowStyle, borderBottom: "none" }}>
        <span>Push token</span>
        <span style={{ wordBreak: "break-all", textAlign: "right" }}>
          {info.pushToken ?? "(none)"}
        </span>
      </div>

      {info.lastError && (
        <div
          style={{
            marginTop: 10,
            padding: 10,
            background: "rgba(239, 68, 68, 0.15)",
            border: "1px solid rgba(239, 68, 68, 0.4)",
            borderRadius: 8,
            color: "#fca5a5",
            fontSize: 12,
          }}
        >
          {info.lastError}
        </div>
      )}
    </div>
  );
}