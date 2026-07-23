import fs from "fs";

export interface PdfFonts {
  regular: string;
  bold: string;
}

const CJK_FONT_CANDIDATES = [
  "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
  "/System/Library/Fonts/PingFang.ttc",
  "/System/Library/Fonts/STHeiti Medium.ttc",
  "/Library/Fonts/Arial Unicode.ttf",
];

function firstExistingFont() {
  return CJK_FONT_CANDIDATES.find((fontPath) => fs.existsSync(fontPath));
}

export function registerPdfFonts(
  doc: PDFKit.PDFDocument,
  language: "en" | "zh"
): PdfFonts {
  if (language === "zh") {
    const cjkFont = firstExistingFont();
    if (cjkFont) {
      doc.registerFont("CJK-Regular", cjkFont);
      doc.registerFont("CJK-Bold", cjkFont);
      return { regular: "CJK-Regular", bold: "CJK-Bold" };
    }
  }

  return {
    regular: language === "zh" ? "Helvetica" : "Times-Roman",
    bold: language === "zh" ? "Helvetica-Bold" : "Times-Bold",
  };
}

export function registerCoverPdfFonts(
  doc: PDFKit.PDFDocument,
  language: "en" | "zh"
): PdfFonts {
  if (language === "zh") {
    const cjkFont = firstExistingFont();
    if (cjkFont) {
      doc.registerFont("CJK-Regular", cjkFont);
      doc.registerFont("CJK-Bold", cjkFont);
      return { regular: "CJK-Regular", bold: "CJK-Bold" };
    }
  }

  return {
    regular: "Helvetica",
    bold: "Helvetica-Bold",
  };
}
