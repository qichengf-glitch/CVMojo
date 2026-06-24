import type { FullProfile } from "./types";
import { buildResumeSampleGuidance } from "./resume-samples";

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
      return "Generate ONLY a Chinese (simplified) version. The resume and cover letter must be natural, professional Chinese for applications in China. Keep company names, technical tools, and degree titles in English where expected.";
    return "Generate BOTH English AND Chinese (simplified) versions. Chinese must read like native Chinese applications, not literal translation.";
  };

  const shapeParts: string[] = [];
  if (wantEn) {
    shapeParts.push(
      '"en": {"tailored_resume": "...", "cover_letter": "...", "tailoring_summary": "3 lines: matched keywords | missing keywords | honest suggestion"}'
    );
  }
  if (wantZh) {
    shapeParts.push(
      '"zh": {"tailored_resume": "...", "cover_letter": "...", "tailoring_summary": "3 lines in Chinese: matched keywords | missing keywords | honest suggestion"}'
    );
  }
  const shape = `{"company": "...", ${shapeParts.join(", ")}}`;
  const sampleGuidance = buildResumeSampleGuidance(profile, jobLink, jobDescription);
  const candidateGuidance = buildCandidateResumeGuidance(profile);
  const currentDate = buildCurrentDateString();

  return `You are an expert resume writer optimizing a new-grad resume to maximize interview callbacks for a SPECIFIC job. You have the candidate's structured profile and the target job description.

GOAL: Produce a tailored resume that (1) passes ATS keyword screening and (2) makes a human recruiter want to interview this person within a 6-second scan.

CANDIDATE PROFILE (structured JSON):
${JSON.stringify(profile, null, 2)}

Job link: ${jobLink || "(none)"}
Job description:
---
${jobDescription || "(none — infer from link if possible)"}
---

LANGUAGE: ${langInstruction()}

KEYWORD AND EMPHASIS GUIDANCE:
${sampleGuidance}

${candidateGuidance}

RESUME HARD RULES:
- Keep the candidate's existing section structure and order.
- One page only. Cut the weakest content before letting it spill over.
- Do NOT rewrite the entire resume from scratch. Preserve the candidate's original structure, section order, entries, dates, and overall wording as much as possible.
- Your job is light tailoring only: reorder bullets, swap in job keywords where honest, tighten phrasing, surface relevant tools, and strengthen the visible skills section when space allows.
- Never invent experience, employers, dates, metrics, or skills. Use only what is in the profile.
- You may reasonably ESTIMATE a metric only if the profile implies scale, and phrase it honestly (e.g. "100+", "~15%"). If no basis exists, omit the number rather than fabricate.
- No em dashes or en dashes. Use commas, periods, or "and."
- If the page looks too sparse after the strongest bullets are set, first add back relevant skills from the source resume before restoring weak content.
- Every experience, project, or leadership entry must map to exactly ONE real source item from the profile.
- Never merge multiple schools, jobs, internships, or projects into one combined heading.
- Use the bullet character • only. Do not use hyphen-led bullet lines.
- Do not force an OBJECTIVE section unless it already exists in the candidate's source structure.

RESUME TAILORING STEPS:
1. Extract the 10 to 15 most important hard skills, tools, and keywords from the job description, using their EXACT wording.
2. For each keyword that honestly matches the candidate's real experience, make sure it appears verbatim somewhere in the resume, either in the skills line or a bullet.
3. Rewrite each experience bullet in this shape when improvement is needed: [strong action verb] + [what you did] + [tool/method used] + [quantified result]. Lead with the result when possible. Every bullet should answer "so what?"
4. Reorder bullets within each role so the most job-relevant one is first.
5. Reorder and re-weight the skills section so job-relevant skills appear first.
6. Surface tools currently buried in prose, such as Python, SQL, Oracle ERP, AI models, Excel, React, Next.js, JavaScript, R, MATLAB, AutoCAD, and SolidWorks, into the visible skills or tools line when they are truly present.
7. Mirror the seniority and tone of the job posting without changing the candidate's voice.
8. If there is leftover room near the bottom of the page, expand the skills section with more real relevant skills from the source resume or profile before adding weaker bullets.

RESUME OUTPUT:
- tailored_resume must be the full plain text tailored resume, preserving the candidate's original structure.
- tailoring_summary as exactly 3 lines (not inside tailored_resume):
  Line 1: which keywords you matched
  Line 2: which keywords the candidate is missing for this job
  Line 3: one honest suggestion to strengthen the application

For Chinese (zh) versions, preserve the same source-resume structure and section logic, translated naturally into Chinese only where appropriate.

COVER LETTER RULES:
- Simple, sincere, and specific. It must sound like a real applicant, not a template.
- Never use em dash or en dash. Use commas, periods, or "and."
- Avoid hyphen-heavy phrasing inside sentences when natural alternatives exist.
- The cover letter must fill most of one page, roughly 320 to 400 words.
- Write 4 body paragraphs, each 4 to 6 sentences. Do not write 2 to 3 sentence paragraphs.
- Opening paragraph: state the role, who the candidate is, and one specific reason this company and team are interesting.
- Middle paragraph 1: focus on exactly one concrete experience, preferably the ERP project when relevant, and explain what the candidate did, how they did it, and why it maps to this job.
- Middle paragraph 2: focus on exactly one second concrete experience, preferably the Siemens internship when relevant, and explain what the candidate did, how they did it, and why it maps to this job.
- Closing paragraph: tie the candidate's skills to the team's mission, restate fit modestly, and close with a polite invitation to talk.
- End the letter with exactly:
  Best regard,
  [candidate full name]
- Never call the candidate something they are not, such as Data Scientist, Product Manager, or Engineer, unless that is their actual role title in the profile.
- Never overstate fit. Do not say the candidate is a perfect match, ideal fit, or already operating at the target job's level.
- Do not write generic filler such as "what stood out to me", "I am excited to apply", "this opportunity would allow me", or "this experience strengthened my interest" unless the sentence contains concrete specifics.
- Do not stuff the cover letter with a laundry list of tools. Mention only the 2 to 4 most relevant ones.
- Do not simply paraphrase the resume bullet by bullet. Build a short argument for fit.
- If the role is not an obvious direct match, keep the tone honest, modest, and grounded.
- Every claim in the cover letter must trace back to a real source item in the profile or source resume.
- Expand with real specifics already present in the resume, not filler sentences.
- The cover letter should read like a specific business letter, not a dramatic personal statement.
- Use plain business English. Prefer short sentences over ornamental wording.
- Before finalizing, remove any sentence that could be pasted into 100 other applications without changing meaning.

COVER LETTER HEADER RULES:
- The cover letter MUST begin with a header block before any body text.
- Header line 1: the candidate's real full name from the profile.
- Header line 2: the candidate's contact info on one line, using email and phone, and city/state only if present in the profile.
- Then one blank line, then today's actual date written out exactly as: ${currentDate}
- Then one blank line, then the recipient block:
  Hiring manager or recruiter name if known, otherwise "Hiring Manager"
  Company name
  Company location, city and state, only if clearly known
- Then a line: RE: [Job Title]
- Then one blank line, then the greeting, then the 4 body paragraphs.
- Do not leave placeholders such as [Your Name], [Date], [Company], or [Hiring Manager Name].
- If a recruiter name is not known, use "Hiring Manager". If company location is not known, omit that line rather than inventing it.

COMPANY: Identify from job description or link. If unclear, use "Company".

Respond with ONLY JSON in this shape:
${shape}`;
}
