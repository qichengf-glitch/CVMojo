import type { FullProfile } from "./types";
import { buildResumeSampleGuidance, buildCoverLetterGuidance } from "./resume-samples";

function buildCurrentDateString(locale: "en-US" | "zh-CN") {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(new Date());
}

function containsCjk(text: string): boolean {
  return /[一-鿿]/.test(text);
}

export const CHINESE_TRANSLATION_BOUNDARY = `
CHINESE OUTPUT TRANSLATION BOUNDARY:
- Use Simplified Chinese for every translatable, descriptive part of the resume and cover letter.
- Translate section headings, job titles, degree names, majors, coursework labels, responsibility bullets, project descriptions, soft skills, business functions, achievements, locations, skill category labels, and descriptive skill items when they have a natural Chinese equivalent.
- Translate common university and college names into their standard Chinese names when widely used. Examples: Cornell University -> 康奈尔大学, Cornell University, College of Engineering -> 康奈尔大学工程学院, Pennsylvania State University -> 宾夕法尼亚州立大学, Pennsylvania State University, College of Engineering -> 宾夕法尼亚州立大学工程学院, Stanford University -> 斯坦福大学, Harvard University -> 哈佛大学, Massachusetts Institute of Technology -> 麻省理工学院, University of California, Berkeley -> 加州大学伯克利分校.
- Company names may stay in their common brand form unless a standard Chinese brand name is clearly established. Personal names may stay as written.
- Skill names are not all exempt. Translate general or descriptive skill categories and skills such as Industrial Engineering & Operational, Systems & Decision Support, Data & Engineering Tools, Software Tools, Language, Process Improvement, Inventory Analysis, Time Study, Warehouse Layout Optimization, Facility Planning, Statistical Process Control, Decision Modeling, Process Mapping, Reliability Analysis, Operational Risk Analysis, Data Visualization, Discrete-Event Simulator, Communication, Leadership, Data Analysis, Market Research, and Project Management into natural Chinese.
- Keep only genuinely non-translatable technical items in their common original form: programming languages, specific software/tools, frameworks, technical platforms, product names, certifications, and methodologies commonly used in English, such as Python, SQL, R, MATLAB, Excel, Tableau, Power BI, AutoCAD, SolidWorks, React, Next.js, Oracle ERP, Six Sigma, CPA, CFA, HIPAA, and GAAP.
- Do not leave full English sentences, English responsibility bullets, English project descriptions, English section labels, English school names with standard Chinese translations, or English descriptive skill/category lines in the Chinese version.
`.trim();

function buildCandidateResumeGuidance(profile: FullProfile, language: "en" | "zh" | "both") {
  const lines = ["CANDIDATE SOURCE RESUME GUIDANCE:"];

  if (profile.profile.resume_text?.trim()) {
    lines.push(
      "- The candidate uploaded an original resume. Treat it as the primary structure anchor.",
      "- Keep its section order, entry order, and overall information architecture.",
      "- Do not force a generic template if the source resume already has a cleaner structure.",
      "- Make surgical edits only: keyword alignment, bullet reordering within a role, light rephrasing, and skills reweighting.",
      "- Leave unchanged when possible: company names, school names, dates, and any bullet that already fits the job well.",
      "- If there is extra room near the bottom of the page, add more real relevant skills before adding new sections or over-expanding weaker bullets.",
      language === "zh" || language === "both"
        ? "- For the Chinese version, preserve the source resume's structure but translate translatable headings, titles, degrees, locations, bullets, school names with standard Chinese translations, skill category labels, and descriptive skill items into professional Simplified Chinese. Keep only personal names, company brand names without standard Chinese forms, and non-translatable technical tools/software/certifications in their common form."
        : "",
      "---",
      profile.profile.resume_text.trim(),
      "---"
    );
  } else {
    lines.push(
      "- No source resume text is available, so preserve the profile's existing natural structure as closely as possible.",
      "- Prefer conventional section names already implied by the candidate profile, such as EDUCATION, EXPERIENCE, PROJECTS, SKILLS, and CERTIFICATION."
    );
  }

  return lines.join("\n");
}

