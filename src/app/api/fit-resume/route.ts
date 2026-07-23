import { NextResponse } from "next/server";
import { fitEditedResumeToOnePage } from "@/lib/resume-fit";
import { hasSupabasePublicEnv, SUPABASE_ENV_ERROR } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

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

  const { resume, language } = (await request.json()) as {
    resume?: string;
    language?: "en" | "zh";
  };

  if (!resume?.trim()) {
    return NextResponse.json({ error: "Resume content is required." }, { status: 400 });
  }
  if (language !== "en" && language !== "zh") {
    return NextResponse.json({ error: "Invalid language." }, { status: 400 });
  }

  try {
    const fitted = await fitEditedResumeToOnePage(resume, language);
    return NextResponse.json({ resume: fitted });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fit resume to one page.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
