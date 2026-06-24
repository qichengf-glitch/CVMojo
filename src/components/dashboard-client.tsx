"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ResumePreviewModal } from "@/components/resume-preview-modal";
import { createClient } from "@/lib/supabase/client";
import { hasSupabasePublicEnv, SUPABASE_ENV_ERROR } from "@/lib/supabase/env";
import { extractResumeText } from "@/lib/resume-files";
import {
  loadLocalStoredResumeSource,
  saveLocalStoredResumeFile,
  saveLocalStoredResumeSource,
} from "@/lib/stored-resume";
import type { ParsedResume } from "@/lib/types";
import { emptyParsedResume } from "@/lib/types";
import { isMissingStoredResumeColumnsError, saveParsedProfile, saveStoredResumeSource } from "@/lib/profile-client";
import { AppHeader, Button, Card, ErrorBanner } from "@/components/ui";
import { ExpandableSection, FadeIn } from "@/components/motion";
import { ProfileFields } from "@/components/profile-fields";

function hasProfileContent(data: ParsedResume) {
  return Boolean(
    data.full_name ||
      data.email ||
      data.phone ||
      data.location ||
      data.work_experience.length ||
      data.skills.length ||
      data.projects.length ||
      data.education.length
  );
}

function applyImportedProfile(current: ParsedResume, parsed: ParsedResume): ParsedResume {
  return {
    full_name: parsed.full_name.trim() || current.full_name,
    email: parsed.email.trim() || current.email,
    phone: parsed.phone.trim() || current.phone,
    location: parsed.location.trim() || current.location,
    work_experience: parsed.work_experience.length ? parsed.work_experience : current.work_experience,
    skills: parsed.skills.length ? parsed.skills : current.skills,
    projects: parsed.projects.length ? parsed.projects : current.projects,
    education: parsed.education.length ? parsed.education : current.education,
  };
}