export function buildParseResumePrompt(resumeText: string): string {
  const resumeLanguage = containsCjk(resumeText)
    ? "The resume contains Chinese text. Parse Chinese, English, or bilingual sections completely."
    : "The resume appears primarily English, but still handle bilingual content if present.";

  return `Extract structured data from this resume. Return ONLY valid JSON, no markdown.

${resumeLanguage}

Resume text:
---
${resumeText}
---

Return JSON with this exact shape:
{
  "full_name": "",
  "email": "",
  "phone": "",
  "location": "",
  "work_experience": [{"company": "", "title": "", "start_date": "", "end_date": "", "currently_working": false, "bullets": []}],
  "skills": [],
  "projects": [{"name": "", "description": "", "bullets": []}],
  "education": [{"school": "", "degree": "", "field": "", "graduation_date": ""}]
}

Rules:
- Do NOT invent data. Leave fields empty or arrays empty if absent.
- Parse common Chinese resume headings including 教育背景, 工作经历, 实习经历, 项目经历, 专业技能, 技能, 证书, 荣誉奖项, 校园经历, 社会实践, 研究经历, 相关课程, and 语言能力.
- Keep extracted field values in the resume's original language. Do not translate during parsing.
- Preserve company names, school names, degrees, titles, dates, locations, technical tools, and bullet facts exactly as written when possible.
- For Chinese date ranges such as "2024年6月-至今", put the full range into start_date/end_date as naturally as possible and set currently_working correctly.
- bullets are string arrays of achievement lines. Include Chinese bullets and English bullets exactly as resume content.
- skills should include technical skills, tools, languages, certifications, and clearly labeled skill items. Keep specific tool names such as Python, SQL, Excel, AutoCAD, SolidWorks, React, Tableau, Power BI, CPA, CFA, and Six Sigma in their common form.
- currently_working is true only if the role is clearly current.`;
}

