import { z } from "zod";

export const Tier = z.enum(["critical", "important", "temporary"]);
export const ItemType = z.enum([
  "decision",
  "requirement",
  "constraint",
  "deadline",
  "rejected_option",
  "preference",
  "progress"
]);

export const ModelItem = z.object({
  id: z.string(),
  tier: Tier,
  type: ItemType,
  statement: z.string(),
  status: z.enum(["active", "superseded"]),
  evidence_quote: z.string(),
  reason: z.string()
});

export const ModelOutput = z.object({
  resume_brief: z.string(),
  items: z.array(ModelItem)
});

export type Turn = { n: number; role: "user" | "assistant"; text: string };
export type Item = z.infer<typeof ModelItem> & { verified: boolean; tokens: number };

export type Handover = {
  id: string;
  parentId: string | null;
  resumeBrief: string;
  items: Item[];
  packing: { budget: number; used: number; criticalOverflow: boolean; droppedIds: string[] };
  stats: { rawChars: number; estimatedTokens: number; itemCount: number };
};
