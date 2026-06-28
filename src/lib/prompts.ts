import type { FullProfile } from "./types";
import { buildResumeSampleGuidance, buildCoverLetterGuidance } from "./resume-samples";

function buildCurrentDateString() {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(new Date());
}

function buildCandidateResumeGuidance(profile: FullProfile) {
  const lines = ["CANDIDATE SOURCE RESUME GUIDANCE:"];

  if (profile.profile.resume_text?.trim()) {
    lines.push(
      "- The candidate uploaded an original resume. Treat it as the primary structure anchor.",
      "- Keep its section order, heading style, and overall information architecture.",
      "- Do not force a generic template if the source resume already has a cleaner structure.",
      "- Make surgical edits only: keyword alignment, bullet reordering within a role, light rephrasing, and skills reweighting.",
      "- Leave unchanged when possible: company names, school names, titles, dates, locations, and any bullet that already fits the job well.",
      "- If there is extra room near the bottom of the page, add more real relevant skills before adding new sections or over-expanding weaker bullets.",
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
  return `Extract structured data from this resume. Return ONLY valid JSON, no markdown.

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
- bullets are string arrays of achievement lines.
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
      return `Generate ONLY a Chinese (simplified) version. Translate ALL translatable content into natural, professional Chinese for job applications in China: job titles, degrees, majors and fields of study, every responsibility and bullet point, project names and descriptions, relevant coursework, locations, and section content. Do NOT leave English sentences or English bullet text in the output.
Keep in their original English form ONLY:
1. Technical tools, software, programming languages, frameworks, and named methods (for example Python, SQL, R, MATLAB, Excel, AutoCAD, SolidWorks, React, Next.js, Oracle ERP, Six Sigma) — these are proper skill names and must NOT be translated.
2. Proper names normally not translated, such as company names and school names (you may keep "Cornell University", "Siemens Energy" in English).
Everything that describes what the candidate did, studied, or achieved must be written in Chinese. A line like "Industrial Engineer Intern, Siemens Energy, June 2024 - August 2024" should become "工业工程实习生,Siemens Energy,2024年6月 - 2024年8月", and bullet descriptions must be fully in Chinese (keeping only tool names in English).`;
    return "Generate BOTH English AND Chinese (simplified) versions. The Chinese version must follow the same full-translation rules: translate all descriptive content into natural Chinese, keeping only technical tool/skill names and proper company/school names in English.";
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
  const candidateGuidance = buildCandidateResumeGuidance(profile);
  const currentDate = buildCurrentDateString();
  const candidateName = profile.profile.full_name?.trim() || "the candidate";

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

KEYWORD AND EMPHASIS GUIDANCE (use ONLY for tone, emphasis, and keyword framing — NOT for structure):
${sampleGuidance}

STRUCTURE AUTHORITY: The candidate's own resume below is the single source of truth for structure, section names, section order, and formatting. If the reference guidance above implies a different structure or different section names, IGNORE that part. Never reorganize, rename, or reorder the candidate's sections to match the reference sample. A finance resume, a nursing resume, and a design resume should each keep their own original shape.

${candidateGuidance}

RESUME HARD RULES:
- This is a TAILORING task, not a writing-from-scratch task. The source resume or profile is the template. Do NOT design a new resume.
- The source resume's own format is the format. There is no fixed house template. Match whatever structure THIS candidate used; a different uploaded resume should produce a differently structured output.
- Keep the candidate's existing section structure, section order, headings, and overall information architecture exactly as they are in the source.
- Reproduce each entry header line in the SAME shape the source used. If the source puts the title, organization, location, and date on one line, keep them on one line in that same order. Keep the date at the same position (for example trailing at the end of the line if that is how the source wrote it).
- Keep every date string EXACTLY as written in the source (for example "June-Aug 2024", "May 2026", "Nov 2025 - Current"). Do not reformat, expand, abbreviate, or re-punctuate dates.
- Do not add, remove, or rearrange the commas and separators in entry header lines. Preserve the punctuation style the source used.
- Make small, surgical edits only: reorder bullets within a role, swap in job keywords where honest, tighten phrasing, surface relevant tools, and re-weight the visible skills section. Leave most wording as-is.
- Tailor ONLY the bullet and skill CONTENT. Headers, organizations, titles, locations, dates, degrees, and section names stay as they are.
- Preserve verbatim, unless tailoring truly requires a small change: company names, school names, role titles, dates, locations, degrees, and any bullet that already fits the job.
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
5. SKILLS SECTION: keep the candidate's exact category labels verbatim, including their punctuation and wording (for example keep "Industrial Engineering & Operational", do not rename it to "Supply Chain and Operations", and do not change "&" to "and"). Within a category you may reorder skills so relevant ones come first, and you may append a skill the candidate genuinely has. Do not rename categories, do not move skills between categories, and do not invent skills.
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

COVER LETTER STRATEGY (adapt the letter to the situation and industry, do NOT use one fixed template):
${coverLetterGuidance}

COVER LETTER RULES:
- Model the letter on the Stanford cover letter samples: a real business letter, not a dramatic personal statement.
- Follow the COVER LETTER TYPE and INDUSTRY FOCUS guidance above. Different roles and industries call for different openings and emphasis, so the structure and focus should genuinely change from one job to another.
- Simple, sincere, and specific. It must sound like a real applicant, not a template.
- Never use em dash or en dash. Use commas, periods, or "and."
- Avoid hyphen-heavy phrasing inside sentences when natural alternatives exist.
- Use plain business English. Control the use of "I." Prefer clear sentences over ornamental wording.
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
- The letter, INCLUDING the header block and the signature, must fill roughly 80 to 100 percent of ONE page: about 300 to 380 words of body text.
- NEVER exceed one page. NEVER fall below 80 percent of a page. If the draft is too short, expand the body with real specifics from the profile, not filler. If too long, tighten sentences and cut repetition.

COVER LETTER FORMAT (traditional Stanford business-letter block, in this exact order):
1. Sender block: the candidate's address or city and state if known, then the candidate's email and phone. If no address is known, use the email and phone line only. Do not invent an address.
2. One blank line, then today's date written exactly as: ${currentDate}
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
- For a Chinese (zh) cover letter, keep the same block order and length target, but use natural Chinese business conventions for the greeting and closing (for example "尊敬的XXX：" and a "此致\n敬礼" style closing), then the candidate's name.

COMPANY: Identify from job description or link. If unclear, use "Company".

Respond with ONLY JSON in this shape:
${shape}`;
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
      ? "The resume is in Chinese. Keep it in natural Chinese and add the keywords in Chinese where appropriate, keeping tool and product names in their common form."
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
