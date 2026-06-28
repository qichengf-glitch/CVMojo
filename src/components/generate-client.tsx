"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ResumePreviewModal } from "@/components/resume-preview-modal";
import type { GenerateResult, KeywordPlacement } from "@/lib/types";
import { extractResumeText, guessNameFromResumeText, safeName } from "@/lib/resume-files";
import {
  isMissingStoredResumeColumnsError,
  saveStoredResumeSource,
} from "@/lib/profile-client";
import { createClient } from "@/lib/supabase/client";
import {
  loadLocalStoredResumeSource,
  saveLocalStoredResumeFile,
  saveLocalStoredResumeSource,
} from "@/lib/stored-resume";
import { AppHeader, Button, Card, ErrorBanner, Input, Textarea } from "@/components/ui";
import { GoogleButton } from "@/components/google-button";
import { LanguageToggle } from "@/components/language-toggle";
import { useI18n } from "@/lib/i18n";
import { FadeIn } from "@/components/motion";

function TailoringSummary({ text }: { text: string }) {
  return (
    <div className="space-y-1">
      {text
        .trim()
        .split(/\n+/)
        .filter(Boolean)
        .map((line, index) => {
          const colonIndex = line.search(/[:：]/);
          if (colonIndex > 0) {
            const label = line.slice(0, colonIndex + 1);
            const rest = line.slice(colonIndex + 1);
            return (
              <p key={index} className="m-0">
                <span className="font-bold text-slate-800">{label}</span>
                {rest}
              </p>
            );
          }
          return (
            <p key={index} className="m-0">
              {line}
            </p>
          );
        })}
    </div>
  );
}

// Detect which sections a resume actually has, so we only offer placements that
// fit this candidate's resume (for example, no "relevant coursework" option when
// there is no education section).
function detectResumeSections(resume: string): {
  skill: boolean;
  coursework: boolean;
  experience: boolean;
} {
  const headerLines = resume
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => {
      if (!line || /^[•\-*·]/.test(line)) return false;
      const words = line.split(/\s+/);
      if (words.length > 6) return false;
      const isUpper = /[A-Z]/.test(line) && line === line.toUpperCase();
      const looksLikeHeader =
        /^(education|skills?|technical skills|specialized skills|experience|work|employment|projects?|certification|coursework|additional)/i.test(
          line
        );
      return isUpper || looksLikeHeader;
    })
    .join(" | ")
    .toLowerCase();

  // Only offer "relevant coursework" when there is an education section AND the
  // resume already lists coursework to append to. Many resumes have no coursework
  // line, and we should not invent that section for them.
  const hasEducation = /education/.test(headerLines);
  const hasCourseworkLine = /(relevant\s+)?course\s?work|relevant courses/i.test(resume);

  return {
    skill: /skill/.test(headerLines),
    coursework: hasEducation && hasCourseworkLine,
    experience: /experience|project|employment|work history/.test(headerLines),
  };
}

function placementOptionsForResume(resume: string): KeywordPlacement[] {
  const sections = detectResumeSections(resume);
  const options: KeywordPlacement[] = [];
  if (sections.skill) options.push("skill");
  if (sections.coursework) options.push("coursework");
  if (sections.experience) options.push("experience");
  // Fallback: if we could not detect any structure, offer all so the feature
  // still works rather than leaving the user with no way to add a keyword.
  return options.length > 0 ? options : ["skill", "coursework", "experience"];
}

