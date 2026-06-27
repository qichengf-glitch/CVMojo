"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui";

export function GoogleButton({
  next = "/generate",
  label = "Continue with Google",
}: {
  next?: string;
  label?: string;
}) {
  async function signInWithGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  }

  return (
    <Button
      type="button"
      variant="secondary"
      className="w-full"
      onClick={() => void signInWithGoogle()}
    >
      {label}
    </Button>
  );
}