export function buildGeneratePrompt(
  profile: FullProfile,
  jobLink: string,
  jobDescription: string,
  language: "en" | "zh" | "both"
): string {
  const wantEn = language === "en" || language === "both";
  const wantZh = language === "zh" || language === "both";

  const langInstruction = () => {
    if (language === "en") return "Generate ONLY an English version.";
    if (language === "zh")
      return `Generate ONLY a Chinese (simplified) version.
${CHINESE_TRANSLATION_BOUNDARY}
Everything that describes what the candidate did, studied, or achieved must be written in Chinese. A line like "Industrial Engineer Intern, Siemens Energy, June 2024 - August 2024" should become "工业工程实习生\tSiemens Energy, 2024年6月 - 2024年8月", and bullet descriptions must be fully in Chinese, keeping only tool names in English when appropriate.`;
    return `Generate BOTH English AND Chinese (simplified) versions.
For the Chinese version:
${CHINESE_TRANSLATION_BOUNDARY}`;
  };

  const shapeParts: string[] = [];
  if (wantEn) {
    shapeParts.push(
      '"en": {"tailored_resume": "...", "cover_letter": "...", "tailoring_summary": "3 lines: matched keywords | missing keywords | honest suggestion", "missing_keywords": ["each important job keyword the candidate does NOT yet have on the resume, as a short standalone phrase"]}'
    );
  }
  if (wantZh) {
    shapeParts.push(
      '"zh": {"tailored_resume": "...", "cover_letter": "...", "tailoring_summary": "3 lines in Chinese: matched keywords | missing keywords | honest suggestion", "missing_keywords": ["每个职位要求但简历中尚未体现的关键词，作为独立短语"]}'
    );
  }
  const shape = `{"company": "...", ${shapeParts.join(", ")}}`;
  const sampleGuidance = buildResumeSampleGuidance(profile, jobLink, jobDescription);
  const coverLetterGuidance = buildCoverLetterGuidance(profile, jobLink, jobDescription);
  const candidateGuidance = buildCandidateResumeGuidance(profile, language);
  const currentDate = buildCurrentDateString("en-US");
  const currentDateZh = buildCurrentDateString("zh-CN");
  const candidateName = profile.profile.full_name?.trim() || "the candidate";
  const coverDateInstruction =
    language === "both"
      ? `use "${currentDate}" in the English cover letter and "${currentDateZh}" in the Chinese cover letter`
      : language === "zh"
        ? currentDateZh
        : currentDate;
  const jobLanguageGuidance = containsCjk(jobDescription)
    ? "The target job description is Chinese or bilingual. Extract role requirements, qualifications, tools, and competency keywords from the Chinese JD directly. For Chinese output, use the JD's Chinese wording for translated competencies when it is truthful for the candidate; keep English tool/platform names exactly as the JD writes them."
    : "The target job description is not primarily Chinese. For Chinese output, translate translatable job requirements and competencies into natural Chinese while keeping non-translatable tools/platforms in their common form.";

  return `You are an expert resume writer optimizing a candidate's resume to maximize interview callbacks for a SPECIFIC job. You have the candidate's structured profile and the target job description. Candidates range from students to experienced professionals; never assume seniority that the resume does not show.

GOAL: Produce a tailored resume that (1) passes ATS keyword screening and (2) makes a human recruiter want to interview this person within a 6-second scan.

CANDIDATE PROFILE (structured JSON):
${JSON.stringify(profile, null, 2)}

Job link: ${jobLink || "(none)"}
Job description:
---
${jobDescription || "(none — infer from link if possible)"}
---

LANGUAGE: ${langInstruction()}

JOB DESCRIPTION LANGUAGE GUIDANCE:
${jobLanguageGuidance}

KEYWORD AND EMPHASIS GUIDANCE (use ONLY for tone, emphasis, and keyword framing — NOT for structure):
${sampleGuidance}

STRUCTURE AUTHORITY: The candidate's own resume below is the single source of truth for structure, section names, section order, and formatting. If the reference guidance above implies a different structure or different section names, IGNORE that part. Never reorganize, rename, or reorder the candidate's sections to match the reference sample. A finance resume, a nursing resume, and a design resume should each keep their own original shape.

${candidateGuidance}

RESUME HARD RULES:
- This is a TAILORING task, not a writing-from-scratch task. The source resume or profile is the template. Do NOT design a new resume.
- Keep the candidate's existing SECTIONS and their order (for example Education, Experience, Projects, Skills) and keep all real facts. Produce a clean, well-structured, tailored version of THIS candidate's resume.
- TWO-COLUMN ENTRY LAYOUT (use for EVERY entry header): write ONE line with the LEFT part, then a single TAB character (a literal tab), then the RIGHT part:
  - Experience and Projects: [job title or role]\t[company or organization, location if known, dates]
  - Education: [degree and field of study]\t[school name, dates]
  So the role or degree is on the LEFT and the organization together with its dates is RIGHT-aligned. Use the TAB only to separate the left part from the single right-aligned part; never use it inside sentences or bullets.
- Put exactly one blank line between separate entries so they are clearly separated.
- Keep dates readable (for example "June 2024 - August 2024", "May 2026", "Nov 2025 - Present"). Do not invent or alter real dates.
- Make small, surgical wording edits only: reorder bullets within a role, swap in honest job keywords, tighten phrasing, surface relevant tools, and re-weight the visible skills section.
- Do not change real facts: company names, schools, titles, locations, dates, degrees, and section names stay accurate.
- For English output, preserve verbatim unless tailoring truly requires a small change: company names, school names, role titles, dates, locations, degrees, and any bullet that already fits the job.
- For Chinese output, preserve the facts while translating translatable role titles, degrees, locations, section labels, school names with standard Chinese translations, skill category labels, descriptive skill items, and bullet wording into Chinese. Keep personal names, company brand names without standard Chinese forms, and non-translatable tools/software/certifications in their common form.
- Never invent experience, employers, dates, metrics, or skills. Use only what is in the profile or source resume.
- You may reasonably ESTIMATE a metric only if the profile implies scale, and phrase it honestly (e.g. "100+", "~15%"). If no basis exists, omit the number rather than fabricate.
- No em dashes or en dashes. Use commas, periods, or "and."
- Every experience, project, or leadership entry must map to exactly ONE real source item from the profile.
- Never merge multiple schools, jobs, internships, or projects into one combined heading.
- Use the bullet character • only. Do not use hyphen-led bullet lines.
- Do not force an OBJECTIVE section unless it already exists in the candidate's source structure.

RESUME LENGTH RULES (very important):
- The resume must fill roughly 90 to 100 percent of ONE page. Treat one full page as about 45 to 50 lines of content (section headers, entries, and bullets combined) or about 3000 to 3400 characters.
- NEVER exceed one page. If content runs long, cut the weakest bullets and tighten phrasing first, before removing whole entries.
- NEVER let the resume fall below 80 percent of one page. A short, sparse resume looks weak. If the draft is too short, expand it using ONLY real content: restore relevant skills from the source, add back real bullets you trimmed, and add honest detail (tools, scope, results) to existing entries.
- When filling space, prefer in this order: (1) more real, relevant skills in the skills section, (2) restoring real trimmed bullets, (3) adding honest detail to existing bullets. Never pad with filler or invented content.
- Aim for a full, balanced page: not cramped past one page, and not noticeably empty in the lower third.

RESUME TAILORING STEPS (make the SMALLEST edits that improve the match; when in doubt, leave it unchanged):
1. Extract the 10 to 15 most important hard skills, tools, and keywords from the job description, using their EXACT wording.
2. For each keyword that the candidate HONESTLY already has, make sure it appears somewhere in the resume. Add it only if it is real. Never add a skill, tool, or keyword the candidate does not actually have (for example do not add "Word" or "PowerPoint" unless they are in the source).
3. Do NOT rewrite bullets that already work. Edit a bullet only when it clearly helps the match, and then make a minimal change: insert one honest keyword, tighten wording, or reorder it. Keep the bullet's original meaning, facts, and most of its wording. Most bullets should come through nearly unchanged.
4. You may reorder bullets within a role so the most job-relevant one is first. Do not invent or merge bullets.
5. SKILLS SECTION: keep the candidate's skill categories and grouping logic. For English output, keep category labels verbatim, including punctuation and wording. For Chinese output, translate ordinary/descriptive category labels and descriptive skill items into natural Chinese, but keep non-translatable tool/product/certification names in their common form. Within a category you may reorder skills so relevant ones come first, and you may append a skill the candidate genuinely has. Do not move skills between unrelated categories, and do not invent skills.
6. Only surface a tool into the skills or tools line if it truly appears in the candidate's source resume or profile.
7. Mirror the seniority and tone of the job posting without changing the candidate's voice or facts.
8. If there is leftover room near the bottom of the page, prefer appending more real, relevant skills the candidate already has before touching otherwise-fine content. Never pad with invented skills.

RESUME OUTPUT:
- tailored_resume must be the full plain text tailored resume, preserving the candidate's original structure.
- tailoring_summary as exactly 3 lines (not inside tailored_resume):
  Line 1: which keywords you matched
  Line 2: which keywords the candidate is missing for this job
  Line 3: one honest suggestion to strengthen the application
- missing_keywords: a clean JSON array of the individual important job keywords the candidate does NOT yet have on the resume. Each item is one short phrase (for example "Power BI", "ASN", "3PL experience"). This must match Line 2 of the summary, split into separate entries. Return an empty array if nothing important is missing.

For Chinese (zh) versions, preserve the same source-resume structure and section logic, translated naturally into Chinese only where appropriate.
${CHINESE_TRANSLATION_BOUNDARY}

COVER LETTER STRATEGY (adapt the letter to the situation and industry, do NOT use one fixed template):
${coverLetterGuidance}

COVER LETTER RULES:
- Model the letter on the Stanford cover letter samples: a real business letter, not a dramatic personal statement.
- Follow the COVER LETTER TYPE and INDUSTRY FOCUS guidance above. Different roles and industries call for different openings and emphasis, so the structure and focus should genuinely change from one job to another.
- Simple, sincere, and specific. It must sound like a real applicant, not a template.
- Never use em dash or en dash. Use commas, periods, or "and."
- Avoid hyphen-heavy phrasing inside sentences when natural alternatives exist.
- For English output, use plain business English and control the use of "I." For Chinese output, use concise professional Chinese business writing. Prefer clear sentences over ornamental wording.
- Write 3 to 4 body paragraphs as directed by the type guidance. Make paragraphs substantive (about 3 to 6 sentences), not one-line fragments.
- Choose the candidate's actual most relevant experiences for the body. Never assume any specific project or employer; select whatever genuinely fits this job from the profile.
- Never call the candidate something they are not, such as Data Scientist, Product Manager, or Engineer, unless that is their actual role title in the profile.
- Never overstate fit. Do not say the candidate is a perfect match, ideal fit, or already operating at the target job's level.
- Do not write generic filler such as "what stood out to me", "I am excited to apply", "this opportunity would allow me", or "this experience strengthened my interest" unless the sentence contains concrete specifics.
- Do not stuff the letter with a laundry list of tools. Mention only the 2 to 4 most relevant ones.
- Do not paraphrase the resume bullet by bullet. Build a short argument for fit, expanding on one or two experiences in real detail rather than listing everything.
- Every claim must trace back to a real source item in the profile or source resume.
- Before finalizing, remove any sentence that could be pasted into 100 other applications without changing meaning.

COVER LETTER LENGTH RULES:
- The letter, INCLUDING the header block and the signature, must fill roughly 80 to 100 percent of ONE page: about 300 to 380 English words of body text, or roughly 600 to 900 Chinese characters for Chinese output.
- NEVER exceed one page. NEVER fall below 80 percent of a page. If the draft is too short, expand the body with real specifics from the profile, not filler. If too long, tighten sentences and cut repetition.

COVER LETTER FORMAT (traditional Stanford business-letter block, in this exact order):
1. Sender block: the candidate's address or city and state if known, then the candidate's email and phone. If no address is known, use the email and phone line only. Do not invent an address.
2. One blank line, then today's date written exactly as: ${coverDateInstruction}
3. One blank line, then the recipient block, each item on its own line:
   - Recipient name and title if known. If the name is not known, use "Recruiting Staff" or "Hiring Manager".
   - Department or division, only if clearly known.
   - Company name.
   - Company street address, then city, state, and ZIP, only the parts that are clearly known. Omit any line that is not known. Do not invent an address.
4. One blank line, then the greeting:
   - "Dear Mr./Ms. [Last Name]:" when a recipient name is known.
   - Otherwise "Dear Hiring Manager:".
5. One blank line, then the body paragraphs.
6. One blank line, then the closing exactly as:
   Sincerely,

   ${candidateName}
- Do not leave placeholders such as [Your Name], [Date], [Company], [Address], or [Hiring Manager Name]. Omit unknown lines instead of inserting placeholders.
- Use the candidate's real full name from the profile in the signature. If the full name is unknown, use the best available name from the profile.
- For a Chinese (zh) cover letter, keep the same block order and length target, but use natural Chinese business conventions for the greeting and closing (for example "尊敬的XXX：" and a "此致\n敬礼" style closing), then the candidate's name. The body must be Chinese, except for proper names and non-translatable tools/skills.

COMPANY: Identify from job description or link. If unclear, use "Company".

Respond with ONLY JSON in this shape:
${shape}`;
}

