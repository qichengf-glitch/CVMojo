import { NextResponse } from "next/server";
import { hasSupabasePublicEnv, SUPABASE_ENV_ERROR } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { callOpenAI, parseJsonResponse } from "@/lib/openai";
import { buildRefineResumePrompt } from "@/lib/prompts";
import { compressResumeToOnePage } from "@/lib/resume-fit";
import { getFullProfile } from "@/lib/profile";
import type { KeywordAddition, KeywordPlacement } from "@/lib/types";

const VALID_PLACEMENTS: KeywordPlacement[] = ["skill", "coursework", "experience"];

export async function POST(request: Request) {
  if (!hasSupabasePublicEnv()) {
    return NextResponse.json({ error: SUPABASE_ENV_ERROR }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { resume, language, additions, resumeText } = (await request.json()) as {
    resume?: string;
    language?: "en" | "zh";
    additions?: KeywordAddition[];
    resumeText?: string;
  };

  if (!resume?.trim()) {
    return NextResponse.json({ error: "Resume content is required." }, { status: 400 });
  }
  if (language !== "en" && language !== "zh") {
    return NextResponse.json({ error: "Invalid language." }, { status: 400 });
  }

  const cleanAdditions = (additions ?? [])
    .filter(
      (a): a is KeywordAddition =>
        Boolean(a) &&
        typeof a.keyword === "string" &&
        a.keyword.trim().length > 0 &&
        VALID_PLACEMENTS.includes(a.placement)
    )
    .map((a) => ({ keyword: a.keyword.trim(), placement: a.placement }));

  if (cleanAdditions.length === 0) {
    return NextResponse.json(
      { error: "Select at least one keyword to add." },
      { status: 400 }
    );
  }

  try {
    let sourceContext = resumeText?.trim() ?? "";
    if (!sourceContext) {
      const profile = await getFullProfile(user.id);
      sourceContext = profile ? JSON.stringify(profile) : resume;
    }

    const text = await callOpenAI(
      buildRefineResumePrompt(resume, cleanAdditions, language, sourceContext),
      8000
    );
    const revised = parseJsonResponse<{ resume: string }>(text).resume?.trim();

    if (!revised) {
      return NextResponse.json({ error: "Could not revise the resume." }, { status: 502 });
    }

    const fitted = await compressResumeToOnePage(revised, language);

    return NextResponse.json({ resume: fitted });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to revise the resume.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
