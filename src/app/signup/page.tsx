"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { hasSupabasePublicEnv, SUPABASE_ENV_ERROR } from "@/lib/supabase/env";
import { AuthShell, Button, ErrorBanner, Input, PasswordInput, SetupBanner } from "@/components/ui";
import { GoogleButton } from "@/components/google-button";
import { LanguageToggle } from "@/components/language-toggle";
import { useI18n } from "@/lib/i18n";

export default function SignupPage() {
  const { t } = useI18n();
  const router = useRouter();
  const isSupabaseConfigured = hasSupabasePublicEnv();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!isSupabaseConfigured) {
      setError(SUPABASE_ENV_ERROR);
      return;
    }

    if (password !== confirmPassword) {
      setError(t("Passwords do not match.", "两次输入的密码不一致。"));
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    router.push("/onboarding");
    router.refresh();
  }

  return (
    <AuthShell
      title={t("Create your account", "创建账户")}
      subtitle={t("Sign up to generate tailored resumes. Profile setup is optional.", "注册即可生成量身定制的简历。资料设置为可选项。")}
    >
      <div className="mb-4 flex justify-end">
        <LanguageToggle />
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        {!isSupabaseConfigured && <SetupBanner message={SUPABASE_ENV_ERROR} />}
        <Input label={t("Email", "邮箱")} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <PasswordInput
          label={t("Password", "密码")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />
        <PasswordInput
          label={t("Confirm password", "确认密码")}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          minLength={6}
          required
        />
        {confirmPassword && password !== confirmPassword && (
          <p className="text-sm text-red-600">{t("Passwords do not match.", "两次输入的密码不一致。")}</p>
        )}
        <ErrorBanner message={error} />
        <Button
          type="submit"
          className="w-full"
          disabled={loading || !isSupabaseConfigured || password !== confirmPassword}
        >
          {loading ? t("Creating account…", "正在创建账户…") : t("Sign up", "注册")}
        </Button>
      </form>
      {isSupabaseConfigured && (
        <div className="mt-4">
          <div className="mb-3 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" /> or <span className="h-px flex-1 bg-slate-200" />
          </div>
          <GoogleButton next="/generate" label="Sign up with Google" />
        </div>
      )}
      <p className="mt-4 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-[#7c3aed]">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
