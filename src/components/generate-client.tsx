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

const PLACEMENT_LABELS: Record<KeywordPlacement, string> = {
  skill: "Add as skill",
  coursework: "Add as relevant coursework",
  experience: "Add to experience",
};

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
  const [surveyCompleted, setSurveyCompleted] = useState(false);
  const [surveyOpen, setSurveyOpen] = useState(false);
  const [surveySubmitting, setSurveySubmitting] = useState(false);
  const [surveyAnswers, setSurveyAnswers] = useState({ useful: "", missing: "", recommend: "" });

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
      setSurveyCompleted(Boolean(data.surveyCompleted));
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

      <AppHeader tagline="Upload a resume and job description to generate tailored documents.">
        <div className="flex flex-wrap items-center gap-2">
          {credits !== null && (
            <span className="rounded-full bg-[#f5f3ff] px-3 py-1.5 text-sm font-semibold text-[#5b21b6]">
              {credits} credit{credits === 1 ? "" : "s"}
            </span>
          )}
          {isRegistered ? (
            <Link href="/dashboard">
              <Button variant="secondary">Profile</Button>
            </Link>
          ) : (
            <>
              <Link href="/login?next=/generate">
                <Button variant="secondary">Sign in</Button>
              </Link>
              <Link href="/signup">
                <Button>Sign up</Button>
              </Link>
            </>
          )}
        </div>
      </AppHeader>

      <Card className="mb-6">
        <h2 className="text-lg font-bold text-slate-900">Resume</h2>
        <p className="mt-2 text-sm text-slate-500">
          Upload your resume for one-time generation, or leave this blank to use your saved profile.
        </p>

        {!resumeLoading && hasSavedProfile && (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Saved profile available. Leave the resume blank to generate from your existing profile.
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
            {resumeLoading ? "Loading saved resume…" : "Upload resume"}
          </span>
          <span className="text-xs text-slate-500">PDF, DOCX, or TXT — or drag it here</span>
        </label>

        {!resumeLoading && resumeFileName && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <button
              type="button"
              onClick={() => setShowResumePreview(true)}
              className="min-w-0 truncate text-left text-sm font-medium text-emerald-800"
            >
              Resume on file: {resumeFileName}
            </button>
            <button
              type="button"
              onClick={() => void clearResume()}
              disabled={clearingResume}
              className="shrink-0 text-sm font-semibold text-emerald-700 transition hover:text-emerald-900 disabled:opacity-60"
            >
              {clearingResume ? "Clearing..." : "Clear"}
            </button>
          </div>
        )}

        <div className="mt-3 flex justify-end">
          <Button variant="secondary" onClick={() => void resetResumeSource()} disabled={resetting || clearingResume}>
            {resetting ? "Resetting..." : "Reset"}
          </Button>
        </div>

        <div className="mt-4">
          <Textarea
            label="Resume text"
            rows={8}
            placeholder="Upload a PDF, DOCX, or TXT resume, or paste your resume text here."
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
          label="Job link"
          placeholder="https://… (optional)"
          value={jobLink}
          onChange={(e) => setJobLink(e.target.value)}
        />
        <div className="mt-3">
          <Textarea
            label="Job description"
            rows={8}
            placeholder="Paste the full job description"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
          />
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Tip: paste the actual description text for best results.
        </p>

        <div className="mt-4">
          <span className="mb-2 block text-sm font-semibold text-slate-700">Language</span>
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
            {loading ? "Tailoring your documents…" : "Generate resume + cover letter"}
          </Button>
        )}

        {outOfCredits && !isRegistered && (
          <div className="mt-6 rounded-xl border border-[#7c3aed] bg-[#f5f3ff] p-4">
            <p className="font-bold text-slate-900">You&apos;ve used your 3 free tries</p>
            <p className="mt-1 text-sm text-slate-600">
              Create a free account to get 30 more generations.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <Link href="/signup">
                <Button className="w-full">Sign up free</Button>
              </Link>
              <GoogleButton next="/generate" label="Sign up with Google" />
              <Link href="/login?next=/generate">
                <Button variant="secondary" className="w-full">
                  I already have an account
                </Button>
              </Link>
            </div>
          </div>
        )}

        {outOfCredits && isRegistered && (
          <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4">
            <p className="font-bold text-slate-900">You&apos;re out of credits</p>
            <p className="mt-1 text-sm text-slate-600">
              {surveyCompleted
                ? "Thanks for your feedback! More ways to get credits are coming soon."
                : "Take a 2-minute survey to earn +10 credits, or buy more."}
            </p>

            {!surveyOpen && (
              <div className="mt-3 flex flex-col gap-2">
                {!surveyCompleted && (
                  <Button className="w-full" onClick={() => setSurveyOpen(true)}>
                    Take survey for +10 credits
                  </Button>
                )}
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => setError("Paid credits are coming soon.")}
                >
                  Buy more credits (coming soon)
                </Button>
              </div>
            )}

            {surveyOpen && (
              <div className="mt-3 space-y-3">
                <Textarea
                  label="What did you find most useful?"
                  rows={2}
                  value={surveyAnswers.useful}
                  onChange={(e) => setSurveyAnswers((p) => ({ ...p, useful: e.target.value }))}
                />
                <Textarea
                  label="What was missing or confusing?"
                  rows={2}
                  value={surveyAnswers.missing}
                  onChange={(e) => setSurveyAnswers((p) => ({ ...p, missing: e.target.value }))}
                />
                <Textarea
                  label="Would you recommend this app? Why or why not?"
                  rows={2}
                  value={surveyAnswers.recommend}
                  onChange={(e) => setSurveyAnswers((p) => ({ ...p, recommend: e.target.value }))}
                />
                <Button
                  className="w-full"
                  onClick={() => void submitSurvey()}
                  disabled={surveySubmitting}
                >
                  {surveySubmitting ? "Submitting…" : "Submit and get +10 credits"}
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      <ErrorBanner message={error} />

      {result && (
        <FadeIn className="mt-6 overflow-hidden rounded-2xl border border-[#7c3aed]">
          <div className="border-b border-slate-200 bg-[#f5f3ff] px-5 py-3">
            <span className="font-bold text-[#5b21b6]">Tailored for {result.company}</span>
          </div>

          {activeTab === "resume" && result.docs[activeLang]?.tailoringSummary && (
            <div className="border-b border-slate-200 bg-amber-50 px-5 py-3 text-sm leading-relaxed text-slate-700">
              <p className="mb-1 font-semibold text-slate-800">Tailoring notes</p>
              <TailoringSummary text={result.docs[activeLang]?.tailoringSummary ?? ""} />
            </div>
          )}

          {activeTab === "resume" && missingKeywords.length > 0 && (
            <div className="border-b border-slate-200 bg-white px-5 py-4">
              <p className="font-semibold text-slate-800">Add missing keywords</p>
              <p className="mt-1 mb-3 text-xs text-slate-500">
                Choose how to add any keyword you genuinely have. The resume updates automatically.
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
                      <option value="none">Don&apos;t add</option>
                      {placementOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {PLACEMENT_LABELS[opt]}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <Button onClick={() => void applyKeywords()} disabled={refining} className="mt-3 w-full">
                {refining ? "Updating resume…" : "Apply selected keywords"}
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
              Copy text
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => void download("docx")}
              disabled={exportingFormat !== ""}
            >
              {exportingFormat === "docx" ? "Exporting DOCX..." : "Download DOCX"}
            </Button>
            <Button
              className="flex-1"
              onClick={() => void download("pdf")}
              disabled={exportingFormat !== ""}
            >
              {exportingFormat === "pdf" ? "Exporting PDF..." : "Download PDF"}
            </Button>
          </div>
        </FadeIn>
      )}
    </div>
  );
}
