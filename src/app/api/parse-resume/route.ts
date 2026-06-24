import { NextResponse } from "next/server";
import { hasSupabasePublicEnv, SUPABASE_ENV_ERROR } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { callOpenAI, parseJsonResponse } from "@/lib/openai";
import { buildParseResumePrompt } from "@/lib/prompts";
import type { ParsedResume } from "@/lib/types";

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

  const { resumeText } = await request.json();
  if (!resumeText?.trim()) {
    return NextResponse.json({ error: "Resume text is required." }, { status: 400 });
  }

  try {
    const text = await callOpenAI(buildParseResumePrompt(resumeText), 4000);
    const parsed = parseJsonResponse<ParsedResume>(text);
    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to parse resume.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