// Used for the 1:1 DOCX path: tailor ONLY the content lines (experience/project
// bullets and skills/coursework lists) to the job. The document's format is never
// touched; we only change the wording of these lines in place.
export function buildTailorBulletsPrompt(
  bullets: string[],
  jobLink: string,
  jobDescription: string,
  condense = false
): string {
  const jobLanguageGuidance = containsCjk(jobDescription)
    ? "The job description is Chinese or bilingual. Extract Chinese JD keywords directly. If an original line is Chinese, use natural Chinese JD wording. If an original line is English, keep the line English while preserving non-translatable tool names."
    : "The job description is primarily English. Keep each edited line in its original language.";

  return `You are tailoring a resume's CONTENT lines to a specific job. Each item below is one editable line: an experience or project bullet, or a skills / coursework / tools list. You edit ONLY the wording. You never change the document's structure or formatting.

Job link: ${jobLink || "(none)"}
Job description:
---
${jobDescription || "(none)"}
---

CONTENT LINES (JSON array, keep this EXACT order and count):
${JSON.stringify(bullets, null, 2)}

RULES:
- Return EXACTLY the same number of lines, in the same order. One tailored string per input line.
- ${jobLanguageGuidance}
- Keep every real fact. Never invent employers, titles, dates, metrics, tools, or achievements that are not already implied by the line. This must stay truthful.
- For BULLET lines: surface job-relevant keywords that are honestly supported, lead with impact, tighten phrasing. If a bullet already fits, return it nearly unchanged.
- For SKILLS / COURSEWORK / TOOLS lines (they usually contain a label like "Skills:" or "Relevant Coursework:" followed by a list): keep the label, then reorder the items so the most job-relevant ones come first, and you may add an item the candidate clearly has. Do not invent skills. Keep the same label wording.
- Write in the SAME language as each original line. Do not translate. Keep tool, software, and programming names in their original form.
- Do NOT add a bullet character; return only the line text.
- No em dashes or en dashes. Use commas, periods, or "and".
${
  condense
    ? "- The resume is longer than one page. Make each line LEANER: cut filler words and keep only the strongest, most relevant point, while preserving the core achievement. Aim for noticeably shorter lines than the originals."
    : "- Keep each line close to its original length so the layout does not shift."
}

Respond with ONLY JSON in this exact shape:
{"bullets": ["tailored line 1", "tailored line 2", "..."]}`;
}

