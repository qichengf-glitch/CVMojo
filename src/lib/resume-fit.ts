import { callOpenAI, parseJsonResponse } from "./openai";

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
        ? `你是严格控制简历篇幅的编辑。请把下面这份简历压缩到一页，保持原有 section 顺序、标题、公司、学校、职位、日期和整体结构，不要新增信息，不要改成新的模板。优先删弱内容、合并冗余措辞、缩短句子，并保留最强的岗位匹配点和刚刚加入的关键词。必须返回 JSON，格式如下：
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
