import type { FullProfile, ParsedResume } from "./types";
import { createClient } from "./supabase/server";

export async function getFullProfile(userId: string): Promise<FullProfile | null> {
  const supabase = await createClient();

  const [profileRes, workRes, skillsRes, projectsRes, eduRes] = await Promise.all([
    supabase.from("user_profiles").select("*").eq("id", userId).single(),
    supabase.from("work_experience").select("*").eq("user_id", userId).order("sort_order"),
    supabase.from("skills").select("*").eq("user_id", userId).order("sort_order"),
    supabase.from("projects").select("*").eq("user_id", userId).order("sort_order"),
    supabase.from("education").select("*").eq("user_id", userId).order("sort_order"),
  ]);

  if (profileRes.error || !profileRes.data) return null;

  return {
    profile: profileRes.data,
    work_experience: workRes.data ?? [],
    skills: skillsRes.data ?? [],
    projects: projectsRes.data ?? [],
    education: eduRes.data ?? [],
  };
}

export async function saveParsedProfile(
  userId: string,
  data: {
    full_name: string;
    email: string;
    phone: string;
    location: string;
    work_experience: FullProfile["work_experience"];
    skills: string[];
    projects: FullProfile["projects"];
    education: FullProfile["education"];
  }
) {
  const supabase = await createClient();

  await supabase
    .from("user_profiles")
    .update({
      full_name: data.full_name,
      email: data.email,
      phone: data.phone,
      location: data.location,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  await supabase.from("work_experience").delete().eq("user_id", userId);
  await supabase.from("skills").delete().eq("user_id", userId);
  await supabase.from("projects").delete().eq("user_id", userId);
  await supabase.from("education").delete().eq("user_id", userId);

  if (data.work_experience.length) {
    await supabase.from("work_experience").insert(
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
  }

  if (data.skills.length) {
    await supabase.from("skills").insert(
      data.skills.map((name, i) => ({ user_id: userId, name, sort_order: i }))
    );
  }

  if (data.projects.length) {
    await supabase.from("projects").insert(
      data.projects.map((p, i) => ({
        user_id: userId,
        name: p.name,
        description: p.description,
        bullets: p.bullets,
        sort_order: i,
      }))
    );
  }

  if (data.education.length) {
    await supabase.from("education").insert(
      data.education.map((e, i) => ({
        user_id: userId,
        school: e.school,
        degree: e.degree,
        field: e.field,
        graduation_date: e.graduation_date,
        sort_order: i,
      }))
    );
  }
}

export function parsedResumeToFullProfile(parsed: ParsedResume, resumeText?: string): FullProfile {
  return {
    profile: {
      id: "uploaded-resume",
      full_name: parsed.full_name || null,
      email: parsed.email || null,
      phone: parsed.phone || null,
      location: parsed.location || null,
      resume_text: resumeText || null,
    },
    work_experience: parsed.work_experience.map((item, index) => ({
      ...item,
      sort_order: index,
    })),
    skills: parsed.skills.map((name, index) => ({ name, sort_order: index })),
    projects: parsed.projects.map((item, index) => ({
      ...item,
      sort_order: index,
    })),
    education: parsed.education.map((item, index) => ({
      ...item,
      sort_order: index,
    })),
  };
}
