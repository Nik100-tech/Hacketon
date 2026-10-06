import { gemma, extractJson, MODELS } from "./gemma.js";
import { ModelOutput, type Handover, type Item, type Turn } from "./schema.js";
import { extractPrompt, repairPrompt } from "./prompts.js";

export const estTokens = (text: string) => Math.ceil(text.length / 4);

async function callWithRepair(prompt: string) {
  let raw = await gemma(MODELS.handover, prompt);
  try { return ModelOutput.parse(extractJson(raw)); }
  catch { raw = await gemma(MODELS.handover, repairPrompt(raw), { cache: false }); return ModelOutput.parse(extractJson(raw)); }
}

function verifyQuote(quote: string, turns: Turn[], previous: Item[]) {
  if (!quote) return false;
  const q = quote.toLowerCase().trim();
  return turns.some(t => t.text.toLowerCase().includes(q)) || previous.some(i => i.verified && i.evidence_quote.toLowerCase().trim() === q);
}

function pack(items: Item[], budget: number) {
  const rank = (i: Item) => i.tier === "critical" && i.status === "active" ? 0 : i.tier === "critical" ? 1 : i.tier === "important" && i.status === "active" ? 2 : 3;
  const ordered = [...items].sort((a,b) => rank(a)-rank(b));
  const kept: Item[] = []; const dropped: string[] = []; let used = 0;
  for (const item of ordered) {
    if (item.tier === "temporary") { dropped.push(item.id); continue; }
    const cost = estTokens(item.statement + item.evidence_quote + item.reason) + 8;
    if (used + cost <= budget) { kept.push({...item, tokens: cost}); used += cost; }
    else dropped.push(item.id);
  }
  return { kept, dropped, used, criticalOverflow: kept.some(i => i.tier === "critical") === false && items.some(i => i.tier === "critical") };
}

export async function createHandover(args: { id: string; parent: Handover | null; turns: Turn[]; budget: number }): Promise<Handover> {
  const prev = args.parent?.items ?? [];
  const nextIdStart = prev.length + 1;
  const model = await callWithRepair(extractPrompt(prev, args.turns, nextIdStart));
  const items: Item[] = model.items.map(i => ({ ...i, verified: verifyQuote(i.evidence_quote, args.turns, prev), tokens: 0 }));
  const packed = pack(items, args.budget);
  return {
    id: args.id,
    parentId: args.parent?.id ?? null,
    resumeBrief: model.resume_brief,
    items: packed.kept,
    packing: { budget: args.budget, used: packed.used, criticalOverflow: packed.criticalOverflow, droppedIds: packed.dropped },
    stats: { rawChars: args.turns.reduce((n,t)=>n+t.text.length,0), estimatedTokens: estTokens(args.turns.map(t=>t.text).join("\n")), itemCount: packed.kept.length }
  };
}

export function toSystemPrompt(h: Handover) {
  const active = h.items.filter(i => i.status === "active");
  const stale = h.items.filter(i => i.status === "superseded");
  return `You are continuing a conversation using a verified handover. Do not guess.\n\nRESUME:\n${h.resumeBrief}\n\nACTIVE MEMORY:\n${active.map(i=>`- [${i.tier}] ${i.statement} (evidence: ${i.evidence_quote})`).join("\n")}\n\nNO LONGER VALID:\n${stale.map(i=>`- ${i.statement}`).join("\n")}`;
}
