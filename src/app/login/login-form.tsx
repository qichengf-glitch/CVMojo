"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { hasSupabasePublicEnv, SUPABASE_ENV_ERROR } from "@/lib/supabase/env";
import { AuthShell, Button, ErrorBanner, Input, SetupBanner } from "@/components/ui";
import { GoogleButton } from "@/components/google-button";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/generate";
  const isSupabaseConfigured = hasSupabasePublicEnv();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!isSupabaseConfigured) {
      setError(SUPABASE_ENV_ERROR);
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    router.push(nextPath.startsWith("/") ? nextPath : "/generate");
    router.refresh();
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to tailor your next application.">
      <form onSubmit={handleSubmit} className="space-y-4">
        {!isSupabaseConfigured && <SetupBanner message={SUPABASE_ENV_ERROR} />}
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <ErrorBanner message={error} />
        <Button type="submit" className="w-full" disabled={loading || !isSupabaseConfigured}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      {isSupabaseConfigured && (
        <div className="mt-4">
          <div className="mb-3 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" /> or <span className="h-px flex-1 bg-slate-200" />
          </div>
          <GoogleButton next={nextPath.startsWith("/") ? nextPath : "/generate"} />
        </div>
      )}
      <p className="mt-4 text-center text-sm text-slate-500">
        No account?{" "}
        <Link href="/signup" className="font-semibold text-[#7c3aed]">
          Sign up
        </Link>
      </p>
    </AuthShell>
  );
}