export default function DashboardClient() {
  const router = useRouter();
  const isSupabaseConfigured = hasSupabasePublicEnv();
  const [form, setForm] = useState<ParsedResume>(emptyParsedResume());
  const [error, setError] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [importing, setImporting] = useState(false);
  const [importedResumeSource, setImportedResumeSource] = useState<{
    fileName: string;
    resumeText: string;
    resumeMimeType?: string;
  } | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [showResumePreview, setShowResumePreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setCurrentUserId(user.id);

      const [profileRes, workRes, skillsRes, projectsRes, eduRes] = await Promise.all([
        supabase.from("user_profiles").select("*").eq("id", user.id).single(),
        supabase.from("work_experience").select("*").eq("user_id", user.id).order("sort_order"),
        supabase.from("skills").select("*").eq("user_id", user.id).order("sort_order"),
        supabase.from("projects").select("*").eq("user_id", user.id).order("sort_order"),
        supabase.from("education").select("*").eq("user_id", user.id).order("sort_order"),
      ]);

      if (profileRes.data) {
        const p = profileRes.data;
        const work = workRes.data ?? [];
        const skills = skillsRes.data ?? [];
        const projects = projectsRes.data ?? [];
        const education = eduRes.data ?? [];
        setForm({
          full_name: p.full_name ?? "",
          email: p.email ?? "",
          phone: p.phone ?? "",
          location: p.location ?? "",
          work_experience: work.map((w) => ({
            company: w.company,
            title: w.title,
            start_date: w.start_date ?? "",
            end_date: w.end_date ?? "",
            currently_working: w.currently_working ?? false,
            bullets: w.bullets ?? [],
          })),
          skills: skills.map((s) => s.name),
          projects: projects.map((pr) => ({
            name: pr.name,
            description: pr.description ?? "",
            bullets: pr.bullets ?? [],
          })),
          education: education.map((e) => ({
            school: e.school,
            degree: e.degree ?? "",
            field: e.field ?? "",
            graduation_date: e.graduation_date ?? "",
          })),
        });

        if (p.resume_file_name && p.resume_text) {
          setImportedResumeSource({
            fileName: p.resume_file_name,
            resumeText: p.resume_text,
            resumeMimeType: undefined,
          });
        } else {
          const localResume = loadLocalStoredResumeSource(user.id);
          if (localResume) {
            setImportedResumeSource({
              fileName: localResume.resumeFileName,
              resumeText: localResume.resumeText,
              resumeMimeType: localResume.resumeMimeType,
            });
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load profile.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setError(SUPABASE_ENV_ERROR);
      setLoading(false);
      return;
    }

    void loadProfile();
  }, [isSupabaseConfigured, loadProfile]);

  async function save() {
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
      await saveParsedProfile(user.id, form);
      if (importedResumeSource) {
        try {
          await saveStoredResumeSource(user.id, {
            resumeFileName: importedResumeSource.fileName,
            resumeText: importedResumeSource.resumeText,
          });
        } catch (e) {
          if (!isMissingStoredResumeColumnsError(e)) {
            throw e;
          }
        }
      }
      setImportedResumeSource(null);
      await loadProfile();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    if (!isSupabaseConfigured) {
      setError(SUPABASE_ENV_ERROR);
      return;
    }

    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function importResume(file: File) {
    if (!isSupabaseConfigured) {
      setError(SUPABASE_ENV_ERROR);
      return;
    }

    setError("");
    setImportMessage("");
    setImporting(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const resumeText = await extractResumeText(file);
      const res = await fetch("/api/parse-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText }),
      });
      const parsed = await res.json();

      if (!res.ok) {
        throw new Error(parsed.error || "Failed to import resume.");
      }

      setForm((current) => applyImportedProfile(current, parsed as ParsedResume));
      setImportedResumeSource({
        fileName: file.name,
        resumeText,
        resumeMimeType: file.type,
      });
      setShowResumePreview(false);
      if (user) {
        saveLocalStoredResumeSource(user.id, {
          resumeFileName: file.name,
          resumeText,
          resumeMimeType: file.type,
        });
        await saveLocalStoredResumeFile(user.id, file);
        try {
          await saveStoredResumeSource(user.id, {
            resumeFileName: file.name,
            resumeText,
          });
        } catch (e) {
          if (!isMissingStoredResumeColumnsError(e)) {
            throw e;
          }
        }
      }
      setImportMessage(`Imported ${file.name}. Review the extracted sections, then save changes.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't import that resume.");
    } finally {
      setImporting(false);
    }
  }

  function resetProfileForm() {
    setForm(emptyParsedResume());
    setImportMessage("");
    setImportedResumeSource(null);
    setShowResumePreview(false);
    setError("");
  }

  if (loading) {
    return <div className="p-10 text-center text-slate-500">Loading your profile…</div>;
  }

  const isEmpty = !hasProfileContent(form);

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <ResumePreviewModal
        open={showResumePreview}
        onClose={() => setShowResumePreview(false)}
        source={importedResumeSource}
        userId={currentUserId}
      />

      <AppHeader tagline="Manage your profile information.">
        <div className="flex flex-wrap gap-2">
          <Link href="/generate">
            <Button variant="secondary">← Main page</Button>
          </Link>
          <Button variant="ghost" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </AppHeader>

      {isEmpty && (
        <Card className="mb-6 bg-[#f5f3ff]">
          <p className="text-sm text-slate-600">
            Your profile is empty.{" "}
            <Link href="/onboarding" className="font-semibold text-[#7c3aed]">
              Complete onboarding
            </Link>{" "}
            to get started.
          </p>
        </Card>
      )}

      <Card className="mb-6 overflow-hidden border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(29,78,216,0.12),_transparent_34%),linear-gradient(180deg,#f8fbff_0%,#f1f7ff_100%)] p-0">
        <div className="border-b border-white/80 px-6 py-6 sm:px-7">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-start">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">Profile</h2>
              <p className="mt-3 text-sm text-slate-500">Import your resume to quickly fill out your profile.</p>
            </div>

            <div className="p-2">
              <label className="inline-flex w-full cursor-pointer items-center justify-center rounded-2xl bg-[#7c3aed] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#5b21b6]">
                {importing ? "Reading resume…" : "Mojo Import"}
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  className="hidden"
                  disabled={importing}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      void importResume(file);
                    }
                    e.target.value = "";
                  }}
                />
              </label>
              <button
                type="button"
                onClick={resetProfileForm}
                className="mt-2 inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-slate-900"
              >
                Reset
              </button>
              <div className="mt-3 text-center text-xs font-medium text-slate-500">
                <p>Upload Your Resume</p>
                <p className="mt-1">Supported: PDF, DOCX, TXT</p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 sm:px-7">
          {importedResumeSource && (
            <button
              type="button"
              onClick={() => setShowResumePreview((value) => !value)}
              className="mb-4 block w-full rounded-2xl border border-emerald-200 bg-[linear-gradient(180deg,#ecfdf5_0%,#dff7ea_100%)] px-4 py-3 text-left text-sm text-emerald-900 transition hover:border-emerald-300"
            >
              <span className="block font-semibold">
                Resume on file: {importedResumeSource.fileName}
              </span>
              <span className="mt-1 block text-xs font-medium text-emerald-800">
                {importMessage || (showResumePreview ? "Hide preview" : "Click to preview")}
              </span>
            </button>
          )}

          {importedResumeSource && showResumePreview && (
            <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Preview opened. Press <span className="font-semibold">Esc</span> or click outside to close.
            </div>
          )}

          {!importedResumeSource && importMessage && (
            <div className="rounded-2xl border border-emerald-200 bg-[linear-gradient(180deg,#ecfdf5_0%,#dff7ea_100%)] px-4 py-3.5 text-sm leading-6 text-emerald-900">
              {importMessage}
            </div>
          )}
        </div>
      </Card>

      <ErrorBanner message={error} />

      <FadeIn className="space-y-4">
        <ExpandableSection title="About you" defaultOpen>
          <ProfileFields.Basics data={form} onChange={setForm} />
        </ExpandableSection>

        <ExpandableSection title="Work experience" count={form.work_experience.length}>
          <ProfileFields.Work data={form} onChange={setForm} />
        </ExpandableSection>

        <ExpandableSection title="Skills" count={form.skills.length}>
          <ProfileFields.Skills data={form} onChange={setForm} />
        </ExpandableSection>

        <ExpandableSection title="Projects" count={form.projects.length}>
          <ProfileFields.Projects data={form} onChange={setForm} />
        </ExpandableSection>

        <ExpandableSection title="Education" count={form.education.length}>
          <ProfileFields.Education data={form} onChange={setForm} />
        </ExpandableSection>

        <Button onClick={save} disabled={saving} className="w-full">
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </FadeIn>
    </div>
  );
}
