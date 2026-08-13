import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Respect an explicit `next` (e.g. password recovery) before role routing
      if (next === "/reset-password") {
        return NextResponse.redirect(`${origin}${next}`);
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      const dest = profile?.role === "admin" ? "/admin" : "/dashboard";
      return NextResponse.redirect(`${origin}${dest}`);
    }

    console.error("exchangeCodeForSession failed:", error?.message, error?.status);
  } else {
    console.error("No code param on auth callback:", request.url);
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}