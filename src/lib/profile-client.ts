"use client";

import { createClient } from "@/lib/supabase/client";
import type { ParsedResume } from "@/lib/types";

export function isMissingStoredResumeColumnsError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("resume_file_name") ||
    error.message.includes("resume_text")
  );
}

export async function saveParsedProfile(userId: string, data: ParsedResume) {
  const supabase = createClient();

  const { error: profileError } = await supabase
    .from("user_profiles")
    .update({
      full_name: data.full_name,
      email: data.email,
      phone: data.phone,
      location: data.location,
      onboarding_completed: true,
      onboarding_skipped: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (profileError) throw new Error(profileError.message);

  await supabase.from("work_experience").delete().eq("user_id", userId);
  await supabase.from("skills").delete().eq("user_id", userId);
  await supabase.from("projects").delete().eq("user_id", userId);
  await supabase.from("education").delete().eq("user_id", userId);

  if (data.work_experience.length) {
    const { error } = await supabase.from("work_experience").insert(
      data.work_experience.map((w, i) => ({
        user_id: userId,
        company: w.company,
        title: w.title,
        start_date: w.start_date,
        end_date: w.end_date,
        currently_working: w.currently_working,
        bullets: w.bullets,
        sort_order: i,
      }))
    );
    if (error) throw new Error(error.message);
  }

  if (data.skills.length) {
    const { error } = await supabase.from("skills").insert(
      data.skills.map((name, i) => ({ user_id: userId, name, sort_order: i }))
    );
    if (error) throw new Error(error.message);
  }

  if (data.projects.length) {
    const { error } = await supabase.from("projects").insert(
      data.projects.map((p, i) => ({
        user_id: userId,
        name: p.name,
        description: p.description,
        bullets: p.bullets,
        sort_order: i,
      }))
    );
    if (error) throw new Error(error.message);
  }

  if (data.education.length) {
    const { error } = await supabase.from("education").insert(
      data.education.map((e, i) => ({
        user_id: userId,
        school: e.school,
        degree: e.degree,
        field: e.field,
        graduation_date: e.graduation_date,
        sort_order: i,
      }))
    );
    if (error) throw new Error(error.message);
  }
}

export async function saveStoredResumeSource(
  userId: string,
  payload: { resumeFileName: string; resumeText: string }
) {
  const supabase = createClient();

  const { error } = await supabase
    .from("user_profiles")
    .update({
      resume_file_name: payload.resumeFileName,
      resume_text: payload.resumeText,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) throw new Error(error.message);
}

export async function clearStoredResumeSource(userId: string) {
  const supabase = createClient();

  const { error } = await supabase
    .from("user_profiles")
    .update({
      resume_file_name: null,
      resume_text: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) throw new Error(error.message);
}

export async function markOnboardingSkipped(userId: string) {
  const supabase = createClient();

  const { error } = await supabase
    .from("user_profiles")
    .update({
      onboarding_skipped: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error && !error.message.includes("onboarding_skipped")) {
    throw new Error(error.message);
  }
}
