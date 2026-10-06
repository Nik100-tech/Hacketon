import type { Handover } from "./schema.js";

export function diffHandovers(prev: Handover | null, next: Handover) {
  if (!prev) return { preserved: [], dropped: next.packing.droppedIds, changed: [], added: next.items.map(i => i.id) };
  const a = new Map(prev.items.map(i => [i.id, i]));
  const b = new Map(next.items.map(i => [i.id, i]));
  const preserved: string[] = [], dropped: string[] = [], changed: string[] = [], added: string[] = [];
  for (const [id, item] of a) {
    if (!b.has(id)) dropped.push(id);
    else if (b.get(id)!.statement !== item.statement || b.get(id)!.status !== item.status) changed.push(id);
    else preserved.push(id);
  }
  for (const id of b.keys()) if (!a.has(id)) added.push(id);
  return { preserved, dropped: [...dropped, ...next.packing.droppedIds], changed, added };
}
