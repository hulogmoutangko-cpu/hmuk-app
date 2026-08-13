"use client";

import { useEffect, useRef } from "react";
import OneSignal from "react-onesignal";

export default function OneSignalInit({ userId }: { userId?: string }) {
  const initialized = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || initialized.current) return;
    initialized.current = true;

    OneSignal.init({
      appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "",
      allowLocalhostAsSecureOrigin: true,
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