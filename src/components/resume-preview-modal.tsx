"use client";

import { useEffect, useState } from "react";
import { loadLocalStoredResumeFile } from "@/lib/stored-resume";
import { renderDocxHtml } from "@/lib/resume-files";

type ResumePreviewSource = {
  fileName: string;
  resumeText: string;
  resumeMimeType?: string;
};

export function ResumePreviewModal({
  open,
  onClose,
  source,
  userId,
}: {
  open: boolean;
  onClose: () => void;
  source: ResumePreviewSource | null;
  userId: string;
}) {
  const [blobUrl, setBlobUrl] = useState("");
  const [docxHtml, setDocxHtml] = useState("");
  const [fallbackText, setFallbackText] = useState("");
  const [previewType, setPreviewType] = useState<"pdf" | "docx" | "text">("text");

  useEffect(() => {
    if (!open || !source || !userId) return;

    const currentSource = source;
    let cancelled = false;
    let nextUrl = "";

    async function loadPreview() {
      setBlobUrl("");
      setDocxHtml("");
      setFallbackText(currentSource.resumeText);
      setPreviewType("text");

      const storedFile = await loadLocalStoredResumeFile(userId);
      if (!storedFile || cancelled) return;

      const mimeType = currentSource.resumeMimeType || storedFile.type || "";
      const fileName = currentSource.fileName.toLowerCase();

      if (mimeType.includes("pdf") || fileName.endsWith(".pdf")) {
        nextUrl = URL.createObjectURL(storedFile);
        if (!cancelled) {
          setBlobUrl(nextUrl);
          setPreviewType("pdf");
        }
        return;
      }

      if (
        mimeType.includes("wordprocessingml") ||
        mimeType.includes("msword") ||
        fileName.endsWith(".docx")
      ) {
        const html = await renderDocxHtml(storedFile);
        if (!cancelled) {
          setDocxHtml(html);
          setPreviewType("docx");
        }
        return;
      }

      const text = await storedFile.text();
      if (!cancelled) {
        setFallbackText(text || currentSource.resumeText);
        setPreviewType("text");
      }
    }

    void loadPreview();

    return () => {
      cancelled = true;
      if (nextUrl) {
        URL.revokeObjectURL(nextUrl);
      }
    };
  }, [open, source, userId]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !source) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-8" onClick={onClose}>
      <div
        className="flex h-[min(88vh,900px)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{source.fileName}</h3>
            <p className="text-sm text-slate-500">Resume preview</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 bg-slate-100">
          {previewType === "pdf" && blobUrl && (
            <iframe title="Resume preview" src={blobUrl} className="h-full w-full bg-white" />
          )}

          {previewType === "docx" && (
            <div className="h-full overflow-auto bg-slate-100 p-6">
              <div
                className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow-sm [&_p]:mb-4 [&_table]:w-full [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6"
                dangerouslySetInnerHTML={{ __html: docxHtml || `<pre>${source.resumeText}</pre>` }}
              />
            </div>
          )}

          {previewType === "text" && (
            <div className="h-full overflow-auto bg-slate-100 p-6">
              <pre className="mx-auto max-w-3xl whitespace-pre-wrap break-words rounded-2xl bg-white p-8 font-mono text-sm leading-relaxed text-slate-700 shadow-sm">
                {fallbackText}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
