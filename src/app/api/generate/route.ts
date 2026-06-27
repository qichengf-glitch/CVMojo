import { NextResponse } from "next/server";
import { hasSupabasePublicEnv, SUPABASE_ENV_ERROR } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { callOpenAI, parseJsonResponse } from "@/lib/openai";
import { buildGeneratePrompt, buildParseResumePrompt } from "@/lib/prompts";
import { getFullProfile, parsedResumeToFullProfile } from "@/lib/profile";
import type { GenerateResult, ParsedResume } from "@/lib/types";

// One full page, upper bound. Never exceed these.
const MAX_RESUME_NON_EMPTY_LINES = 48;
const MAX_RESUME_CHAR_COUNT = 3400;
const MAX_COVER_LETTER_NON_EMPTY_LINES = 38;
const MAX_COVER_LETTER_CHAR_COUNT = 3000;
const MAX_COVER_LETTER_WORD_COUNT = 440;

// ~80% of a page, lower bound. Never fall below these; expand with real content.
const MIN_RESUME_CHAR_COUNT = 2600;
const MIN_RESUME_NON_EMPTY_LINES = 30;
const MIN_COVER_LETTER_CHAR_COUNT = 1700;
const MIN_COVER_LETTER_WORD_COUNT = 300;

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

function belowResumeMinimum(text: string) {
  return (
    text.trim().length < MIN_RESUME_CHAR_COUNT &&
    getResumeNonEmptyLineCount(text) < MIN_RESUME_NON_EMPTY_LINES
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

function belowCoverLetterMinimum(text: string) {
  return (
    getWordCount(text) < MIN_COVER_LETTER_WORD_COUNT &&
    text.trim().length < MIN_COVER_LETTER_CHAR_COUNT
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

async function expandResumeToFillPage(
  resume: string,
  language: "en" | "zh",
  source: string
): Promise<string> {
  let current = resume;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (!belowResumeMinimum(current)) return current;

    const prompt =
      language === "zh"
        ? `这份简历太短，没有填满一页。请把它扩展到大约一页的 90% 到 100%，但绝不能超过一页。只能使用下面"原始素材"里真实存在的信息来扩充：恢复被删掉的相关技能、补回真实的经历要点、为已有条目补充真实的细节（工具、范围、成果）。不要虚构任何公司、职位、日期、指标或技能。保持原有 section 顺序和结构。必须返回 JSON：
{"resume":"..."}

原始素材（可参考的真实内容）：
---
${source}
---

需要扩展的简历：
---
${current}
---`
        : `This resume is too short and does not fill a page. Expand it to roughly 90 to 100 percent of one page, but NEVER more than one page. Use ONLY real information found in the SOURCE below: restore relevant skills that were trimmed, add back real bullets, and add honest detail (tools, scope, results) to existing entries. Do not invent any company, title, date, metric, or skill. Keep the original section order and structure. Return JSON in this exact shape:
{"resume":"..."}

SOURCE (real content you may draw from):
---
${source}
---

Resume to expand:
---
${current}
---`;

    const expanded = parseJsonResponse<{ resume: string }>(await callOpenAI(prompt, 4000)).resume?.trim();
    if (!expanded) return current;
    // Safety: if expansion overshoots one page, compress back down.
    current = exceedsOnePageBudget(expanded)
      ? await compressResumeToOnePage(expanded, language)
      : expanded;
  }

  return current;
}

async function expandCoverLetterToFillPage(
  coverLetter: string,
  language: "en" | "zh",
  source: string
): Promise<string> {
  let current = coverLetter;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (!belowCoverLetterMinimum(current)) return current;

    const prompt =
      language === "zh"
        ? `这封求职信太短。请把它扩展到大约一页的 80% 到 100%（正文约 300 到 380 字），但绝不能超过一页。保留现有的 header block、收件人信息、称呼、结尾签名不变，只扩展正文段落，用下面"原始素材"里真实的细节来充实论证。不要虚构任何信息。必须返回 JSON：
{"cover_letter":"..."}

原始素材（可参考的真实内容）：
---
${source}
---

需要扩展的求职信：
---
${current}
---`
        : `This cover letter is too short. Expand it to roughly 80 to 100 percent of one page (about 300 to 380 words of body text), but NEVER more than one page. Keep the existing header block, recipient block, greeting, and signature exactly as they are. Only expand the body paragraphs, deepening the argument with real specifics from the SOURCE below. Do not invent anything. Return JSON in this exact shape:
{"cover_letter":"..."}

SOURCE (real content you may draw from):
---
${source}
---

Cover letter to expand:
---
${current}
---`;

    const expanded = parseJsonResponse<{ cover_letter: string }>(
      await callOpenAI(prompt, 4000)
    ).cover_letter?.trim();
    if (!expanded) return current;
    // Safety: if expansion overshoots one page, compress back down.
    current = exceedsCoverLetterOnePageBudget(expanded)
      ? await compressCoverLetterToOnePage(expanded, language)
      : expanded;
  }

  return current;
}

// Prefer the structured array; fall back to parsing the "missing keywords" line
// out of the 3-line tailoring summary if the model omitted the array.
function normalizeMissingKeywords(
  arr: string[] | undefined,
  summary: string | undefined
): string[] {
  const clean = (items: string[]) =>
    Array.from(
      new Set(
        items
          .map((item) => item.trim())
          .filter((item) => item.length > 0 && item.toLowerCase() !== "none")
      )
    );

  if (Array.isArray(arr) && arr.length > 0) return clean(arr);

  if (summary) {
    const line = summary
      .split("\n")
      .find((l) => /missing/i.test(l));
    if (line) {
      const afterColon = line.includes(":") ? line.slice(line.indexOf(":") + 1) : line;
      return clean(afterColon.split(/[,;|]/));
    }
  }
  return [];
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

  // Spend one credit up front (atomic). Refunded below if generation fails.
  const { data: creditsAfter } = await supabase.rpc("consume_credit");
  if (typeof creditsAfter !== "number" || creditsAfter < 0) {
    return NextResponse.json(
      { error: "You are out of credits.", code: "NO_CREDITS" },
      { status: 402 }
    );
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
      en?: {
        tailored_resume: string;
        cover_letter: string;
        tailoring_summary?: string;
        missing_keywords?: string[];
      };
      zh?: {
        tailored_resume: string;
        cover_letter: string;
        tailoring_summary?: string;
        missing_keywords?: string[];
      };
    }>(text);

    // Real content the expansion passes may draw from, so they never fabricate.
    const sourceContext = profile.profile.resume_text?.trim() || JSON.stringify(profile);

    const result: GenerateResult = {
      company: parsed.company || "Company",
      docs: {},
    };
    if (parsed.en) {
      const compressedResume = await compressResumeToOnePage(parsed.en.tailored_resume, "en");
      const fittedResume = await expandResumeToFillPage(compressedResume, "en", sourceContext);
      const compressedCoverLetter = await compressCoverLetterToOnePage(parsed.en.cover_letter, "en");
      const fittedCoverLetter = await expandCoverLetterToFillPage(
        compressedCoverLetter,
        "en",
        sourceContext
      );
      result.docs.en = {
        resume: fittedResume,
        coverLetter: fittedCoverLetter,
        tailoringSummary: parsed.en.tailoring_summary,
        missingKeywords: normalizeMissingKeywords(
          parsed.en.missing_keywords,
          parsed.en.tailoring_summary
        ),
      };
    }
    if (parsed.zh) {
      const compressedResume = await compressResumeToOnePage(parsed.zh.tailored_resume, "zh");
      const fittedResume = await expandResumeToFillPage(compressedResume, "zh", sourceContext);
      const compressedCoverLetter = await compressCoverLetterToOnePage(parsed.zh.cover_letter, "zh");
      const fittedCoverLetter = await expandCoverLetterToFillPage(
        compressedCoverLetter,
        "zh",
        sourceContext
      );
      result.docs.zh = {
        resume: fittedResume,
        coverLetter: fittedCoverLetter,
        tailoringSummary: parsed.zh.tailoring_summary,
        missingKeywords: normalizeMissingKeywords(
          parsed.zh.missing_keywords,
          parsed.zh.tailoring_summary
        ),
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

    return NextResponse.json({ ...result, credits: creditsAfter });
  } catch (err) {
    // Generation failed after we charged a credit, so give it back.
    await supabase.rpc("refund_credit");
    const message = err instanceof Error ? err.message : "Failed to generate documents.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
