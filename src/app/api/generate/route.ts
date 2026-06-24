import { NextResponse } from "next/server";
import { hasSupabasePublicEnv, SUPABASE_ENV_ERROR } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { callOpenAI, parseJsonResponse } from "@/lib/openai";
import { buildGeneratePrompt, buildParseResumePrompt } from "@/lib/prompts";
import { getFullProfile, parsedResumeToFullProfile } from "@/lib/profile";
import type { GenerateResult, ParsedResume } from "@/lib/types";

const MAX_RESUME_NON_EMPTY_LINES = 48;
const MAX_RESUME_CHAR_COUNT = 3400;
const MAX_COVER_LETTER_NON_EMPTY_LINES = 34;
const MAX_COVER_LETTER_CHAR_COUNT = 2500;
const MAX_COVER_LETTER_WORD_COUNT = 360;

function getResumeNonEmptyLineCount(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean).length;
}

function exceedsOnePageBudget(text: string) {
  return (
    getResumeNonEmptyLineCount(text) > MAX_RESUME_NON_EMPTY_LINES ||
    text.trim().length > MAX_RESUME_CHAR_COUNT
  );
}

function getNonEmptyLineCount(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean).length;
}

function getWordCount(text: string) {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function exceedsCoverLetterOnePageBudget(text: string) {
  return (
    getNonEmptyLineCount(text) > MAX_COVER_LETTER_NON_EMPTY_LINES ||
    text.trim().length > MAX_COVER_LETTER_CHAR_COUNT ||
    getWordCount(text) > MAX_COVER_LETTER_WORD_COUNT
  );
}

async function compressResumeToOnePage(
  resume: string,
  language: "en" | "zh"
): Promise<string> {
  let current = resume;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (!exceedsOnePageBudget(current)) return current;

    const prompt =
      language === "zh"
        ? `你是严格控制简历篇幅的编辑。请把下面这份简历压缩到一页，保持原有 section 顺序、标题、公司、学校、职位、日期和整体结构，不要新增信息，不要改成新的模板。优先删弱内容、合并冗余措辞、缩短句子，并保留最强的岗位匹配点。必须返回 JSON，格式如下：
{"resume":"..."}

硬规则：
- 只改 resume，不要输出解释。
- 保持原有结构和 section 顺序。
- 不要删掉最强的经历和关键词。
- 不要虚构任何内容。
- 使用纯文本。

Resume:
---
${current}
---`
        : `You are a strict resume editor. Compress the resume below so it safely fits on one page. Preserve the existing section order, headings, employers, schools, role titles, dates, and overall structure. Do not switch to a new template. Cut weak content first, tighten phrasing, and preserve the strongest job-matching evidence. Return JSON in this exact shape:
{"resume":"..."}

Hard rules:
- Edit the resume only. Do not output commentary.
- Keep the original structure and section order.
- Do not remove the strongest matching experience or the most important keywords.
- Do not invent anything.
- Return plain text only.

Resume:
---
${current}
---`;

    const compressed = parseJsonResponse<{ resume: string }>(await callOpenAI(prompt, 4000)).resume?.trim();
    if (!compressed) return current;
    current = compressed;
  }

  return current;
}

async function compressCoverLetterToOnePage(
  coverLetter: string,
  language: "en" | "zh"
): Promise<string> {
  let current = coverLetter;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (!exceedsCoverLetterOnePageBudget(current)) return current;

    const prompt =
      language === "zh"
        ? `你是严格控制求职信篇幅的编辑。请把下面这封求职信压缩到一页内，保留原有 header block、收件人信息、RE 行、称呼、4段正文和结尾签名。不要虚构信息，不要改成新的结构，不要删除最关键的岗位匹配点。优先压缩冗余句子、空话和重复表达。必须返回 JSON，格式如下：
{"cover_letter":"..."}

硬规则：
- 只改求职信，不要输出解释。
- 保留现有 header block 和 4 段正文结构。
- 保留真实日期、公司名、职位名、签名。
- 不要虚构任何内容。
- 使用纯文本。

Cover letter:
---
${current}
---`
        : `You are a strict cover letter editor. Compress the cover letter below so it safely fits on one page. Preserve the existing header block, recipient block, RE line, greeting, 4 body paragraphs, and signature. Do not invent anything, do not switch to a new structure, and do not remove the strongest job-matching evidence. Cut filler, repetition, and weak phrasing first. Return JSON in this exact shape:
{"cover_letter":"..."}

Hard rules:
- Edit the cover letter only. Do not output commentary.
- Keep the existing header block and 4 body paragraph structure.
- Keep the real date, company name, role title, and signature.
- Do not invent anything.
- Return plain text only.

Cover letter:
---
${current}
---`;

    const compressed = parseJsonResponse<{ cover_letter: string }>(
      await callOpenAI(prompt, 4000)
    ).cover_letter?.trim();

    if (!compressed) return current;
    current = compressed;
  }

  return current;
}

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

  const { jobLink, jobDescription, language, resumeText } = await request.json();

  if (!jobDescription?.trim() && !jobLink?.trim()) {
    return NextResponse.json({ error: "Job description or link is required." }, { status: 400 });
  }
  if (!["en", "zh", "both"].includes(language)) {
    return NextResponse.json({ error: "Invalid language." }, { status: 400 });
  }

  try {
    const profile = resumeText?.trim()
      ? parsedResumeToFullProfile(
          parseJsonResponse<ParsedResume>(
            await callOpenAI(buildParseResumePrompt(resumeText), 4000)
          ),
          resumeText
        )
      : await getFullProfile(user.id);

    if (!profile) {
      return NextResponse.json(
        { error: "Upload a resume or complete your profile first." },
        { status: 400 }
      );
    }

    const text = await callOpenAI(
      buildGeneratePrompt(profile, jobLink ?? "", jobDescription ?? "", language),
      12000
    );
    const parsed = parseJsonResponse<{
      company: string;
      en?: { tailored_resume: string; cover_letter: string; tailoring_summary?: string };
      zh?: { tailored_resume: string; cover_letter: string; tailoring_summary?: string };
    }>(text);

    const result: GenerateResult = {
      company: parsed.company || "Company",
      docs: {},
    };
    if (parsed.en) {
      const compressedResume = await compressResumeToOnePage(parsed.en.tailored_resume, "en");
      const compressedCoverLetter = await compressCoverLetterToOnePage(parsed.en.cover_letter, "en");
      result.docs.en = {
        resume: compressedResume,
        coverLetter: compressedCoverLetter,
        tailoringSummary: parsed.en.tailoring_summary,
      };
    }
    if (parsed.zh) {
      const compressedResume = await compressResumeToOnePage(parsed.zh.tailored_resume, "zh");
      const compressedCoverLetter = await compressCoverLetterToOnePage(parsed.zh.cover_letter, "zh");
      result.docs.zh = {
        resume: compressedResume,
        coverLetter: compressedCoverLetter,
        tailoringSummary: parsed.zh.tailoring_summary,
      };
    }

    const saves = [];
    for (const lang of ["en", "zh"] as const) {
      const doc = result.docs[lang];
      if (!doc) continue;
      saves.push(
        supabase.from("generated_documents").insert({
          user_id: user.id,
          company: result.company,
          language: lang,
          doc_type: "resume",
          content: doc.resume,
        }),
        supabase.from("generated_documents").insert({
          user_id: user.id,
          company: result.company,
          language: lang,
          doc_type: "cover_letter",
          content: doc.coverLetter,
        })
      );
    }
    await Promise.all(saves);

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate documents.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
