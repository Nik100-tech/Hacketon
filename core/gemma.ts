import { GoogleGenAI } from "@google/genai";
import fs from "node:fs/promises";
import crypto from "node:crypto";

export const MODELS = {
  handover: process.env.HANDOVER_MODEL ?? "gemma-4-31b-it",
  answer: process.env.ANSWER_MODEL ?? "gemma-4-26b-a4b-it"
};

const cacheDir = ".cache";
await fs.mkdir(cacheDir, { recursive: true });
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error("GEMINI_API_KEY is missing. Put it in .env");
const ai = new GoogleGenAI({ apiKey });

export async function gemma(model: string, prompt: string, opts: { cache?: boolean } = {}) {
  const useCache = opts.cache ?? true;
  const key = crypto.createHash("sha256").update(model + "\n" + prompt).digest("hex");
  const file = `${cacheDir}/${key}.txt`;
  if (useCache) {
    try { return await fs.readFile(file, "utf8"); } catch {}
  }
  let last: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await ai.models.generateContent({ model, contents: prompt });
      const text = response.text ?? "";
      if (useCache) await fs.writeFile(file, text, "utf8");
      return text;
    } catch (err) {
      last = err;
      await new Promise(r => setTimeout(r, 700 * 2 ** attempt));
    }
  }
  throw last;
}

export function extractJson(text: string): unknown {
  const clean = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const a = clean.indexOf("{");
  const b = clean.lastIndexOf("}");
  if (a < 0 || b < a) throw new Error("No JSON object found in model response");
  return JSON.parse(clean.slice(a, b + 1));
}
