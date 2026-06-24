"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ResumePreviewModal } from "@/components/resume-preview-modal";
import type { GenerateResult } from "@/lib/types";
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
import { FadeIn } from "@/components/motion";

export default function GenerateClient() {
  const [resumeText, setResumeText] = useState("");
  const [resumeFileName, setResumeFileName] = useState("");
  const [resumeMimeType, setResumeMimeType] = useState("");
  const [jobLink, setJobLink] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [langs, setLangs] = useState({ en: true, zh: false });
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
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const loadStoredResume = useCallback(async () => {
    setResumeLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsLoggedIn(false);
        return;
      }

      setIsLoggedIn(true);
      setCurrentUserId(user.id);

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
  }, [userName]);

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
    if (!langs.en && !langs.zh) {
      setError("Pick at least one language.");
      return;
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Sign in or create an account to generate documents.");
      return;
    }

    setLoading(true);
    setResult(null);

    const language = langs.en && langs.zh ? "both" : langs.en ? "en" : "zh";

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText, jobLink, jobDescription, language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed.");

      setResult(data);
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
        <div className="flex flex-wrap gap-2">
          {isLoggedIn ? (
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
              onClick={() => setLangs((p) => ({ ...p, en: !p.en }))}
              className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold ${
                langs.en ? "border-[#7c3aed] bg-[#f5f3ff] text-[#5b21b6]" : "border-slate-300"
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setLangs((p) => ({ ...p, zh: !p.zh }))}
              className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold ${
                langs.zh ? "border-[#7c3aed] bg-[#f5f3ff] text-[#5b21b6]" : "border-slate-300"
              }`}
            >
              中文
            </button>
          </div>
        </div>

        <Button onClick={generate} disabled={loading} className="mt-6 w-full">
          {loading ? "Tailoring your documents…" : "Generate resume + cover letter"}
        </Button>
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
              <pre className="m-0 whitespace-pre-wrap font-sans">{result.docs[activeLang]?.tailoringSummary}</pre>
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
