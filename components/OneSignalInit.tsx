"use client";

import { useEffect } from "react";
import OneSignal from "react-onesignal";

export default function OneSignalInit({ userId }: { userId?: string }) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    OneSignal.init({
      appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "",
      allowLocalhostAsSecureOrigin: true, // For local dev testing
    }).then(() => {
      // Prompt user to enable push notifications
      OneSignal.Slidedown.promptPush();

      // Associate the user's Supabase User ID with OneSignal for targeted push
      if (userId) {
        OneSignal.login(userId);
      }
    });
  }, [userId]);

  return null;
}