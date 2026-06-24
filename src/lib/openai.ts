import OpenAI from "openai";

const DEFAULT_MODEL = "gpt-5.4";

export async function callOpenAI(prompt: string, maxTokens = 8000): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  const client = new OpenAI({ apiKey });

  const completion = await client.chat.completions.create({
    model,
    max_completion_tokens: maxTokens,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });

  const text = completion.choices[0]?.message?.content
    ?.replace(/```json|```/g, "")
    .trim();

  if (!text) throw new Error("Empty response from OpenAI.");
  return text;
}

export function parseJsonResponse<T>(text: string): T {
  return JSON.parse(text) as T;
}
