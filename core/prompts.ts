import type { Turn, Item } from "./schema.js";

export function fmtTurns(turns: Turn[]) {
  return turns.map(t => `[Turn ${t.n}][${t.role}] ${t.text}`).join("\n");
}

export function extractPrompt(prevItems: Item[], turns: Turn[], nextIdStart: number) {
  const previous = prevItems.length ? JSON.stringify(prevItems.map(({ verified, tokens, ...x }) => x), null, 2) : "[]";
  return `You are the memory compiler for ContextBridge, an AI conversation handover system.

Return ONLY valid JSON with this exact shape:
{"resume_brief":"<=80 words","items":[{"id":"m1","tier":"critical|important|temporary","type":"decision|requirement|constraint|deadline|rejected_option|preference|progress","statement":"short exact statement","status":"active|superseded","evidence_quote":"verbatim quote <=20 words","reason":"one sentence"}]}

Previous verified ledger:
${previous}

New conversation segment:
${fmtTurns(turns)}

Rules:
1. Preserve previous item IDs when the same fact remains true.
2. New facts get IDs m${nextIdStart}, m${nextIdStart + 1}, ...
3. If a decision/requirement changes, keep the old item as superseded and add the new active item.
4. Rejected options must be explicit so they are not suggested again.
5. Buried hard requirements remain critical.
6. Keep exact names, numbers and dates.
7. Evidence quotes must be copied verbatim from the supplied segment; previous verified evidence may remain unchanged.
8. Do not invent facts.
9. Temporary chatter should not crowd out critical/important memory.
10. Prefer a small accurate ledger over a large vague summary.`;
}

export function repairPrompt(bad: string) {
  return `Repair this response into ONLY valid JSON matching the requested schema. Do not add commentary.\n\n${bad}`;
}
