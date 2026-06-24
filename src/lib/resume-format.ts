/**
 * Harvard OCS-style resume layout (Gui-Ping Zhou reference).
 * Plain-text rules must be followed exactly so export can render one-to-one.
 */
export const HARVARD_RESUME_FORMAT_SPEC = `
MANDATORY LAYOUT — match this Harvard student resume template exactly. Replace content only; do not change structure, spacing rules, or section order.

LIGHT-TOUCH EDITING — when a source resume is provided:
- Keep the original file's structure, sections, entry order, dates, and most wording intact.
- Only make small edits to strengthen keyword match with the job description. Do not produce a from-scratch rewrite.

HEADER (2 lines, no section label):
Line 1: FULL NAME IN ALL CAPS (first and last name only, no extra labels)
Line 2: street or city • phone • email   (use bullet character • between items)

Then these sections in this exact order (omit a section only if the profile has zero relevant content; never invent sections):
1. OBJECTIVE — one sentence only, unless profile has no clear target (then omit entire section). Keep it general: state the type of role or field sought. Never mention a specific company name.
2. EDUCATION
3. EXPERIENCE
4. LEADERSHIP — only if profile has leadership / campus roles; otherwise omit
5. ADDITIONAL INFORMATION

SECTION FORMAT (every section):
Line A: SECTION NAME IN ALL CAPS (exactly: OBJECTIVE, EDUCATION, EXPERIENCE, LEADERSHIP, or ADDITIONAL INFORMATION)
Line B: a full-width rule made only of underscore characters (75 underscores): _____________________________________________________________________________

TWO-COLUMN BODY (Education, Experience, Leadership):
- Date column on the left, content on the right.
- Date line format: MM/YY-MM/YY or Month YYYY - Month YYYY, then exactly 4 spaces, then organization/role line.
  Example: 9/XX-6/XX    Cornell University, Ithaca, NY
- Continuation lines (degree, subtitle): start with exactly 13 spaces, then text (not bold in source text).
  Example:              Bachelor of Science, Applied Economics and Management, May 20XX
- Bullet lines: start with exactly 13 spaces, then bullet •, then one space, then text.
  Example:              • Coursework: Accounting, Finance, Marketing

EXPERIENCE / LEADERSHIP entry pattern:
9/XX-6/XX    Company or Organization, City, ST
             Role or program title (13-space indent if on its own line)
             • Achievement bullet using action verb + method + result
             • Second bullet

OBJECTIVE section (no dates):
- After the underscore rule, write exactly ONE sentence starting at column 1 (full width, no date column).
- Keep the objective general and role-focused (e.g. industry, function, or type of position). Do NOT name the target company, employer, or job posting brand.
- Good: "Seeking a financial analyst position in asset management."
- Bad: "Seeking a role at Goldman Sachs" or "Eager to join Acme Corp as a consultant."

ADDITIONAL INFORMATION section (no dates):
- After the underscore rule, use 13-space indent bullets only:
              • Languages: ...
              • Computer: ...
              • Travel: ...
              • Interests: ...
- Only include categories that exist in the profile. Use bold labels in plain text like Languages: (no markdown).

ONE PAGE — HARD RULE (non-negotiable):
- The resume MUST fit on exactly one US Letter page. Never leave ADDITIONAL INFORMATION or any section orphaned on page 2.
- Aim for a FULL page: target 40-48 non-empty lines (including header, section titles, underscore rules, and all bullets). The page should look complete and well-used, not sparse with large empty space at the bottom.
- OBJECTIVE: exactly 1 sentence.
- EDUCATION per school: date line + degree line + keep GPA and coursework from the source profile when space allows. Coursework may list 6-10 job-relevant courses on one line.
- EXPERIENCE per role: keep the source resume's bullets whenever possible. Typical targets: 3-4 bullets for internships and major projects, 2-3 bullets for other roles. Only reduce bullet count when the page would overflow.
- LEADERSHIP: include if the profile has it; keep 2-3 bullets when the source has them.
- ADDITIONAL INFORMATION: include every category present in the profile (Languages, Computer, Certification, Interests, Travel, etc.). List the full honest skill set on the Computer line.

Length balancing:
- If under ~38 lines: restore bullets, coursework, and skills from the source resume rather than leaving the page half empty.
- If 40-48 lines: ideal — stop editing length.
- If over ~48 lines: cut using the priority below until ADDITIONAL INFORMATION fits on page 1.

Cut priority when over budget (cut in this order):
1. Trim coursework to job-relevant courses only (one line).
2. Drop the weakest bullet in the least relevant experience entry.
3. Reduce the least relevant roles from 4 to 3, then 3 to 2 bullets.
4. Compress repeated tools into ADDITIONAL INFORMATION instead of duplicating in bullets.
5. Tighten phrasing (remove filler words) before removing entire entries.
Never cut: header, contact, school names, employer names, dates, or the most job-relevant bullets.

PLAIN TEXT RULES:
- No em dashes or en dashes. Use commas, periods, or "and."
- Use • for bullets only (not - or *).
- Do not add markdown, HTML, or code fences inside tailored_resume.

EXAMPLE SKELETON (swap in real content):

JANE Q. STUDENT
Boston, MA • 555-555-0100 • jane.student@university.edu

OBJECTIVE
_______________________________________________________________________________
Seeking a financial analyst position in asset management.

EDUCATION
_______________________________________________________________________________
9/XX-5/XX    State University, Boston, MA
             Bachelor of Science, Finance, May 20XX
             • Coursework: Corporate Finance, Econometrics, Accounting
             • GPA: 3.7/4.0

EXPERIENCE
_______________________________________________________________________________
6/XX-8/XX    Example Capital, New York, NY
             Summer Analyst
             • Built valuation models in Excel for 3 consumer sector deals
             • Presented findings to associates and VP on client diligence

LEADERSHIP
_______________________________________________________________________________
9/XX-5/XX    Finance Club, State University, Boston, MA
             Vice President
             • Led weekly workshops for 40+ members on markets and recruiting

ADDITIONAL INFORMATION
_______________________________________________________________________________
              • Languages: English (native), Spanish (conversational)
              • Computer: Excel, Python, SQL, PowerPoint
              • Interests: running, chess, travel
`;

export function buildHarvardFormatGuidance() {
  return HARVARD_RESUME_FORMAT_SPEC.trim();
}
