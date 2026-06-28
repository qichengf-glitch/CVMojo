import { NextResponse } from "next/server";
import { callOpenAI, parseJsonResponse } from "@/lib/openai";
import { buildTailorBulletsPrompt } from "@/lib/prompts";
import { extractDocxBullets, applyDocxBulletEdits } from "@/lib/docx-edit";

export const runtime = "nodejs";

const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      docxBase64?: string;
      fileName?: string;
      jobLink?: string;
      jobDescription?: string;
    };

    if (!body.docxBase64) {
      return NextResponse.json({ error: "Original .docx is required." }, { status: 400 });
    }

    const original = Buffer.from(body.docxBase64, "base64");
    const bullets = await extractDocxBullets(original);

    // Nothing to tailor (or not a normal docx): just return the original unchanged.
    if (bullets.length === 0) {
      return docxResponse(original, body.fileName);
    }

    // Heuristic for "longer than one page": lots of content lines / characters.
    const combinedLength = bullets.reduce((n, b) => n + b.text.length, 0);
    const condense = bullets.length > 16 || combinedLength > 2600;

    const text = await callOpenAI(
      buildTailorBulletsPrompt(
        bullets.map((b) => b.text),
        body.jobLink ?? "",
        body.jobDescription ?? "",
        condense
      ),
      6000
    );
    const parsed = parseJsonResponse<{ bullets?: string[] }>(text);
    const tailored = Array.isArray(parsed.bullets) ? parsed.bullets : [];

    const edits = new Map<number, string>();
    bullets.forEach((b, i) => {
      const next = tailored[i];
      if (typeof next === "string" && next.trim()) {
        edits.set(b.index, next.trim());
      }
    });

    const edited = edits.size > 0 ? await applyDocxBulletEdits(original, edits) : original;
    return docxResponse(edited, body.fileName);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to tailor the document.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function docxResponse(buffer: Buffer, fileName?: string) {
  const safe = (fileName || "Resume").replace(/[^a-zA-Z0-9_一-鿿.-]+/g, "_") || "Resume";
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": DOCX_TYPE,
      "Content-Disposition": `attachment; filename="${safe}.docx"`,
      "Cache-Control": "no-store",
    },
  });
}
