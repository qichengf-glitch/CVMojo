import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// OAuth (e.g. Google) redirects back here with a code we exchange for a session.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") || "/generate";
  const next = nextParam.startsWith("/") ? nextParam : "/generate";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=oauth`);
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
