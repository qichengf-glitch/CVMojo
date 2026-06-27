// Pure-TypeScript port of the resume/cover-letter parsing from the old Python
// exporter, so document export can run natively on Vercel (no Python).

export const BULLET = "•";

const HARVARD_SECTIONS = new Set([
  "OBJECTIVE",
  "EDUCATION",
  "EXPERIENCE",
  "LEADERSHIP",
  "ADDITIONAL INFORMATION",
  "求职意向",
  "教育背景",
  "工作经历",
  "领导力",
  "其他信息",
]);
const CHINESE_HEADINGS = new Set([
  "教育背景",
  "工作经历",
  "项目经历",
  "项目经验",
  "技能",
  "核心技能",
  "经验",
  "教育",
  "项目",
  "求职意向",
  "领导力",
  "其他信息",
]);

export function containsCjk(text: string): boolean {
  return /[一-鿿]/.test(text);
}

function isRuleLine(line: string): boolean {
  const s = line.trim();
  return s.length > 0 && /^_+$/.test(s);
}

// Common resume section names (normalized: lowercase, no trailing colon). Lets us
// detect headings in ANY case (e.g. "Work Experience", "Education:"), not only
// ALL-CAPS, so the renderer follows whatever structure the user's resume uses.
const SECTION_WORDS = new Set([
  "objective",
  "career objective",
  "summary",
  "professional summary",
  "profile",
  "education",
  "academic background",
  "experience",
  "work experience",
  "working experience",
  "professional experience",
  "employment",
  "employment history",
  "work history",
  "relevant experience",
  "industry experience",
  "engineering experience",
  "research experience",
  "research",
  "clinical experience",
  "teaching experience",
  "skills",
  "technical skills",
  "specialized skills",
  "core skills",
  "key skills",
  "core competencies",
  "competencies",
  "projects",
  "project experience",
  "personal projects",
  "selected projects",
  "leadership",
  "leadership experience",
  "leadership and activities",
  "activities",
  "extracurricular activities",
  "involvement",
  "volunteer",
  "volunteer experience",
  "community service",
  "certifications",
  "certification",
  "certificates",
  "licenses",
  "licenses and certifications",
  "awards",
  "honors",
  "honors and awards",
  "awards and honors",
  "achievements",
  "accomplishments",
  "publications",
  "presentations",
  "interests",
  "hobbies",
  "languages",
  "references",
  "qualifications",
  "additional information",
  "relevant coursework",
  "coursework",
  "courses",
  "affiliations",
  "professional affiliations",
  "training",
  "skills and interests",
  "skills and additional information",
]);

function normalizeHeading(s: string): string {
  return s
    .trim()
    .replace(/[:：]\s*$/, "")
    .toLowerCase();
}

function isHarvardSection(line: string): boolean {
  const s = line.trim();
  if (!s || s.startsWith(BULLET)) return false;
  if (HARVARD_SECTIONS.has(s) || CHINESE_HEADINGS.has(s)) return true;

  const hasLetters = /[a-zA-Z一-鿿]/.test(s);
  // ALL-CAPS short line.
  if (hasLetters && s.toUpperCase() === s && s.length <= 40) return true;
  // Known section name in any case: short line, no digits/date, optional colon.
  if (s.length <= 40 && !/\d/.test(s) && SECTION_WORDS.has(normalizeHeading(s))) return true;
  return false;
}

const MONTH =
  "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\.?";
const END_WORD = "(?:Present|Current|present|current|Now|now)";
const SIDE = `(?:(?:${MONTH}\\s*,?\\s*)?(?:\\d{4}|${END_WORD})|${MONTH})`;
const DATE = `${SIDE}(?:\\s*(?:[-–—]|to)\\s*${SIDE})?`;
const TRAILING_DATE = new RegExp(`^(.*?\\S)\\s+(${DATE})\\s*$`);

const DATE_FIRST_PATTERNS = [
  /^(\d{1,2}\/\d{2}-\d{1,2}\/\d{2})\s{2,}(.+)$/,
  /^(\d{1,2}\/\d{4}-\d{1,2}\/\d{4})\s{2,}(.+)$/,
  /^([A-Za-z]{3,9}\s+\d{4}\s*-\s*[A-Za-z]{3,9}\s+\d{4})\s{2,}(.+)$/,
  /^([A-Za-z]{3,9}\s+\d{4}\s*-\s*Present)\s{2,}(.+)$/,
];

function parseDateFirst(line: string): [string, string] | null {
  for (const re of DATE_FIRST_PATTERNS) {
    const m = re.exec(line);
    if (m) return [m[1], m[2]];
  }
  return null;
}

function parseTrailingDate(line: string): { text: string; date: string } | null {
  const m = TRAILING_DATE.exec(line.trim());
  if (!m) return null;
  const date = m[2].trim();
  const text = m[1].trim();
  if (!/\d{4}/.test(date) && !new RegExp(END_WORD).test(date)) return null;
  if (!text) return null;
  return { text, date };
}

