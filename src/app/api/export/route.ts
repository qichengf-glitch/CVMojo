import { NextResponse } from "next/server";
import { exportDocument, type ExportFormat, type DocumentType } from "@/lib/export";

export const runtime = "nodejs";

function safeDownloadName(name: string, format: ExportFormat) {
  const base = (name || "document")
    .replace(/[^a-zA-Z0-9_一-鿿.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `${base || "document"}.${format}`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      content?: string;
      fileName?: string;
      format?: ExportFormat;
      documentType?: DocumentType;
      language?: "en" | "zh";
    };

    if (!body.content?.trim()) {
      return NextResponse.json({ error: "Document content is required." }, { status: 400 });
    }
    if (!body.fileName?.trim()) {
      return NextResponse.json({ error: "File name is required." }, { status: 400 });
    }
    if (body.format !== "docx" && body.format !== "pdf") {
      return NextResponse.json({ error: "Invalid export format." }, { status: 400 });
    }
    if (body.documentType !== "resume" && body.documentType !== "cover_letter") {
      return NextResponse.json({ error: "Invalid document type." }, { status: 400 });
    }
    if (body.language !== "en" && body.language !== "zh") {
      return NextResponse.json({ error: "Invalid document language." }, { status: 400 });
    }

    const { buffer, contentType } = await exportDocument(
      body.content,
      body.documentType,
      body.format,
      body.language
    );

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${safeDownloadName(body.fileName, body.format)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to export the document.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
