import { NextResponse } from "next/server";
import { hasSupabasePublicEnv, SUPABASE_ENV_ERROR } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
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

  const { data } = await supabase.from("user_profiles").select("full_name").eq("id", user.id).single();
  return NextResponse.json({ name: data?.full_name ?? "" });
}