export default function GenerateClient() {
  const { t } = useI18n();
  const [resumeText, setResumeText] = useState("");
  const [resumeFileName, setResumeFileName] = useState("");
  const [resumeMimeType, setResumeMimeType] = useState("");
  const [jobLink, setJobLink] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [lang, setLang] = useState<"en" | "zh">("en");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [activeLang, setActiveLang] = useState<"en" | "zh">("en");
  const [activeTab, setActiveTab] = useState<"resume" | "cover">("resume");
  const [userName, setUserName] = useState("");
  const [resumeLoading, setResumeLoading] = useState(true);
  const [hasSavedProfile, setHasSavedProfile] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [showResumePreview, setShowResumePreview] = useState(false);
  const [clearingResume, setClearingResume] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<"" | "docx" | "pdf">("");
  const [placements, setPlacements] = useState<Record<string, KeywordPlacement | "none">>({});
  const [refining, setRefining] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);

  // Capture a referral code from the landing URL (?ref=...) so we can credit the
  // referrer once this visitor becomes a registered user.
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (ref) localStorage.setItem("cvmojo_ref", ref);
    } catch {
      // ignore
    }
  }, []);

  // Once the visitor is a real (registered) user, claim any pending referral.
  useEffect(() => {
    if (!isRegistered) return;
    let ref: string | null = null;
    try {
      ref = localStorage.getItem("cvmojo_ref");
    } catch {
      // ignore
    }
    if (!ref) return;
    void fetch("/api/referral", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referrer: ref }),
    }).finally(() => {
      try {
        localStorage.removeItem("cvmojo_ref");
      } catch {
        // ignore
      }
    });
  }, [isRegistered]);

  // Reset keyword choices whenever a fresh result or language is shown.
  useEffect(() => {
    setPlacements({});
  }, [result, activeLang]);

  const refreshCredits = useCallback(async () => {
    try {
      const res = await fetch("/api/credits");
      if (!res.ok) return;
      const data = await res.json();
      setCredits(typeof data.credits === "number" ? data.credits : 0);
      setIsRegistered(Boolean(data.signedIn) && !data.isAnonymous);
    } catch {
      // Non-fatal: credits just won't display.
    }
  }, []);

  const loadStoredResume = useCallback(async () => {
    setResumeLoading(true);
    try {
      const supabase = createClient();
      let {
        data: { user },
      } = await supabase.auth.getUser();

      // Guests get a frictionless anonymous session so they can try without
      // signing up. Requires "Anonymous sign-ins" enabled in Supabase.
      if (!user) {
        const { data: anon } = await supabase.auth.signInAnonymously();
        user = anon.user ?? null;
      }

      if (!user) {
        setIsRegistered(false);
        return;
      }

      setIsRegistered(!user.is_anonymous);
      setCurrentUserId(user.id);
      void refreshCredits();

      const { data, error: profileError } = await supabase
        .from("user_profiles")
        .select("full_name, email, phone, location")
        .eq("id", user.id)
        .single();

      if (profileError) throw new Error(profileError.message);

      const [workCountRes, skillsCountRes, projectsCountRes, educationCountRes] = await Promise.all([
        supabase.from("work_experience").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("skills").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("projects").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("education").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      ]);

      const savedProfileDetected = Boolean(
        data?.full_name ||
          data?.email ||
          data?.phone ||
          data?.location ||
          (workCountRes.count ?? 0) > 0 ||
          (skillsCountRes.count ?? 0) > 0 ||
          (projectsCountRes.count ?? 0) > 0 ||
          (educationCountRes.count ?? 0) > 0
      );
      setHasSavedProfile(savedProfileDetected);

      if (data?.full_name && !userName.trim()) {
        setUserName(data.full_name);
      }

      try {
        const { data: storedResume, error: storedResumeError } = await supabase
          .from("user_profiles")
          .select("resume_file_name, resume_text")
          .eq("id", user.id)
          .single();

        if (storedResumeError) throw new Error(storedResumeError.message);

        if (storedResume?.resume_text) {
          setResumeText(storedResume.resume_text);
        }
        if (storedResume?.resume_file_name) {
          setResumeFileName(storedResume.resume_file_name);
        }
      } catch (e) {
        if (!isMissingStoredResumeColumnsError(e)) {
          throw e;
        }
      }

      const localResume = loadLocalStoredResumeSource(user.id);
      if (localResume) {
        setResumeText(localResume.resumeText);
        setResumeFileName(localResume.resumeFileName);
        setResumeMimeType(localResume.resumeMimeType ?? "");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load your saved resume.");
    } finally {
      setResumeLoading(false);
    }
  }, [userName, refreshCredits]);

  useEffect(() => {
    void loadStoredResume();
  }, [loadStoredResume]);

  async function handleResumeFile(file: File) {
    setError("");

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const text = await extractResumeText(file);
      setResumeText(text);
      setResumeFileName(file.name);
      setResumeMimeType(file.type);
      setShowResumePreview(false);
      if (!userName.trim()) {
        const guessed = guessNameFromResumeText(text);
        if (guessed) setUserName(guessed);
      }
      if (user) {
        saveLocalStoredResumeSource(user.id, {
          resumeFileName: file.name,
          resumeText: text,
          resumeMimeType: file.type,
        });
        await saveLocalStoredResumeFile(user.id, file);
        try {
          await saveStoredResumeSource(user.id, {
            resumeFileName: file.name,
            resumeText: text,
          });
        } catch (e) {
          if (!isMissingStoredResumeColumnsError(e)) {
            throw e;
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file.");
    }
  }

  async function clearResume() {
    setError("");
    setClearingResume(true);

    try {
      setResumeText("");
      setResumeFileName("");
      setResumeMimeType("");
      setShowResumePreview(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't clear the current resume.");
    } finally {
      setClearingResume(false);
    }
  }

  async function resetResumeSource() {
    setError("");
    setResetting(true);

    try {
      setResumeText("");
      setResumeFileName("");
      setResumeMimeType("");
      setResult(null);
      setActiveLang("en");
      setActiveTab("resume");
      setShowResumePreview(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't reset the page.");
    } finally {
      setResetting(false);
    }
  }

  async function generate() {
    setError("");
    if (!jobDescription.trim() && !jobLink.trim()) {
      setError("Paste the job description or at least a job link.");
      return;
    }
    const supabase = createClient();
    let {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      const { data: anon } = await supabase.auth.signInAnonymously();
      user = anon.user ?? null;
    }
    if (!user) {
      setError("Couldn't start a session. Please sign in to continue.");
      return;
    }
    if (credits !== null && credits <= 0) {
      // The out-of-credits panel is already shown.
      return;
    }

    setLoading(true);
    setResult(null);

    const language = lang;

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText, jobLink, jobDescription, language }),
      });
      const data = await res.json();
      if (res.status === 402) {
        setCredits(0);
        await refreshCredits();
        return;
      }
      if (!res.ok) throw new Error(data.error || "Generation failed.");

      setResult(data);
      if (typeof data.credits === "number") setCredits(data.credits);
      setActiveLang(data.docs.en ? "en" : "zh");
      setActiveTab("resume");

      const profileRes = await fetch("/api/profile-name");
      if (profileRes.ok) {
        const { name } = await profileRes.json();
        if (name) setUserName(name);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function fileBase(kind: "Resume" | "CoverLetter", lang: "en" | "zh") {
    const name = safeName(userName) || "Resume";
    const company = safeName(result?.company ?? "") || "Company";
    const suffix = lang === "zh" ? "_CN" : "_EN";
    return `${name}_${company}_${kind}${suffix}`;
  }

  function currentContent() {
    const doc = result?.docs[activeLang];
    if (!doc) return "";
    return activeTab === "resume" ? doc.resume : doc.coverLetter;
  }

  function copy() {
    navigator.clipboard.writeText(currentContent());
  }

  async function download(format: "docx" | "pdf") {
    if (!result) return;

    setError("");
    setExportingFormat(format);

    const kind = activeTab === "resume" ? "Resume" : "CoverLetter";

    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: currentContent(),
          fileName: fileBase(kind, activeLang),
          format,
          documentType: activeTab === "resume" ? "resume" : "cover_letter",
          language: activeLang,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || `Failed to export ${format.toUpperCase()}.`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileBase(kind, activeLang)}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to export ${format.toUpperCase()}.`);
    } finally {
      setExportingFormat("");
    }
  }

  const missingKeywords = result?.docs[activeLang]?.missingKeywords ?? [];
  const outOfCredits = credits !== null && credits <= 0;
  const activeResume = result?.docs[activeLang]?.resume ?? "";
  const placementOptions = activeResume ? placementOptionsForResume(activeResume) : [];

  async function applyKeywords() {
    const doc = result?.docs[activeLang];
    if (!doc) return;

    const additions = Object.entries(placements)
      .filter(([keyword, placement]) => placement !== "none" && missingKeywords.includes(keyword))
      .map(([keyword, placement]) => ({ keyword, placement: placement as KeywordPlacement }));

    if (additions.length === 0) {
      setError("Choose how to add at least one keyword (skill, coursework, or experience).");
      return;
    }

    setError("");
    setRefining(true);

    try {
      const res = await fetch("/api/refine-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume: doc.resume,
          language: activeLang,
          additions,
          resumeText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't update the resume.");

      const appliedKeywords = additions.map((a) => a.keyword);

      setResult((prev) => {
        if (!prev) return prev;
        const prevDoc = prev.docs[activeLang];
        if (!prevDoc) return prev;
        return {
          ...prev,
          docs: {
            ...prev.docs,
            [activeLang]: {
              ...prevDoc,
              resume: data.resume,
              missingKeywords: (prevDoc.missingKeywords ?? []).filter(
                (k) => !appliedKeywords.includes(k)
              ),
            },
          },
        };
      });
      setPlacements({});
      setActiveTab("resume");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update the resume.");
    } finally {
      setRefining(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <ResumePreviewModal
        open={showResumePreview}
        onClose={() => setShowResumePreview(false)}
        source={
          resumeFileName
            ? {
                fileName: resumeFileName,
                resumeText,
                resumeMimeType,
              }
            : null
        }
        userId={currentUserId}
      />

      <AppHeader
        tagline={t(
          "Upload a resume and job description to generate tailored documents.",
          "上传简历和职位描述，生成量身定制的文档。"
        )}
      >
        <div className="flex flex-col gap-2 sm:items-end">
          <div className="flex flex-nowrap items-center gap-2">
            <Link href="/earn">
              <Button variant="secondary" size="sm">{t("Earn More Credit", "获取更多积分")}</Button>
            </Link>
            {isRegistered ? (
              <Link href="/dashboard">
                <Button variant="secondary" size="sm">{t("Profile", "个人资料")}</Button>
              </Link>
            ) : (
              <>
                <Link href="/login?next=/generate">
                  <Button variant="secondary" size="sm">{t("Sign in", "登录")}</Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm">{t("Sign up", "注册")}</Button>
                </Link>
              </>
            )}
            <LanguageToggle size="sm" />
          </div>
          {credits !== null && (
            <span className="rounded-full bg-[#f5f3ff] px-3 py-1.5 text-sm font-semibold text-[#5b21b6]">
              {credits} {t("credits", "积分")}
            </span>
          )}
        </div>
      </AppHeader>

      <Card className="mb-6">
        <h2 className="text-lg font-bold text-slate-900">{t("Resume", "简历")}</h2>
        <p className="mt-2 text-sm text-slate-500">
          {t(
            "Upload your resume for one-time generation, or leave this blank to use your saved profile.",
            "上传简历进行单次生成，或留空以使用已保存的个人资料。"
          )}
        </p>

        {!resumeLoading && hasSavedProfile && (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {t(
              "Saved profile available. Leave the resume blank to generate from your existing profile.",
              "已检测到保存的个人资料。留空简历即可使用现有资料生成。"
            )}
          </div>
        )}

        <label
          className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-[#7c3aed] bg-[#f5f3ff] px-6 py-8 text-center transition-colors hover:bg-[#ede9fe]"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) void handleResumeFile(file);
          }}
        >
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleResumeFile(file);
              e.target.value = "";
            }}
          />
          <span className="text-2xl font-bold leading-none text-[#7c3aed]">↑</span>
          <span className="mt-2 text-sm font-semibold text-[#5b21b6]">
            {resumeLoading ? t("Loading saved resume…", "正在加载已保存的简历…") : t("Upload resume", "上传简历")}
          </span>
          <span className="text-xs text-slate-500">
            {t("PDF, DOCX, or TXT — or drag it here", "PDF、DOCX 或 TXT —— 或拖拽到此处")}
          </span>
        </label>

        {!resumeLoading && resumeFileName && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <button
              type="button"
              onClick={() => setShowResumePreview(true)}
              className="min-w-0 truncate text-left text-sm font-medium text-emerald-800"
            >
              {t("Resume on file:", "已保存简历：")} {resumeFileName}
            </button>
            <button
              type="button"
              onClick={() => void clearResume()}
              disabled={clearingResume}
              className="shrink-0 text-sm font-semibold text-emerald-700 transition hover:text-emerald-900 disabled:opacity-60"
            >
              {clearingResume ? t("Clearing...", "清除中...") : t("Clear", "清除")}
            </button>
          </div>
        )}

        <div className="mt-3 flex justify-end">
          <Button variant="secondary" onClick={() => void resetResumeSource()} disabled={resetting || clearingResume}>
            {resetting ? t("Resetting...", "重置中...") : t("Reset", "重置")}
          </Button>
        </div>

        <div className="mt-4">
          <Textarea
            label={t("Resume text", "简历文本")}
            rows={8}
            placeholder={t(
              "Upload a PDF, DOCX, or TXT resume, or paste your resume text here.",
              "上传 PDF、DOCX 或 TXT 简历，或在此粘贴简历文本。"
            )}
            value={resumeText}
            onChange={(e) => {
              const next = e.target.value;
              setResumeText(next);
              if (!userName.trim()) {
                const guessed = guessNameFromResumeText(next);
                if (guessed) setUserName(guessed);
              }
            }}
          />
        </div>
      </Card>

      <Card>
        <Input
          label={t("Job link", "职位链接")}
          placeholder={t("https://… (optional)", "https://…（可选）")}
          value={jobLink}
          onChange={(e) => setJobLink(e.target.value)}
        />
        <div className="mt-3">
          <Textarea
            label={t("Job description", "职位描述")}
            rows={8}
            placeholder={t("Paste the full job description", "粘贴完整的职位描述")}
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
          />
        </div>
        <p className="mt-2 text-xs text-slate-400">
          {t("Tip: paste the actual description text for best results.", "提示：粘贴真实的职位描述文本以获得最佳效果。")}
        </p>

        <div className="mt-4">
          <span className="mb-2 block text-sm font-semibold text-slate-700">{t("Language", "语言")}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setLang("en")}
              className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold ${
                lang === "en" ? "border-[#7c3aed] bg-[#f5f3ff] text-[#5b21b6]" : "border-slate-300"
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setLang("zh")}
              className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold ${
                lang === "zh" ? "border-[#7c3aed] bg-[#f5f3ff] text-[#5b21b6]" : "border-slate-300"
              }`}
            >
              中文
            </button>
          </div>
        </div>

        {!outOfCredits && (
          <Button onClick={generate} disabled={loading} className="mt-6 w-full">
            {loading
              ? t("Tailoring your documents…", "正在定制你的文档…")
              : t("Generate resume + cover letter", "生成简历 + 求职信")}
          </Button>
        )}

        {outOfCredits && !isRegistered && (
          <div className="mt-6 rounded-xl border border-[#7c3aed] bg-[#f5f3ff] p-4">
            <p className="font-bold text-slate-900">
              {t("You've used your 3 free tries", "你已用完 3 次免费试用")}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {t("Create a free account to get 30 more generations.", "创建免费账户即可再获得 30 次生成。")}
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <Link href="/signup">
                <Button className="w-full">{t("Sign up free", "免费注册")}</Button>
              </Link>
              <GoogleButton next="/generate" label={t("Sign up with Google", "使用 Google 注册")} />
              <Link href="/login?next=/generate">
                <Button variant="secondary" className="w-full">
                  {t("I already have an account", "我已有账户")}
                </Button>
              </Link>
            </div>
          </div>
        )}

        {outOfCredits && isRegistered && (
          <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4">
            <p className="font-bold text-slate-900">{t("You're out of credits", "积分已用完")}</p>
            <p className="mt-1 text-sm text-slate-600">
              {t(
                "Earn more free credits by referring friends or sharing feedback, or buy more.",
                "通过邀请好友或填写反馈即可获得更多免费积分，也可以购买。"
              )}
            </p>
            <Link href="/earn">
              <Button className="mt-3 w-full">{t("Earn More Credit", "获取更多积分")}</Button>
            </Link>
            <Button
              variant="secondary"
              className="mt-2 w-full"
              onClick={() => setError(t("Paid credits are coming soon.", "付费积分即将上线。"))}
            >
              {t("Buy more credits (coming soon)", "购买更多积分（即将上线）")}
            </Button>
          </div>
        )}
      </Card>

      <ErrorBanner message={error} />

      {result && (
        <FadeIn className="mt-6 overflow-hidden rounded-2xl border border-[#7c3aed]">
          <div className="border-b border-slate-200 bg-[#f5f3ff] px-5 py-3">
            <span className="font-bold text-[#5b21b6]">
              {t("Tailored for", "为以下公司定制：")} {result.company}
            </span>
          </div>

          {activeTab === "resume" && result.docs[activeLang]?.tailoringSummary && (
            <div className="border-b border-slate-200 bg-amber-50 px-5 py-3 text-sm leading-relaxed text-slate-700">
              <p className="mb-1 font-semibold text-slate-800">{t("Tailoring notes", "定制说明")}</p>
              <TailoringSummary text={result.docs[activeLang]?.tailoringSummary ?? ""} />
            </div>
          )}

          {activeTab === "resume" && missingKeywords.length > 0 && (
            <div className="border-b border-slate-200 bg-white px-5 py-4">
              <p className="font-semibold text-slate-800">{t("Add missing keywords", "添加缺失的关键词")}</p>
              <p className="mt-1 mb-3 text-xs text-slate-500">
                {t(
                  "Choose how to add any keyword you genuinely have. The resume updates automatically.",
                  "选择如何添加你确实具备的关键词，简历会自动更新。"
                )}
              </p>
              <div className="space-y-2">
                {missingKeywords.map((kw) => (
                  <div key={kw} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 flex-1 break-words text-sm text-slate-700">{kw}</span>
                    <select
                      value={placements[kw] ?? "none"}
                      onChange={(e) =>
                        setPlacements((p) => ({
                          ...p,
                          [kw]: e.target.value as KeywordPlacement | "none",
                        }))
                      }
                      className="shrink-0 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700"
                    >
                      <option value="none">{t("Don't add", "不添加")}</option>
                      {placementOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt === "skill"
                            ? t("Add as skill", "作为技能添加")
                            : opt === "coursework"
                              ? t("Add as relevant coursework", "作为相关课程添加")
                              : t("Add to experience", "添加到经历中")}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <Button onClick={() => void applyKeywords()} disabled={refining} className="mt-3 w-full">
                {refining ? t("Updating resume…", "正在更新简历…") : t("Apply selected keywords", "应用所选关键词")}
              </Button>
            </div>
          )}

          {result.docs.en && result.docs.zh && (
            <div className="flex gap-2 px-5 pt-3">
              {(["en", "zh"] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setActiveLang(lang)}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                    activeLang === lang ? "bg-[#7c3aed] text-white" : "border border-slate-300"
                  }`}
                >
                  {lang === "en" ? "English" : "中文"}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-1 px-3 pt-3">
            <button
              type="button"
              onClick={() => setActiveTab("resume")}
              className={`flex-1 truncate rounded-t-lg px-2 py-2 text-xs font-semibold ${
                activeTab === "resume" ? "bg-white text-[#5b21b6] shadow-[inset_0_-2px_0_#7c3aed]" : "bg-slate-100"
              }`}
            >
              {fileBase("Resume", activeLang)}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("cover")}
              className={`flex-1 truncate rounded-t-lg px-2 py-2 text-xs font-semibold ${
                activeTab === "cover" ? "bg-white text-[#5b21b6] shadow-[inset_0_-2px_0_#7c3aed]" : "bg-slate-100"
              }`}
            >
              {fileBase("CoverLetter", activeLang)}
            </button>
          </div>

          <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words p-5 font-mono text-[13px] leading-relaxed">
            {currentContent()}
          </pre>

          <div className="flex gap-2 border-t border-slate-200 p-4">
            <Button variant="secondary" className="flex-1" onClick={copy}>
              {t("Copy text", "复制文本")}
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => void download("docx")}
              disabled={exportingFormat !== ""}
            >
              {exportingFormat === "docx" ? t("Exporting DOCX...", "正在导出 DOCX...") : t("Download DOCX", "下载 DOCX")}
            </Button>
            <Button
              className="flex-1"
              onClick={() => void download("pdf")}
              disabled={exportingFormat !== ""}
            >
              {exportingFormat === "pdf" ? t("Exporting PDF...", "正在导出 PDF...") : t("Download PDF", "下载 PDF")}
            </Button>
          </div>
        </FadeIn>
      )}
    </div>
  );
}
