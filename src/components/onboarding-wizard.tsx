"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { hasSupabasePublicEnv, SUPABASE_ENV_ERROR } from "@/lib/supabase/env";
import { extractResumeText } from "@/lib/resume-files";
import { markOnboardingSkipped, saveParsedProfile } from "@/lib/profile-client";
import type { ParsedResume } from "@/lib/types";
import { emptyParsedResume } from "@/lib/types";
import { AppHeader, ErrorBanner } from "@/components/ui";
import { StepProgress, StepShell } from "@/components/motion";
import { ProfileFields } from "@/components/profile-fields";

const STEPS = ["welcome", "upload", "basics", "work", "skills", "projects", "education", "done"] as const;
type Step = (typeof STEPS)[number];

const SKIP_LABEL = "Skip profile setup → go to Generate";

export default function OnboardingWizard() {
  const router = useRouter();
  const isSupabaseConfigured = hasSupabasePublicEnv();
  const [step, setStep] = useState<Step>("welcome");
  const [data, setData] = useState<ParsedResume>(emptyParsedResume());
  const [error, setError] = useState("");
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [skipping, setSkipping] = useState(false);

  const stepIndex = STEPS.indexOf(step);

  function goNext() {
    const i = STEPS.indexOf(step);
    if (i < STEPS.length - 1) setStep(STEPS[i + 1]);
  }

  function goBack() {
    const i = STEPS.indexOf(step);
    if (i > 0) setStep(STEPS[i - 1]);
  }

  async function skipToGenerate() {
    if (!isSupabaseConfigured) {
      setError(SUPABASE_ENV_ERROR);
      return;
    }

    setSkipping(true);
    setError("");
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in.");
      await markOnboardingSkipped(user.id);
      router.push("/generate");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't skip onboarding.");
    } finally {
      setSkipping(false);
    }
  }

  async function handleFile(file: File) {
    setError("");

    if (!isSupabaseConfigured) {
      setError(SUPABASE_ENV_ERROR);
      return;
    }

    setParsing(true);
    try {
      const text = await extractResumeText(file);
      const res = await fetch("/api/parse-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText: text }),
      });
      const parsed = await res.json();
      if (!res.ok) throw new Error(parsed.error || "Parse failed");
      setData({
        full_name: parsed.full_name ?? "",
        email: parsed.email ?? "",
        phone: parsed.phone ?? "",
        location: parsed.location ?? "",
        work_experience: parsed.work_experience ?? [],
        skills: parsed.skills ?? [],
        projects: parsed.projects ?? [],
        education: parsed.education ?? [],
      });
      goNext();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file.");
    } finally {
      setParsing(false);
    }
  }

  async function finish() {
    if (!isSupabaseConfigured) {
      setError(SUPABASE_ENV_ERROR);
      return;
    }

    setSaving(true);
    setError("");
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in.");
      await saveParsedProfile(user.id, data);
      router.push("/generate");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  const skipProps = {
    onSkip: skipToGenerate,
    skipLabel: skipping ? "Skipping…" : SKIP_LABEL,
  };

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-5 py-10">
      <AppHeader tagline="Optional — build a profile you can reuse for every application." />
      <StepProgress current={stepIndex + 1} total={STEPS.length} />
      <ErrorBanner message={error} />

      <AnimatePresence mode="wait">
        {step === "welcome" && (
          <StepShell
            key="welcome"
            onNext={goNext}
            showBack={false}
            nextLabel="Build my profile"
            {...skipProps}
          >
            <h2 className="text-2xl font-bold text-slate-900">Welcome to CV Mojo</h2>
            <p className="mt-3 text-slate-600">
              You can save a reusable profile now, or skip and generate a one-off resume and cover letter
              anytime from the Generate page.
            </p>
          </StepShell>
        )}

        {step === "upload" && (
          <StepShell
            key="upload"
            onNext={goNext}
            onBack={goBack}
            nextLabel="Fill in manually"
            nextDisabled={parsing}
            {...skipProps}
          >
            <h2 className="text-xl font-bold">Upload your resume</h2>
            <p className="mt-2 text-sm text-slate-500">
              We&apos;ll auto-fill your profile, or you can fill it in step by step.
            </p>
            <label className="mt-6 flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-[#7c3aed] bg-[#f5f3ff] px-6 py-10 text-center">
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                className="hidden"
                disabled={parsing}
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <span className="text-2xl font-bold text-[#7c3aed]">↑</span>
              <span className="font-semibold text-[#5b21b6]">
                {parsing ? "Reading your resume…" : "Upload PDF, DOCX, or TXT"}
              </span>
            </label>
          </StepShell>
        )}

        {step === "basics" && (
          <StepShell key="basics" onNext={goNext} onBack={goBack} {...skipProps}>
            <h2 className="text-xl font-bold">About you</h2>
            <ProfileFields.Basics data={data} onChange={setData} />
          </StepShell>
        )}

        {step === "work" && (
          <StepShell key="work" onNext={goNext} onBack={goBack} {...skipProps}>
            <h2 className="text-xl font-bold">Work experience</h2>
            <ProfileFields.Work data={data} onChange={setData} />
          </StepShell>
        )}

        {step === "skills" && (
          <StepShell key="skills" onNext={goNext} onBack={goBack} {...skipProps}>
            <h2 className="text-xl font-bold">Skills</h2>
            <ProfileFields.Skills data={data} onChange={setData} />
          </StepShell>
        )}

        {step === "projects" && (
          <StepShell key="projects" onNext={goNext} onBack={goBack} {...skipProps}>
            <h2 className="text-xl font-bold">Projects</h2>
            <ProfileFields.Projects data={data} onChange={setData} />
          </StepShell>
        )}

        {step === "education" && (
          <StepShell
            key="education"
            onNext={goNext}
            onBack={goBack}
            nextLabel="Review & finish"
            {...skipProps}
          >
            <h2 className="text-xl font-bold">Education</h2>
            <ProfileFields.Education data={data} onChange={setData} />
          </StepShell>
        )}

        {step === "done" && (
          <StepShell
            key="done"
            onBack={goBack}
            onNext={finish}
            nextLabel={saving ? "Saving…" : "Save & generate"}
            nextDisabled={saving}
            {...skipProps}
          >
            <h2 className="text-xl font-bold">You&apos;re all set</h2>
            <p className="mt-2 text-slate-600">
              Save your profile for future applications, or skip straight to generating documents.
            </p>
          </StepShell>
        )}
      </AnimatePresence>
    </div>
  );
}
