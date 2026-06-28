import JSZip from "jszip";

// In-place DOCX editing: read the original .docx, tailor ONLY the bullet text,
// and write it back into the exact same document so all formatting, columns,
// tab stops, fonts, and headers are preserved 1:1.

const DOC_PATH = "word/document.xml";
const BULLET_PREFIX = /^[\s]*[•●▪‣◦·*\-–]+[\s]*/;

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function encodeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paragraphText(paragraphXml: string): string {
  const texts = [...paragraphXml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => decodeXml(m[1]));
  return texts.join("");
}

// Skill / coursework style content lines (kept editable). These describe content,
// not structure, so tailoring them is safe as long as the line is single-column.
const CONTENT_LABEL =
  /^(technical\s+skills|specialized\s+skills|core\s+skills|key\s+skills|skills?|relevant\s+coursework|coursework|relevant\s+courses|courses|technologies|tools|languages?|programming|software|frameworks?|proficien\w*|certifications?|interests?)\b/i;

// A paragraph is safe to collapse-edit only if all its text runs share the same
// formatting (so we never flatten a bold label into plain text, etc.).
function isUniformFormatting(paragraphXml: string): boolean {
  const runs = [...paragraphXml.matchAll(/<w:r\b[\s\S]*?<\/w:r>/g)]
    .map((m) => m[0])
    .filter((r) => /<w:t[^>]*>[\s\S]*?<\/w:t>/.test(r));
  if (runs.length <= 1) return true;
  const rprs = runs.map((r) => (r.match(/<w:rPr>[\s\S]*?<\/w:rPr>/) || [""])[0]);
  return rprs.every((x) => x === rprs[0]);
}

function hasColumnTab(paragraphXml: string): boolean {
  // A right-aligned/two-column line uses a tab; never touch those (structure).
  return /<w:tab\b/.test(paragraphXml) || /<w:ptab\b/.test(paragraphXml);
}

function isEditableBullet(paragraphXml: string, text: string): boolean {
  if (hasColumnTab(paragraphXml)) return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  const hasNumbering = /<w:numPr\b/.test(paragraphXml);
  const hasGlyph = BULLET_PREFIX.test(trimmed);
  if (!hasNumbering && !hasGlyph) return false;
  return trimmed.replace(BULLET_PREFIX, "").trim().length > 1;
}

function isEditableContentLine(paragraphXml: string, text: string): boolean {
  if (hasColumnTab(paragraphXml)) return false;
  if (!isUniformFormatting(paragraphXml)) return false;
  const trimmed = text.trim();
  if (trimmed.length < 6) return false;
  return CONTENT_LABEL.test(trimmed);
}

export interface DocxBullet {
  index: number; // paragraph index within the document
  text: string; // editable text (bullet text without the leading glyph)
}

// List the paragraphs we are allowed to tailor: experience/project bullets plus
// skills / coursework / tools content lines. Structural lines (name, headings,
// org/school/title/location/date, two-column lines) are never included.
export async function extractDocxBullets(buffer: Buffer): Promise<DocxBullet[]> {
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file(DOC_PATH)?.async("string");
  if (!xml) return [];

  const out: DocxBullet[] = [];
  const paragraphs = xml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? [];
  paragraphs.forEach((p, index) => {
    const text = paragraphText(p);
    if (isEditableBullet(p, text)) {
      out.push({ index, text: text.trim().replace(BULLET_PREFIX, "").trim() });
    } else if (isEditableContentLine(p, text)) {
      out.push({ index, text: text.trim() });
    }
  });
  return out;
}

// Write tailored bullet text back into the original docx, preserving formatting.
export async function applyDocxBulletEdits(
  buffer: Buffer,
  edits: Map<number, string>
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file(DOC_PATH)?.async("string");
  if (!xml) return buffer;

  let index = -1;
  const newXml = xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (p) => {
    index += 1;
    const newText = edits.get(index);
    if (newText === undefined) return p;

    // Keep the original leading bullet glyph (e.g. "• ") if it was inline text.
    const full = paragraphText(p);
    const prefixMatch = full.match(BULLET_PREFIX);
    const prefix = prefixMatch ? prefixMatch[0] : "";

    // Put the whole tailored line into the FIRST run's text node, empty the rest.
    // Bullets are uniformly formatted, so this keeps their look while swapping wording.
    let first = true;
    return p.replace(/(<w:t)([^>]*)(>)([\s\S]*?)(<\/w:t>)/g, (_m, open, attrs, gt, _content, close) => {
      if (first) {
        first = false;
        const withSpace = /xml:space=/.test(attrs) ? attrs : `${attrs} xml:space="preserve"`;
        return `${open}${withSpace}${gt}${encodeXml(prefix + newText)}${close}`;
      }
      return `${open}${attrs}${gt}${close}`;
    });
  });

  zip.file(DOC_PATH, newXml);
  return (await zip.generateAsync({ type: "nodebuffer" })) as Buffer;
}