export function buildRefineResumePrompt(
  resume: string,
  additions: { keyword: string; placement: "skill" | "coursework" | "experience" }[],
  language: "en" | "zh",
  sourceContext: string
): string {
  const placementLabel: Record<string, string> = {
    skill: "in the SKILLS section",
    coursework: "in the EDUCATION section as relevant coursework",
    experience: "woven into ONE existing, most relevant experience or project bullet",
  };

  const additionLines = additions
    .map((a) => `- "${a.keyword}" -> add it ${placementLabel[a.placement]}`)
    .join("\n");

  const langNote =
    language === "zh"
      ? `The resume is in Chinese. Keep it in natural Simplified Chinese and add the keywords in Chinese where appropriate.
${CHINESE_TRANSLATION_BOUNDARY}`
      : "The resume is in English.";

  return `You are editing an ALREADY tailored resume to incorporate specific keywords the candidate has chosen to add. The candidate has decided to include these, so add them as instructed.

${langNote}

CURRENT RESUME (this exact format and structure must be preserved):
---
${resume}
---

CANDIDATE BACKGROUND (real source material, use it so additions stay as honest as possible):
---
${sourceContext}
---

KEYWORDS TO ADD, each in the requested place:
${additionLines}

HARD RULES:
- Make the SMALLEST possible edits. Change ONLY what is needed to add these keywords. Leave every other line, bullet, date, heading, and the section order exactly as they are.
- Preserve the resume's existing format and structure precisely. Do not reformat, re-punctuate, restructure, or rewrite unrelated content. Do not change date strings or entry headers.
- For "in the SKILLS section": add the keyword to the most relevant existing skills category line, or to the skills section if there is no clear category. Do not rename categories.
- For "in the EDUCATION section as relevant coursework": add the keyword to an existing relevant coursework line. If none exists, add a short "Relevant Coursework:" line under the most relevant school.
- For "woven into ONE experience or project bullet": edit a single most relevant existing bullet so the keyword fits naturally (for example naming a tool that was used). Do NOT invent a new employer, role, project, metric, or fabricate a separate accomplishment. Do not add a brand-new bullet unless absolutely necessary.
- Keep the resume to ONE page. No em dashes or en dashes. Use the bullet character only where bullets already exist.
- Add every requested keyword exactly once, in the place requested.

Respond with ONLY JSON in this shape:
{"resume": "the full revised resume as plain text"}`;
}

