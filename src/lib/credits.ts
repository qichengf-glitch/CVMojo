import { createClient } from "./supabase/server";

export interface CreditState {
  credits: number;
  isAnonymous: boolean;
  surveyCompleted: boolean;
  signedIn: boolean;
}

// Read the current user's credit state. Also grants the one-time signup bonus to
// newly-registered users (idempotent), so a guest who converts to a real account
// picks up their 30 credits the next time this runs.
export async function getCreditState(): Promise<CreditState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { credits: 0, isAnonymous: false, surveyCompleted: false, signedIn: false };
  }

  const { data: granted } = await supabase.rpc("grant_signup_bonus");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("credits, survey_completed")
    .eq("id", user.id)
    .single();

  const credits =
    typeof profile?.credits === "number"
      ? profile.credits
      : typeof granted === "number"
        ? granted
        : 0;

  return {
    credits,
    isAnonymous: Boolean(user.is_anonymous),
    surveyCompleted: Boolean(profile?.survey_completed),
    signedIn: true,
  };
}
