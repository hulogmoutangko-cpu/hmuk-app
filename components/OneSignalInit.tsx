"use client";

import { useEffect, useRef } from "react";
import OneSignal from "react-onesignal";

export default function OneSignalInit({
  userId,
}: {
  userId?: string;
}) {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;

    initialized.current = true;

    const initOneSignal = async () => {
      try {
        await OneSignal.init({
          appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "",
          allowLocalhostAsSecureOrigin: true,
          serviceWorkerPath: "sw.js",
          serviceWorkerParam: {
            scope: "/",
          },
        });

        console.log("OneSignal initialized");

        console.log(
          "Push supported:",
          OneSignal.Notifications.isPushSupported()
        );

        console.log(
          "Permission:",
          OneSignal.Notifications.permissionNative
        );

        console.log(
          "Subscription ID:",
          OneSignal.User.PushSubscription.id
        );

        console.log(
          "Push token:",
          OneSignal.User.PushSubscription.token
        );

        if (userId) {
          await OneSignal.login(userId);

          console.log("OneSignal login complete:", userId);
        }
      } catch (error) {
        console.error("OneSignal initialization error:", error);
      }
    };

    initOneSignal();
  }, [userId]);

  return null;
}
