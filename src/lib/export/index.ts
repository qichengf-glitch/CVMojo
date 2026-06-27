import { buildResumePdf, buildResumeDocx } from "./resume";
import { buildCoverPdf, buildCoverDocx } from "./cover";

export type ExportFormat = "docx" | "pdf";
export type DocumentType = "resume" | "cover_letter";

const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function exportDocument(
  content: string,
  documentType: DocumentType,
  format: ExportFormat,
  language: "en" | "zh"
): Promise<{ buffer: Buffer; contentType: string }> {
  if (format === "pdf") {
    const buffer =
      documentType === "resume" ? await buildResumePdf(content) : await buildCoverPdf(content);
    return { buffer, contentType: "application/pdf" };
  }
  const buffer =
    documentType === "resume"
      ? await buildResumeDocx(content, language)
      : await buildCoverDocx(content, language);
  return { buffer, contentType: DOCX_TYPE };
}