export function buildResumeQualityPrompt(
  sourceResume: string,
  generatedResume: string,
  jobDescription: string,
  language: "en" | "zh"
): string {
  const langNote =
    language === "zh"
      ? `The generated resume is intended to be Simplified Chinese.
${CHINESE_TRANSLATION_BOUNDARY}`
      : "The generated resume is intended to be English.";

  return `You are the internal QA agent for a resume tailoring product. Score the generated resume before the user sees it.

${langNote}

SOURCE RESUME OR PROFILE:
---
${sourceResume || "(none)"}
---

TARGET JOB DESCRIPTION:
---
${jobDescription || "(none)"}
---

GENERATED RESUME:
---
${generatedResume}
---

Scoring rules:
- overall_score, format_score, and jd_match_score are integers from 0 to 100.
- format_score measures whether the generated resume preserves the source resume's format and structure: header/contact style, section order, section grouping, entry grouping, bullet style, date placement, and overall information architecture. If the output is Chinese and the source is English, do NOT penalize translated section labels or translated job titles; compare the structure and layout, not literal language.
- jd_match_score measures truthful match to the JD: relevant keywords, role responsibilities, required tools, seniority, and recruiter clarity. Penalize invented skills or inflated claims.
- overall_score should weigh both format consistency and JD match. A resume should only be 80+ if it is both structurally faithful and well matched.
- suggestions must be concrete, short, and actionable. Include only changes that would improve the current generated resume.
- format_issues should list concrete format mismatches. Return [] if the generated resume preserves the source format well.
- needs_revision is true if format_score < 80, jd_match_score < 80, or overall_score < 80.

Respond with ONLY JSON in this exact shape:
{
  "overall_score": 0,
  "format_score": 0,
  "jd_match_score": 0,
  "suggestions": ["..."],
  "format_issues": ["..."],
  "needs_revision": true
}`;
}

