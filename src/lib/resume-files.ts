export function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = reject;
    document.body.appendChild(s);
  });
}

export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = window.pdfjsLib;
  if (!pdfjs) {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }
  const buf = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
  let out = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let lastY: number | null = null;
    for (const item of content.items as { str: string; transform: number[] }[]) {
      if (lastY !== null && Math.abs(item.transform[5] - lastY) > 2) out += "\n";
      else if (out.length) out += " ";
      out += item.str;
      lastY = item.transform[5];
    }
    out += "\n";
  }
  return out.trim();
}

export async function extractDocxText(file: File): Promise<string> {
  if (!window.mammoth) {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js");
  }
  const buf = await file.arrayBuffer();
  const res = await window.mammoth.extractRawText({ arrayBuffer: buf });
  return res.value.trim();
}

export async function renderDocxHtml(file: Blob): Promise<string> {
  if (!window.mammoth) {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js");
  }
  const buf = await file.arrayBuffer();
  const res = await window.mammoth.convertToHtml({ arrayBuffer: buf });
  return res.value.trim();
}

export async function extractResumeText(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "txt") return file.text();
  if (ext === "pdf") return extractPdfText(file);
  if (ext === "docx") return extractDocxText(file);
  throw new Error("Upload a .pdf, .docx, or .txt file.");
}

export function guessNameFromResumeText(text: string) {
  const firstLine = text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstLine || firstLine.length > 60) {
    return "";
  }

  return firstLine;
}

export function safeName(s: string) {
  return (s || "").trim().replace(/[^a-zA-Z0-9\u4e00-\u9fff]+/g, "");
}

export function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

declare global {
  interface Window {
    pdfjsLib: {
      getDocument: (opts: { data: ArrayBuffer }) => { promise: Promise<PdfDoc> };
      GlobalWorkerOptions: { workerSrc: string };
    };
    mammoth: {
      convertToHtml: (opts: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
      extractRawText: (opts: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
    };
  }
}

interface PdfDoc {
  numPages: number;
  getPage: (n: number) => Promise<{
    getTextContent: () => Promise<{ items: unknown[] }>;
  }>;
}
