import { callOpenAI, parseJsonResponse } from "./openai";
import { CHINESE_TRANSLATION_BOUNDARY } from "./prompts";

// One full page, upper bound for the plain-text resume.
const MAX_RESUME_NON_EMPTY_LINES = 48;
const MAX_RESUME_CHAR_COUNT = 3400;

function getResumeNonEmptyLineCount(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean).length;
}

export function exceedsOnePageBudget(text: string) {
  return (
    getResumeNonEmptyLineCount(text) > MAX_RESUME_NON_EMPTY_LINES ||
    text.trim().length > MAX_RESUME_CHAR_COUNT
  );
}

// Compress a resume back onto one page while preserving its structure. Used as a
// safety net after edits (for example after adding keywords) so the resume never
// silently spills onto a second page.
export async function compressResumeToOnePage(
  resume: string,
  language: "en" | "zh"
): Promise<string> {
  let current = resume;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (!exceedsOnePageBudget(current)) return current;

    const prompt =
      language === "zh"
        ? `你是严格控制简历篇幅的编辑。请把下面这份中文简历压缩到一页，保持原有 section 顺序、标题、公司、学校、职位、日期和整体结构，不要新增信息，不要改成新的模板。优先删弱内容、合并冗余措辞、缩短句子，并保留最强的岗位匹配点和刚刚加入的关键词。必须返回 JSON，格式如下：
{"resume":"..."}

${CHINESE_TRANSLATION_BOUNDARY}

硬规则：
- 只改 resume，不要输出解释。
- 保持原有结构和 section 顺序。
- 不要删掉最强的经历和关键词。
- 不要虚构任何内容。
- 保持中文版：除不可翻译的技术工具、软件、证书、公司名、学校名和人名外，不要留下英文叙述句。
- 使用纯文本。

Resume:
---
${current}
---`
        : `You are a strict resume editor. Compress the resume below so it safely fits on one page. Preserve the existing section order, headings, employers, schools, role titles, dates, and overall structure. Do not switch to a new template. Cut weak content first, tighten phrasing, and preserve the strongest job-matching evidence and any keywords that were just added. Return JSON in this exact shape:
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

    const compressed = parseJsonResponse<{ resume: string }>(
      await callOpenAI(prompt, 4000)
    ).resume?.trim();
    if (!compressed) return current;
    current = compressed;
  }

  return current;
}

export async function fitEditedResumeToOnePage(
  resume: string,
  language: "en" | "zh"
): Promise<string> {
  let current = resume.trim();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const prompt =
      language === "zh"
        ? `你是导出前的简历终检 agent。用户刚刚手动修改了这份中文简历。请检查并修改它，确保导出为 PDF/DOCX 时严格只有 1 页。

必须返回 JSON：
{"resume":"..."}

${CHINESE_TRANSLATION_BOUNDARY}

硬规则：
- 只输出修改后的完整 resume，不要解释。
- 最终简历必须严格控制在 1 页内。目标：不超过 34 到 38 个非空行，且避免很长的行，因为长行会在 PDF 中换行。
- 不要新增任何经历、公司、学校、日期、指标、技能或证书。
- 保持原有 section 顺序、真实事实、公司/学校/职位/日期关系。
- 优先压缩顺序：删弱 bullet，合并重复 bullet，缩短长句，压缩技能列表，删除最弱的附加信息或认证行。
- 不要删除最相关的 JD 关键词和最强经历。
- 中文表达要紧凑专业。英文只保留不可翻译的技术工具、软件、证书、公司品牌名和人名。
- 使用纯文本，项目符号使用 •。

用户编辑后的简历：
---
${current}
---`
        : `You are the final pre-export resume QA agent. The user just manually edited this resume. Revise it so it exports to exactly ONE page in PDF/DOCX.

Return JSON in this exact shape:
{"resume":"..."}

Hard rules:
- Return only the full revised resume, no commentary.
- The final resume must strictly fit on one page. Target no more than 34 to 38 non-empty lines and avoid very long lines because they wrap in PDF.
- Do not add any experience, employers, schools, dates, metrics, skills, or certifications.
- Preserve section order, real facts, employer/school/title/date relationships, and the candidate's strongest evidence.
- Compression priority: cut weak bullets, merge repeated bullets, shorten long sentences, compact skills lists, remove the weakest additional information or certification line.
- Do not remove the most relevant JD keywords or the strongest experience.
- Use plain text and • for bullet lines.

User-edited resume:
---
${current}
---`;

    const fitted = parseJsonResponse<{ resume?: string }>(
      await callOpenAI(prompt, 6000)
    ).resume?.trim();

    if (!fitted) return current;
    current = fitted;
  }

  return current;
}
