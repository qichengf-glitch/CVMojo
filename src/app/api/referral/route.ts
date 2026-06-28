import { NextResponse } from "next/server";
import { hasSupabasePublicEnv, SUPABASE_ENV_ERROR } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!hasSupabasePublicEnv()) {
    return NextResponse.json({ error: SUPABASE_ENV_ERROR }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { referrer } = (await request.json()) as { referrer?: string };
  if (!referrer || referrer === user.id) {
    return NextResponse.json({ claimed: false });
  }

  const { data, error } = await supabase.rpc("claim_referral", { referrer });
  if (error) {
    return NextResponse.json({ claimed: false });
  }

  return NextResponse.json({ claimed: data === true });
}
