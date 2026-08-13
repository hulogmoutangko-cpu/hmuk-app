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

    const initOneSignal = async () => {
      try {
        const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;

        if (!appId) {
          console.error("NEXT_PUBLIC_ONESIGNAL_APP_ID is missing");
          return;
        }

        await OneSignal.init({
          appId,
          allowLocalhostAsSecureOrigin: true,

          // Use the root service worker
          serviceWorkerPath: "sw.js",

          // Root scope so OneSignal works across the whole app
          serviceWorkerParam: {
            scope: "/",
          },
        });

        initialized.current = true;

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