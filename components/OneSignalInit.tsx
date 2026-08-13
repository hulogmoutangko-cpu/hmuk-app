"use client";

import { useEffect, useRef } from "react";
import OneSignal from "react-onesignal";

export default function OneSignalInit({ userId }: { userId?: string }) {
  const initialized = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || initialized.current) return;
    initialized.current = true;

    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "";

    if (!appId) {
      // This means NEXT_PUBLIC_ONESIGNAL_APP_ID was empty at BUILD time —
      // most commonly because it was marked "Sensitive" in Vercel, which
      // excludes it from the build step. NEXT_PUBLIC_* vars must be
      // available at build time since Next.js inlines them into the
      // client bundle; they can never be Sensitive.
      console.error(
        "[OneSignal] NEXT_PUBLIC_ONESIGNAL_APP_ID is empty. Push notifications " +
          "will silently fail to issue a token on every device. Check that this " +
          "var is set in Vercel and is NOT marked Sensitive, then redeploy."
      );
      return;
    }

    OneSignal.init({
      appId,
      allowLocalhostAsSecureOrigin: true,
      // Point OneSignal at our merged sw.js (which importScripts the real
      // OneSignal worker) instead of registering its own OneSignalSDKWorker.js
      // at the same root scope — avoids two service workers fighting for
      // control of "/", which was silently breaking push token issuance.
      serviceWorkerParam: { scope: "/" },
      serviceWorkerPath: "sw.js",
    }).then(() => {
      OneSignal.Slidedown.promptPush();
    });
  }, []);

  useEffect(() => {
    if (userId) {
      OneSignal.login(userId);
    }
  }, [userId]);

  return null;
}