import PDFDocument from "pdfkit";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Tab,
  AlignmentType,
  TabStopType,
  BorderStyle,
} from "docx";
import { parseResume, type ParsedResume, type ResumeBlock, BULLET } from "./parse";

interface Layout {
  nameSize: number;
  contactSize: number;
  bodySize: number;
  headingSize: number;
  margin: number; // inches
  lineGap: number;
  sectionGap: number; // points
}

function layoutForScale(scale: number): Layout {
  const margin = scale > 1 ? Math.min(0.95, 0.55 + 0.45 * (scale - 1)) : Math.max(0.45, 0.55 + 0.3 * (scale - 1));
  return {
    nameSize: round1(13.5 * scale),
    contactSize: round1(9.0 * scale),
    bodySize: round1(10.2 * scale),
    headingSize: round1(10.6 * scale),
    margin: round3(margin),
    lineGap: round3(Math.max(1.0, Math.min(1.34, 1.02 + 0.4 * (scale - 1)))),
    sectionGap: Math.max(2, Math.round(4 * scale)),
  };
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}

const PT = 72; // points per inch
const PAGE_W = 8.5 * PT;

// ---------- PDF ----------

function drawResumePdf(doc: PDFKit.PDFDocument, parsed: ParsedResume, layout: Layout) {
  const left = layout.margin * PT;
  const right = PAGE_W - layout.margin * PT;
  const contentWidth = right - left;
  const lineGap = (layout.lineGap - 1) * layout.bodySize;

  if (parsed.name) {
    doc.font("Times-Bold").fontSize(layout.nameSize);
    doc.text(parsed.name.toUpperCase(), left, doc.y, { width: contentWidth, align: "center" });
    doc.y += 2;
  }
  if (parsed.contact) {
    doc.font("Times-Roman").fontSize(layout.contactSize);
    doc.text(parsed.contact, left, doc.y, { width: contentWidth, align: "center" });
  }

  for (const block of parsed.blocks) {
    if (block.title) {
      doc.y += layout.sectionGap + 2;
      doc.font("Times-Bold").fontSize(layout.headingSize);
      doc.text(block.title, left, doc.y, { width: contentWidth });
      const ly = doc.y + 1;
      doc.moveTo(left, ly).lineTo(right, ly).lineWidth(0.7).strokeColor("#000000").stroke();
      doc.y = ly + 3;
    } else {
      doc.y += 2;
    }

    for (const item of block.items) {
      if (item.kind === "entry") {
        doc.fontSize(layout.bodySize).font("Times-Bold");
        const y = doc.y;
        if (item.dateLeft) {
          doc.text(`${item.date}    ${item.text}`, left, y, { width: contentWidth, lineGap });
        } else {
          const dateWidth = doc.widthOfString(item.date);
          doc.text(item.text, left, y, { width: contentWidth - dateWidth - 6, lineGap });
          const afterY = doc.y;
          doc.text(item.date, right - dateWidth, y, { width: dateWidth + 1, lineBreak: false });
          doc.y = afterY;
        }
      } else if (item.kind === "bullet") {
        doc.fontSize(layout.bodySize).font("Times-Roman");
        const bx = left + 14;
        const y = doc.y;
        doc.text(BULLET, bx, y, { lineBreak: false });
        doc.text(item.text, bx + 10, y, { width: contentWidth - 24, lineGap });
      } else if (item.kind === "indent") {
        doc.fontSize(layout.bodySize).font("Times-Roman");
        doc.text(item.text, left + 14, doc.y, { width: contentWidth - 14, lineGap });
      } else {
        doc.fontSize(layout.bodySize).font("Times-Roman");
        doc.text(item.text, left, doc.y, { width: contentWidth, lineGap });
        doc.y += 1;
      }
    }
  }
}

function pageCountForScale(parsed: ParsedResume, scale: number): number {
  const layout = layoutForScale(scale);
  const m = layout.margin * PT;
  const doc = new PDFDocument({ size: "LETTER", margins: { top: m, bottom: m, left: m, right: m }, bufferPages: true });
  // Consume stream so internal buffers don't grow unbounded.
  doc.on("data", () => {});
  drawResumePdf(doc, parsed, layout);
  const count = doc.bufferedPageRange().count;
  doc.end();
  return count;
}

