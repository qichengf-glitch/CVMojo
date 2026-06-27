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
  if (user.is_anonymous) {
    return NextResponse.json(
      { error: "Create an account to earn survey credits." },
      { status: 403 }
    );
  }

  const { answers } = (await request.json()) as { answers?: Record<string, unknown> };

  // Only reward once. Check first so we do not store duplicate submissions.
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("survey_completed, credits")
    .eq("id", user.id)
    .single();

  if (profile?.survey_completed) {
    return NextResponse.json({
      credits: profile.credits ?? 0,
      alreadyCompleted: true,
    });
  }

  await supabase.from("survey_responses").insert({
    user_id: user.id,
    answers: answers ?? {},
  });

  const { data: newBalance, error } = await supabase.rpc("grant_survey_bonus");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }

  return NextResponse.json({ credits: typeof newBalance === "number" ? newBalance : 0 });
}
