"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { hasSupabasePublicEnv, SUPABASE_ENV_ERROR } from "@/lib/supabase/env";
import { AuthShell, Button, ErrorBanner, Input, SetupBanner } from "@/components/ui";
import { GoogleButton } from "@/components/google-button";
import { LanguageToggle } from "@/components/language-toggle";
import { useI18n } from "@/lib/i18n";

export default function LoginForm() {
  const { t } = useI18n();
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
    <AuthShell
      title={t("Welcome back", "欢迎回来")}
      subtitle={t("Sign in to tailor your next application.", "登录以定制你的下一份申请。")}
    >
      <div className="mb-4 flex justify-end">
        <LanguageToggle />
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        {!isSupabaseConfigured && <SetupBanner message={SUPABASE_ENV_ERROR} />}
        <Input label={t("Email", "邮箱")} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input
          label={t("Password", "密码")}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <ErrorBanner message={error} />
        <Button type="submit" className="w-full" disabled={loading || !isSupabaseConfigured}>
          {loading ? t("Signing in…", "登录中…") : t("Sign in", "登录")}
        </Button>
      </form>
      {isSupabaseConfigured && (
        <div className="mt-4">
          <div className="mb-3 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" /> or <span className="h-px flex-1 bg-slate-200" />
          </div>
          <GoogleButton next={nextPath.startsWith("/") ? nextPath : "/generate"} label={t("Continue with Google", "使用 Google 继续")} />
        </div>
      )}
      <p className="mt-4 text-center text-sm text-slate-500">
        {t("No account?", "还没有账户？")}{" "}
        <Link href="/signup" className="font-semibold text-[#7c3aed]">
          {t("Sign up", "注册")}
        </Link>
      </p>
    </AuthShell>
  );
}