function bestScale(parsed: ParsedResume): number {
  const min = 0.8;
  const max = 1.6;
  if (pageCountForScale(parsed, min) > 1) return min;
  let lo = min;
  let hi = max;
  for (let i = 0; i < 7; i++) {
    const mid = (lo + hi) / 2;
    if (pageCountForScale(parsed, mid) <= 1) lo = mid;
    else hi = mid;
  }
  return round3(lo);
}

export function buildResumePdf(content: string): Promise<Buffer> {
  const parsed = parseResume(content);
  const layout = layoutForScale(bestScale(parsed));
  const m = layout.margin * PT;
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margins: { top: m, bottom: m, left: m, right: m } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    drawResumePdf(doc, parsed, layout);
    doc.end();
  });
}

// ---------- DOCX ----------

export async function buildResumeDocx(content: string, language: "en" | "zh"): Promise<Buffer> {
  const parsed = parseResume(content);
  const layout = layoutForScale(bestScale(parsed));
  const font = language === "zh" ? "SimSun" : "Times New Roman";
  const hp = (pt: number) => Math.round(pt * 2); // half-points
  const tw = (inches: number) => Math.round(inches * 1440); // twips
  const contentWidthTw = tw(8.5 - 2 * layout.margin);

  const children: Paragraph[] = [];

  if (parsed.name) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [new TextRun({ text: parsed.name.toUpperCase(), bold: true, font, size: hp(layout.nameSize) })],
      })
    );
  }
  if (parsed.contact) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: layout.sectionGap * 20 + 40 },
        children: [new TextRun({ text: parsed.contact, font, size: hp(layout.contactSize) })],
      })
    );
  }

  for (const block of parsed.blocks) {
    children.push(...renderBlockDocx(block, layout, font, hp, contentWidthTw));
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: tw(8.5), height: tw(11) },
            margin: { top: tw(layout.margin), right: tw(layout.margin), bottom: tw(layout.margin), left: tw(layout.margin) },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

function renderBlockDocx(
  block: ResumeBlock,
  layout: Layout,
  font: string,
  hp: (pt: number) => number,
  contentWidthTw: number
): Paragraph[] {
  const out: Paragraph[] = [];
  if (block.title) {
    out.push(
      new Paragraph({
        spacing: { before: layout.sectionGap * 20 + 40, after: 20 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, space: 1, color: "000000" } },
        children: [new TextRun({ text: block.title, bold: true, font, size: hp(layout.headingSize) })],
      })
    );
  }

  for (const item of block.items) {
    if (item.kind === "entry") {
      if (item.dateLeft) {
        out.push(
          new Paragraph({
            spacing: { after: 0 },
            children: [new TextRun({ text: `${item.date}    ${item.text}`, bold: true, font, size: hp(layout.bodySize) })],
          })
        );
      } else {
        out.push(
          new Paragraph({
            tabStops: [{ type: TabStopType.RIGHT, position: contentWidthTw }],
            spacing: { after: 0 },
            children: [
              new TextRun({ text: item.text, bold: true, font, size: hp(layout.bodySize) }),
              new TextRun({ children: [new Tab()], font, size: hp(layout.bodySize) }),
              new TextRun({ text: item.date, bold: true, font, size: hp(layout.bodySize) }),
            ],
          })
        );
      }
    } else if (item.kind === "bullet") {
      out.push(
        new Paragraph({
          indent: { left: 230, hanging: 180 },
          spacing: { after: 0 },
          children: [new TextRun({ text: `${BULLET} ${item.text}`, font, size: hp(layout.bodySize) })],
        })
      );
    } else if (item.kind === "indent") {
      out.push(
        new Paragraph({
          indent: { left: 230 },
          spacing: { after: 0 },
          children: [new TextRun({ text: item.text, font, size: hp(layout.bodySize) })],
        })
      );
    } else {
      out.push(
        new Paragraph({
          spacing: { after: 20 },
          children: [new TextRun({ text: item.text, font, size: hp(layout.bodySize) })],
        })
      );
    }
  }
  return out;
}