export function buildResumeQualityRevisionPrompt(
  sourceResume: string,
  currentResume: string,
  jobDescription: string,
  language: "en" | "zh",
  suggestions: string[],
  formatIssues: string[]
): string {
  const langNote =
    language === "zh"
      ? `Return a high-quality Simplified Chinese resume.
${CHINESE_TRANSLATION_BOUNDARY}`
      : "Return a high-quality English resume.";

  return `You are the internal resume revision agent. Revise the generated resume so it reaches at least 80/100 on both format consistency and JD match.

${langNote}

SOURCE RESUME OR PROFILE:
---
${sourceResume || "(none)"}
---

TARGET JOB DESCRIPTION:
---
${jobDescription || "(none)"}
---

CURRENT GENERATED RESUME:
---
${currentResume}
---

QA SUGGESTIONS:
${suggestions.map((s) => `- ${s}`).join("\n") || "- None"}

FORMAT ISSUES:
${formatIssues.map((s) => `- ${s}`).join("\n") || "- None"}

Hard rules:
- Return the full revised resume only, as plain text in JSON.
- Preserve every real fact. Do not invent employers, schools, dates, titles, metrics, certifications, tools, or experience.
- Fix format mismatches by following the source resume's section order, entry grouping, bullet style, spacing, and two-column/header logic as closely as possible.
- Improve JD match only with truthful keywords, reordered bullets, tightened phrasing, and relevant existing skills from the source.
- Keep the resume to one page. Use • for bullet lines.
- For Chinese output, translate translatable content, descriptive skills, and school names with standard Chinese translations. Keep only non-translatable tools, software, certifications, company brand names without standard Chinese forms, and personal names in their common form.

Respond with ONLY JSON in this exact shape:
{"resume":"..."}`;
}
