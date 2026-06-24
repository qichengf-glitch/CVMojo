import { randomUUID } from "crypto";
import { execFile } from "child_process";
import { access, mkdir, readFile, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";
import { NextResponse } from "next/server";

const execFileAsync = promisify(execFile);

export const runtime = "nodejs";

type ExportFormat = "docx" | "pdf";
type DocumentType = "resume" | "cover_letter";

function safeDownloadName(name: string, format: ExportFormat) {
  const base = (name || "document")
    .replace(/[^a-zA-Z0-9_\u4e00-\u9fff.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `${base || "document"}.${format}`;
}

async function resolvePythonExecutable() {
  const bundledPython = path.join(
    os.homedir(),
    ".cache",
    "codex-runtimes",
    "codex-primary-runtime",
    "dependencies",
    "python",
    "bin",
    "python3"
  );

  try {
    await access(bundledPython);
    return bundledPython;
  } catch {
    return "python3";
  }
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

    const tmpDir = path.join(os.tmpdir(), "cv-mojo-exports");
    await mkdir(tmpDir, { recursive: true });

    const id = randomUUID();
    const inputPath = path.join(tmpDir, `${id}.json`);
    const outputPath = path.join(tmpDir, `${id}.${body.format}`);
    const scriptPath = path.join(process.cwd(), "scripts", "export_document.py");
    const python = await resolvePythonExecutable();

    await writeFile(
      inputPath,
      JSON.stringify({
        content: body.content,
        file_name: body.fileName,
        format: body.format,
        document_type: body.documentType,
        language: body.language,
      }),
      "utf8"
    );

    try {
      await execFileAsync(
        python,
        [scriptPath, "--input", inputPath, "--output", outputPath],
        {
          cwd: process.cwd(),
          env: { ...process.env, PYTHONIOENCODING: "utf-8" },
          maxBuffer: 8 * 1024 * 1024,
        }
      );

      const file = await readFile(outputPath);
      const contentType =
        body.format === "docx"
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : "application/pdf";

      return new Response(file, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${safeDownloadName(body.fileName, body.format)}"`,
          "Cache-Control": "no-store",
        },
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to export the document.";
      return NextResponse.json({ error: message }, { status: 500 });
    } finally {
      await Promise.allSettled([rm(inputPath, { force: true }), rm(outputPath, { force: true })]);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to export the document.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
