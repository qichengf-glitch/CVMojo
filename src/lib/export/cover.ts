import PDFDocument from "pdfkit";
import { Document, Packer, Paragraph, TextRun, AlignmentType } from "docx";
import { parseCoverLetter } from "./parse";

const PT = 72;
const PAGE_W = 8.5 * PT;

// ---------- PDF ----------

export function buildCoverPdf(content: string): Promise<Buffer> {
  const parsed = parseCoverLetter(content);
  const topBottom = 0.85 * PT;
  const leftRight = 0.9 * PT;
  const left = leftRight;
  const contentWidth = PAGE_W - 2 * leftRight;

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: topBottom, bottom: topBottom, left: leftRight, right: leftRight },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.font("Helvetica").fontSize(11);

    parsed.headerGroups.forEach((group, gi) => {
      for (const line of group) {
        doc.text(line, left, doc.y, { width: contentWidth, lineGap: 1 });
      }
      if (gi < parsed.headerGroups.length - 1) doc.y += 7;
    });
    if (parsed.headerGroups.length) doc.y += 8;

    for (const para of parsed.bodyParagraphs) {
      doc.font("Helvetica").fontSize(11);
      doc.text(para, left, doc.y, { width: contentWidth, lineGap: 3, align: "left" });
      doc.y += 8;
    }

    if (parsed.closingLines.length) {
      doc.y += 6;
      for (const line of parsed.closingLines) {
        doc.text(line, left, doc.y, { width: contentWidth, lineGap: 1 });
      }
    }

    doc.end();
  });
}

// ---------- DOCX ----------

export async function buildCoverDocx(content: string, language: "en" | "zh"): Promise<Buffer> {
  const parsed = parseCoverLetter(content);
  const font = language === "zh" ? "SimSun" : "Arial";
  const size = 22; // 11pt in half-points
  const tw = (inches: number) => Math.round(inches * 1440);

  const children: Paragraph[] = [];

  parsed.headerGroups.forEach((group, gi) => {
    group.forEach((line, li) => {
      const lastInGroup = li === group.length - 1;
      const notLastGroup = gi < parsed.headerGroups.length - 1;
      children.push(
        new Paragraph({
          spacing: { after: lastInGroup && notLastGroup ? 160 : 20 },
          children: [new TextRun({ text: line, font, size })],
        })
      );
    });
  });

  if (parsed.headerGroups.length) {
    children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
  }

  for (const para of parsed.bodyParagraphs) {
    children.push(
      new Paragraph({
        spacing: { after: 200, line: 276 },
        alignment: AlignmentType.LEFT,
        children: [new TextRun({ text: para, font, size })],
      })
    );
  }

  if (parsed.closingLines.length) {
    children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
    for (const line of parsed.closingLines) {
      children.push(
        new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text: line, font, size })] })
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: tw(8.5), height: tw(11) },
            margin: { top: tw(0.85), bottom: tw(0.85), left: tw(0.9), right: tw(0.9) },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
