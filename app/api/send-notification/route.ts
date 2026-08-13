import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { title, message, targetType, recipientIds } = await request.json();

  const body =
    targetType === "selected"
      ? {
          app_id: process.env.ONESIGNAL_APP_ID,
          headings: { en: title },
          contents: { en: message },
          include_aliases: { external_id: recipientIds },
          target_channel: "push",
        }
      : {
          app_id: process.env.ONESIGNAL_APP_ID,
          headings: { en: title },
          contents: { en: message },
          included_segments: ["Total Subscriptions"],
        };

  const res = await fetch("https://onesignal.com/api/v1/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${process.env.ONESIGNAL_REST_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("OneSignal error:", data);
    return NextResponse.json({ error: data }, { status: res.status });
  }

  return NextResponse.json(data);
}