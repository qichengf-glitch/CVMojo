"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AppHeader, Button, Card, ErrorBanner, Textarea } from "@/components/ui";
import { GoogleButton } from "@/components/google-button";
import { LanguageToggle } from "@/components/language-toggle";
import { useI18n } from "@/lib/i18n";

export default function EarnPage() {
  const { t } = useI18n();
  const [userId, setUserId] = useState("");
  const [isRegistered, setIsRegistered] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [surveyCompleted, setSurveyCompleted] = useState(false);
  const [surveyOpen, setSurveyOpen] = useState(false);
  const [surveySubmitting, setSurveySubmitting] = useState(false);
  const [surveyAnswers, setSurveyAnswers] = useState({ useful: "", missing: "", recommend: "" });
  const [refCopied, setRefCopied] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setUserId(user.id);

      const res = await fetch("/api/credits");
      if (res.ok) {
        const data = await res.json();
        setCredits(typeof data.credits === "number" ? data.credits : 0);
        setIsRegistered(Boolean(data.signedIn) && !data.isAnonymous);
        setSurveyCompleted(Boolean(data.surveyCompleted));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const referralLink =
    userId && typeof window !== "undefined" ? `${window.location.origin}/?ref=${userId}` : "";

  function copyReferral() {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setRefCopied(true);
    setTimeout(() => setRefCopied(false), 2000);
  }

  async function submitSurvey() {
    setSurveySubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: surveyAnswers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't submit the survey.");
      if (typeof data.credits === "number") setCredits(data.credits);
      setSurveyCompleted(true);
      setSurveyOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't submit the survey.");
    } finally {
      setSurveySubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <AppHeader tagline={t("Earn more free credits anytime.", "随时获取更多免费积分。")}>
        <div className="flex flex-wrap items-center gap-2">
          {credits !== null && (
            <span className="rounded-full bg-[#f5f3ff] px-3 py-1.5 text-sm font-semibold text-[#5b21b6]">
              {credits} {t("credits", "积分")}
            </span>
          )}
          <Link href="/generate">
            <Button variant="secondary">{t("Back to generate", "返回生成")}</Button>
          </Link>
          <LanguageToggle />
        </div>
      </AppHeader>

      <ErrorBanner message={error} />

      {/* Referral — unlimited */}
      <Card className="mb-6">
        <h2 className="text-lg font-bold text-slate-900">
          {t("Refer friends, get +10 credits each", "邀请好友，每人 +10 积分")}
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          {t(
            "Share your link. Every friend who signs up with it gives you +10 credits — unlimited.",
            "分享你的专属链接。每有一位好友通过它注册，你就获得 +10 积分，次数不限。"
          )}
        </p>
        {isRegistered ? (
          <div className="mt-4 flex gap-2">
            <input
              readOnly
              value={referralLink}
              onFocus={(e) => e.target.select()}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700"
            />
            <Button onClick={copyReferral}>
              {refCopied ? t("Copied!", "已复制！") : t("Copy link", "复制链接")}
            </Button>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-2">
            <p className="text-sm text-slate-600">
              {t("Sign up to get your referral link.", "注册以获取你的邀请链接。")}
            </p>
            <Link href="/signup">
              <Button className="w-full">{t("Sign up free", "免费注册")}</Button>
            </Link>
            <GoogleButton next="/earn" label={t("Sign up with Google", "使用 Google 注册")} />
          </div>
        )}
      </Card>

      {/* Survey — one time */}
      <Card>
        <h2 className="text-lg font-bold text-slate-900">
          {t("Give feedback, get +10 credits", "填写反馈，获得 +10 积分")}
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          {t(
            "A quick survey to help us improve. You can do this once.",
            "一份简短的问卷，帮助我们改进。仅限一次。"
          )}
        </p>

        {!isRegistered ? (
          <p className="mt-4 text-sm text-slate-600">
            {t("Sign up to earn survey credits.", "注册后即可通过问卷获得积分。")}
          </p>
        ) : surveyCompleted ? (
          <p className="mt-4 text-sm text-slate-500">
            {t("Thanks for your feedback! 🎉", "感谢你的反馈！🎉")}
          </p>
        ) : !surveyOpen ? (
          <Button className="mt-4 w-full" onClick={() => setSurveyOpen(true)}>
            {t("Take the 2-minute survey", "填写 2 分钟问卷")}
          </Button>
        ) : (
          <div className="mt-4 space-y-3">
            <Textarea
              label={t("What did you find most useful?", "你觉得最有用的是什么？")}
              rows={2}
              value={surveyAnswers.useful}
              onChange={(e) => setSurveyAnswers((p) => ({ ...p, useful: e.target.value }))}
            />
            <Textarea
              label={t("What was missing or confusing?", "有什么缺失或令人困惑的地方？")}
              rows={2}
              value={surveyAnswers.missing}
              onChange={(e) => setSurveyAnswers((p) => ({ ...p, missing: e.target.value }))}
            />
            <Textarea
              label={t("Would you recommend this app? Why or why not?", "你会推荐这个应用吗？为什么？")}
              rows={2}
              value={surveyAnswers.recommend}
              onChange={(e) => setSurveyAnswers((p) => ({ ...p, recommend: e.target.value }))}
            />
            <Button className="w-full" onClick={() => void submitSurvey()} disabled={surveySubmitting}>
              {surveySubmitting
                ? t("Submitting…", "提交中…")
                : t("Submit and get +10 credits", "提交并获得 +10 积分")}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
