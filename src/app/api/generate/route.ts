import { NextResponse } from "next/server";
import { hasSupabasePublicEnv, SUPABASE_ENV_ERROR } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { callOpenAI, parseJsonResponse } from "@/lib/openai";
import {
  CHINESE_TRANSLATION_BOUNDARY,
  buildGeneratePrompt,
  buildParseResumePrompt,
  buildResumeQualityPrompt,
  buildResumeQualityRevisionPrompt,
} from "@/lib/prompts";
import { getFullProfile, parsedResumeToFullProfile } from "@/lib/profile";
import type { GenerateResult, ParsedResume, ResumeQualityReport } from "@/lib/types";

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

function lineHasEnglishNarrative(line: string) {
  if (!/[A-Za-z]/.test(line)) return false;

  const withoutCommonNonTranslatables = line.replace(
    /\b(?:Python|SQL|R|MATLAB|Excel|Tableau|Power BI|AutoCAD|SolidWorks|React|Next\.js|Node\.js|JavaScript|TypeScript|Oracle ERP|SAP|AWS|Azure|GCP|Git|CPA|CFA|HIPAA|GAAP|Six Sigma)\b/g,
    ""
  );
  const longLatinRuns = withoutCommonNonTranslatables.match(
    /[A-Za-z][A-Za-z0-9 ,.;:'"()/%+&.-]{32,}/g
  );

  const lower = withoutCommonNonTranslatables.toLowerCase();
  if (
    /\b(?:experience|education|skills|project|summary|responsibilities|coursework|degree|major|minor|intern|assistant|manager|analyst|engineer|engineering|research|marketing|finance|operations|operational|leadership|university|college|school|process|inventory|warehouse|facility|statistical|control|decision|modeling|mapping|reliability|analysis|visualization|tools|language|software)\b/.test(
      lower
    )
  ) {
    return true;
  }

  if (!longLatinRuns) return false;

  return (
    /\b(?:developed|managed|led|designed|analyzed|analysed|created|implemented|optimized|optimised|assisted|supported|collaborated|conducted|built|maintained|improved|generated|prepared|presented|coordinated|researched|evaluated|trained|resolved|delivered|responsible|worked|used|using)\b/.test(
      lower
    )
  );
}

function needsChineseTranslationRepair(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .some(lineHasEnglishNarrative);
}

function applyChineseTermTranslations(text: string) {
  const replacements: Array<[RegExp, string]> = [
    [/\bCornell University,\s*College of Engineering\b/g, "康奈尔大学工程学院"],
    [
      /\bPennsylvania State University,\s*College of Engineering\b/g,
      "宾夕法尼亚州立大学工程学院",
    ],
    [/\bCornell University\b/g, "康奈尔大学"],
    [/\bPennsylvania State University\b/g, "宾夕法尼亚州立大学"],
    [/\bStanford University\b/g, "斯坦福大学"],
    [/\bHarvard University\b/g, "哈佛大学"],
    [/\bMassachusetts Institute of Technology\b/g, "麻省理工学院"],
    [/\bUniversity of California,\s*Berkeley\b/g, "加州大学伯克利分校"],
    [/\bIndustrial Engineering\s*&\s*Operational\b/g, "工业工程与运营"],
    [/\bSystems\s*&\s*Decision Support\b/g, "系统与决策支持"],
    [/\bData\s*&\s*Engineering Tools\b/g, "数据与工程工具"],
    [/\bSoftware Tools\b/g, "软件工具"],
    [/\bLanguage\b/g, "语言"],
    [/\bProcess Improvement\b/g, "流程改进"],
    [/\bInventory [Aa]nalysis\b/g, "库存分析"],
    [/\bTime Study\b/g, "时间研究"],
    [/\bWarehouse Layout Optimization\b/g, "仓库布局优化"],
    [/\bFacility Planning\b/g, "设施规划"],
    [/\bStatistical Process Control\b/g, "统计过程控制"],
    [/\bDecision Modeling\b/g, "决策建模"],
    [/\bProcess Mapping\b/g, "流程映射"],
    [/\bReliability Analysis\b/g, "可靠性分析"],
    [/\bOperational Risk Analysis\b/g, "运营风险分析"],
    [/\bData Visualization\b/g, "数据可视化"],
    [/\bDiscrete-Event Simulator\b/g, "离散事件仿真器"],
    [/\bProject Management\b/g, "项目管理"],
    [/\bMarket Research\b/g, "市场研究"],
    [/\bData Analysis\b/g, "数据分析"],
    [/\bLeadership\b/g, "领导力"],
    [/\bCommunication\b/g, "沟通能力"],
  ];

  return replacements.reduce((current, [pattern, replacement]) => {
    return current.replace(pattern, replacement);
  }, text);
}

async function repairChineseDocument(
  content: string,
  kind: "resume" | "cover_letter",
  sourceContext: string
): Promise<string> {
  const current = content.trim();
  if (!needsChineseTranslationRepair(current)) return applyChineseTermTranslations(current);

  const prompt = `你是中文求职材料编辑。下面这份${kind === "resume" ? "简历" : "求职信"}应该是中文版，但仍有英文叙述内容残留。请只修复语言问题，返回高质量简体中文版本。

${CHINESE_TRANSLATION_BOUNDARY}

硬规则：
- 保持原有结构、行序、空行、TAB 分隔、项目符号和所有真实事实。
- 不要新增经历、公司、学校、日期、指标或技能。
- 学校名使用常见中文译名，例如 Cornell University -> 康奈尔大学，Pennsylvania State University -> 宾夕法尼亚州立大学。公司名没有通用中文品牌名时可保留原文。个人名、技术工具、软件、编程语言、框架、证书和专有方法保持常用写法。
- 把英文 section label、职位/学位/专业、课程描述、职责要点、项目描述、通用软技能、业务能力、skill category 和描述性 skill item 翻译成自然专业的中文。
- 不输出解释，只返回 JSON。

原始真实素材：
---
${sourceContext}
---

需要修复的内容：
---
${current}
---

Respond with ONLY JSON in this exact shape:
{"content":"..."}`;

  const repaired = parseJsonResponse<{ content: string }>(
    await callOpenAI(prompt, 6000)
  ).content?.trim();
  return applyChineseTermTranslations(repaired || current);
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
        ? `你是严格控制简历篇幅的编辑。请把下面这份中文简历压缩到一页，保持原有 section 顺序、标题、公司、学校、职位、日期和整体结构，不要新增信息，不要改成新的模板。优先删弱内容、合并冗余措辞、缩短句子，并保留最强的岗位匹配点。必须返回 JSON，格式如下：
{"resume":"..."}

${CHINESE_TRANSLATION_BOUNDARY}

硬规则：
- 只改 resume，不要输出解释。
- 保持原有结构和 section 顺序。
- 不要删掉最强的经历和关键词。
- 不要虚构任何内容。
- 保持中文版：除不可翻译的技术工具、软件、证书、无通用中文名的公司品牌名和人名外，不要留下英文叙述句；常见学校名要用中文译名。
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
        ? `你是严格控制求职信篇幅的编辑。请把下面这封中文求职信压缩到一页内，保留原有 header block、收件人信息、称呼、正文和结尾签名。不要虚构信息，不要改成新的结构，不要删除最关键的岗位匹配点。优先压缩冗余句子、空话和重复表达。必须返回 JSON，格式如下：
{"cover_letter":"..."}

${CHINESE_TRANSLATION_BOUNDARY}

硬规则：
- 只改求职信，不要输出解释。
- 保留现有 header block 和正文段落结构。
- 保留真实日期、公司名、职位名、签名。
- 不要虚构任何内容。
- 保持中文版：除不可翻译的技术工具、软件、证书、无通用中文名的公司品牌名和人名外，不要留下英文叙述句；常见学校名要用中文译名。
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

${CHINESE_TRANSLATION_BOUNDARY}

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
  source: string,
  jobDescription: string
): Promise<string> {
  let current = coverLetter;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (!belowCoverLetterMinimum(current)) return current;

    const prompt =
      language === "zh"
        ? `这封中文求职信太短。请把它扩展到大约一页的 80% 到 100%（正文约 600 到 900 个中文字，按内容密度灵活控制），但绝不能超过一页。保留现有的 header block、收件人信息、称呼、结尾签名不变，只扩展正文段落，用下面"原始素材"里真实的细节来充实论证。不要虚构任何信息。必须返回 JSON：
{"cover_letter":"..."}

${CHINESE_TRANSLATION_BOUNDARY}

原始素材（可参考的真实内容）：
---
${source}
---

目标职位描述：
---
${jobDescription || "(none)"}
---

扩写要求：
- 强调候选人以前的经历或项目和职位要求之间的具体关联。
- 先判断 JD 最想找哪类人，再选择简历中最强相关的一段经历或项目作为主线；其他相关经历只做补充。
- 如果 JD 强调 AI、data analysis、analytics、forecasting、decision support 等，优先考虑 Inventory Intelligence 是否是最强证据。
- 如果 JD 强调 manufacturing tools、manufacturing operations、process design、process improvement、industrial engineering、tooling 等，优先考虑 Siemens Energy 是否是最强证据。
- 如果职位要求的正式工作年限高于候选人背景，不要道歉或夸大年限；用最相关的真实项目、实习、课程或实践经历补强匹配度。
- 如果项目是最强证据，请说明项目问题、候选人做了什么、使用的方法或工具，以及它如何对应职位要求。

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

TARGET JOB DESCRIPTION:
---
${jobDescription || "(none)"}
---

Expansion requirements:
- Make the connection between prior experience or projects and the job requirements explicit.
- First infer what kind of candidate the JD is trying to hire, then choose the strongest related resume item as the main evidence. Use other relevant experiences only as support.
- If the JD emphasizes AI, data analysis, analytics, forecasting, or decision support, consider whether Inventory Intelligence is the strongest evidence.
- If the JD emphasizes manufacturing tools, manufacturing operations, process design, process improvement, industrial engineering, or tooling, consider whether Siemens Energy is the strongest evidence.
- If the role asks for more formal work experience than the candidate appears to have, do not apologize or inflate tenure. Bridge the gap with the strongest truthful project, internship, coursework, or hands-on experience.
- If a project is the strongest evidence, explain the problem, the candidate's work, the methods or tools, and how it maps to the role's requirements.

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
          .filter((item) => {
            const lower = item.toLowerCase();
            return item.length > 0 && lower !== "none" && item !== "无" && item !== "暂无";
          })
      )
    );

  if (Array.isArray(arr) && arr.length > 0) return clean(arr);

  if (summary) {
    const line = summary
      .split("\n")
      .find((l) => /missing|缺失|缺少|未体现|待补充/i.test(l));
    if (line) {
      const colonIndex = line.search(/[:：]/);
      const afterColon = colonIndex >= 0 ? line.slice(colonIndex + 1) : line;
      return clean(afterColon.split(/[,，;；|、]/));
    }
  }
  return [];
}

function clampScore(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 6);
}

interface QualityAssessment {
  report: ResumeQualityReport;
  needsRevision: boolean;
}

async function assessResumeQuality(
  sourceResume: string,
  resume: string,
  jobDescription: string,
  language: "en" | "zh",
  rerunCount: number
): Promise<QualityAssessment> {
  const parsed = parseJsonResponse<{
    overall_score?: number;
    format_score?: number;
    jd_match_score?: number;
    suggestions?: string[];
    format_issues?: string[];
    needs_revision?: boolean;
  }>(
    await callOpenAI(
      buildResumeQualityPrompt(sourceResume, resume, jobDescription, language),
      4000
    )
  );

  const report: ResumeQualityReport = {
    overallScore: clampScore(parsed.overall_score),
    formatScore: clampScore(parsed.format_score),
    jdMatchScore: clampScore(parsed.jd_match_score),
    suggestions: normalizeStringArray(parsed.suggestions),
    formatIssues: normalizeStringArray(parsed.format_issues),
    rerunCount,
  };

  return {
    report,
    needsRevision:
      Boolean(parsed.needs_revision) ||
      report.overallScore < 80 ||
      report.formatScore < 80 ||
      report.jdMatchScore < 80,
  };
}

async function runResumeQualityAgent(
  resume: string,
  sourceResume: string,
  jobDescription: string,
  language: "en" | "zh"
): Promise<{ resume: string; report: ResumeQualityReport }> {
  let current = resume;
  let assessment = await assessResumeQuality(
    sourceResume,
    current,
    jobDescription,
    language,
    0
  );

  for (let rerunCount = 1; rerunCount <= 2 && assessment.needsRevision; rerunCount += 1) {
    const revised = parseJsonResponse<{ resume?: string }>(
      await callOpenAI(
        buildResumeQualityRevisionPrompt(
          sourceResume,
          current,
          jobDescription,
          language,
          assessment.report.suggestions,
          assessment.report.formatIssues
        ),
        6000
      )
    ).resume?.trim();

    if (!revised) break;

    const fitted = exceedsOnePageBudget(revised)
      ? await compressResumeToOnePage(revised, language)
      : revised;
    current =
      language === "zh" ? await repairChineseDocument(fitted, "resume", sourceResume) : fitted;
    assessment = await assessResumeQuality(
      sourceResume,
      current,
      jobDescription,
      language,
      rerunCount
    );
  }

  return { resume: current, report: assessment.report };
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
      const qualityCheckedResume = await runResumeQualityAgent(
        fittedResume,
        sourceContext,
        jobDescription ?? "",
        "en"
      );
      const compressedCoverLetter = await compressCoverLetterToOnePage(parsed.en.cover_letter, "en");
      const fittedCoverLetter = await expandCoverLetterToFillPage(
        compressedCoverLetter,
        "en",
        sourceContext,
        jobDescription ?? ""
      );
      result.docs.en = {
        resume: qualityCheckedResume.resume,
        coverLetter: fittedCoverLetter,
        tailoringSummary: parsed.en.tailoring_summary,
        missingKeywords: normalizeMissingKeywords(
          parsed.en.missing_keywords,
          parsed.en.tailoring_summary
        ),
        qualityReport: qualityCheckedResume.report,
      };
    }
    if (parsed.zh) {
      const repairedResume = await repairChineseDocument(
        parsed.zh.tailored_resume,
        "resume",
        sourceContext
      );
      const compressedResume = await compressResumeToOnePage(repairedResume, "zh");
      const expandedResume = await expandResumeToFillPage(compressedResume, "zh", sourceContext);
      const fittedResume = await repairChineseDocument(expandedResume, "resume", sourceContext);
      const finalResume = exceedsOnePageBudget(fittedResume)
        ? await compressResumeToOnePage(fittedResume, "zh")
        : fittedResume;
      const qualityCheckedResume = await runResumeQualityAgent(
        finalResume,
        sourceContext,
        jobDescription ?? "",
        "zh"
      );

      const repairedCoverLetter = await repairChineseDocument(
        parsed.zh.cover_letter,
        "cover_letter",
        sourceContext
      );
      const compressedCoverLetter = await compressCoverLetterToOnePage(repairedCoverLetter, "zh");
      const expandedCoverLetter = await expandCoverLetterToFillPage(
        compressedCoverLetter,
        "zh",
        sourceContext,
        jobDescription ?? ""
      );
      const fittedCoverLetter = await repairChineseDocument(
        expandedCoverLetter,
        "cover_letter",
        sourceContext
      );
      const finalCoverLetter = exceedsCoverLetterOnePageBudget(fittedCoverLetter)
        ? await compressCoverLetterToOnePage(fittedCoverLetter, "zh")
        : fittedCoverLetter;
      result.docs.zh = {
        resume: qualityCheckedResume.resume,
        coverLetter: finalCoverLetter,
        tailoringSummary: parsed.zh.tailoring_summary,
        missingKeywords: normalizeMissingKeywords(
          parsed.zh.missing_keywords,
          parsed.zh.tailoring_summary
        ),
        qualityReport: qualityCheckedResume.report,
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