export type ResumeItem =
  | { kind: "entry"; text: string; date: string; dateLeft?: boolean }
  | { kind: "bullet"; text: string }
  | { kind: "indent"; text: string }
  | { kind: "body"; text: string };

export interface ResumeBlock {
  title: string;
  items: ResumeItem[];
}

export interface ParsedResume {
  name: string;
  contact: string;
  blocks: ResumeBlock[];
}

function cleanBullet(line: string): string {
  let s = line.replace(/^\s+/, "");
  while (/^[•\-*·]/.test(s)) s = s.slice(1).replace(/^\s+/, "");
  return s;
}

export function parseResume(content: string): ParsedResume {
  const lines = content.split("\n").map((l) => l.replace(/\s+$/, ""));
  const nonEmpty = lines.filter((l) => l.trim());
  if (nonEmpty.length === 0) return { name: "", contact: "", blocks: [] };

  const name = nonEmpty[0].trim();
  let contact = "";
  let bodyStart = 1;
  if (
    nonEmpty.length > 1 &&
    !isHarvardSection(nonEmpty[1]) &&
    !isRuleLine(nonEmpty[1])
  ) {
    contact = nonEmpty[1].trim();
    bodyStart = 2;
  }

  const blocks: ResumeBlock[] = [];
  let currentTitle = "";
  let currentItems: ResumeItem[] = [];
  // Flush whenever there's a title or any collected content, so nothing is dropped
  // (e.g. a summary paragraph before the first heading becomes an untitled block).
  const flush = () => {
    if (currentTitle || currentItems.length) blocks.push({ title: currentTitle, items: currentItems });
    currentTitle = "";
    currentItems = [];
  };

  for (const raw of nonEmpty.slice(bodyStart)) {
    const line = raw.replace(/\s+$/, "");
    if (isRuleLine(line)) continue;
    if (isHarvardSection(line)) {
      flush();
      currentTitle = line.trim();
      continue;
    }

    const dateFirst = parseDateFirst(line);
    if (dateFirst) {
      currentItems.push({ kind: "entry", date: dateFirst[0], text: dateFirst[1], dateLeft: true });
      continue;
    }

    const stripped = line.replace(/^\s+/, "");
    const indent = line.length - stripped.length;
    if (/^[•\-*·]/.test(stripped)) {
      currentItems.push({ kind: "bullet", text: cleanBullet(stripped) });
      continue;
    }
    if (indent >= 4) {
      currentItems.push({ kind: "indent", text: stripped });
      continue;
    }
    const trailing = parseTrailingDate(stripped);
    if (trailing) {
      currentItems.push({ kind: "entry", text: trailing.text, date: trailing.date });
      continue;
    }
    currentItems.push({ kind: "body", text: stripped });
  }
  flush();

  return { name, contact, blocks };
}

export interface ParsedCover {
  headerGroups: string[][];
  bodyParagraphs: string[];
  closingLines: string[];
}

const CLOSINGS = new Set(["best regard,", "best regards,", "sincerely,", "thank you,"]);

export function parseCoverLetter(content: string): ParsedCover {
  const lines = content.split("\n").map((l) => l.replace(/\s+$/, ""));
  const greetingIndex = lines.findIndex((l) => l.trim().toLowerCase().startsWith("dear "));

  if (greetingIndex === -1) {
    const paragraphs = content
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);
    return { headerGroups: [], bodyParagraphs: paragraphs, closingLines: [] };
  }

  // Header groups: blocks of non-empty lines separated by blank lines.
  const headerGroups: string[][] = [];
  let group: string[] = [];
  for (const l of lines.slice(0, greetingIndex)) {
    if (l.trim()) group.push(l.trim());
    else if (group.length) {
      headerGroups.push(group);
      group = [];
    }
  }
  if (group.length) headerGroups.push(group);

  let closingStart = -1;
  for (let i = lines.length - 1; i > greetingIndex; i--) {
    if (CLOSINGS.has(lines[i].trim().toLowerCase())) {
      closingStart = i;
      break;
    }
  }

  const bodyLines = closingStart === -1 ? lines.slice(greetingIndex) : lines.slice(greetingIndex, closingStart);
  const closingLines =
    closingStart === -1 ? [] : lines.slice(closingStart).map((l) => l.trim()).filter(Boolean);

  const bodyParagraphs: string[] = [];
  let cur: string[] = [];
  for (const l of bodyLines) {
    if (l.trim()) cur.push(l.trim());
    else if (cur.length) {
      bodyParagraphs.push(cur.join(" "));
      cur = [];
    }
  }
  if (cur.length) bodyParagraphs.push(cur.join(" "));

  return { headerGroups, bodyParagraphs, closingLines };
}
