import { NextResponse } from "next/server";
import { hasSupabasePublicEnv, SUPABASE_ENV_ERROR } from "@/lib/supabase/env";
import { getCreditState } from "@/lib/credits";

export async function GET() {
  if (!hasSupabasePublicEnv()) {
    return NextResponse.json({ error: SUPABASE_ENV_ERROR }, { status: 503 });
  }

  try {
    const state = await getCreditState();
    return NextResponse.json(state);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load credits.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
