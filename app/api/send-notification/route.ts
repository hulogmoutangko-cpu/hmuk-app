import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const appId = process.env.ONESIGNAL_APP_ID;
    const restApiKey = process.env.ONESIGNAL_REST_API_KEY;

    if (!appId || !restApiKey) {
      console.error("Missing OneSignal environment variables");

      return NextResponse.json(
        {
          error:
            "Server is missing ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY.",
        },
        { status: 500 }
      );
    }

    const {
      title,
      message,
      targetType,
      recipientIds = [],
    } = await request.json();

    if (!title || !message) {
      return NextResponse.json(
        { error: "title and message are required." },
        { status: 400 }
      );
    }

    let payload: Record<string, unknown>;

    if (targetType === "selected") {
      if (!Array.isArray(recipientIds) || recipientIds.length === 0) {
        return NextResponse.json(
          { error: "recipientIds must contain at least one external user ID." },
          { status: 400 }
        );
      }

      payload = {
        app_id: appId,
        target_channel: "push",

        include_aliases: {
          external_id: recipientIds,
        },

        headings: {
          en: title,
        },

        contents: {
          en: message,
        },
      };
    } else {
      payload = {
        app_id: appId,
        target_channel: "push",

        included_segments: ["Total Subscriptions"],

        headings: {
          en: title,
        },

        contents: {
          en: message,
        },
      };
    }

    console.log("Sending OneSignal notification:", {
      targetType,
      recipientIds,
      payload: {
        ...payload,
        // Don't log the REST API key.
      },
    });

    const res = await fetch(
      "https://onesignal.com/api/v1/notifications",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${restApiKey}`,
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await res.json();

    console.log("OneSignal response:", {
      status: res.status,
      data,
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          error: data,
        },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Send notification error:", error);

    return NextResponse.json(
      {
        error: "Failed to send notification.",
      },
      { status: 500 }
    );
  }
}