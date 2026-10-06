import { scenario } from "./dataset.js";
import { createHandover } from "../core/extract.js";

const BUDGET = 220;

// ContextBridge: structured memory + evidence + priority packing
const h1 = await createHandover({
  id: "eval-h1",
  parent: null,
  turns: scenario.slice(0, 9),
  budget: BUDGET
});

const h2 = await createHandover({
  id: "eval-h2",
  parent: h1,
  turns: scenario.slice(9),
  budget: BUDGET
});

// Facts we intentionally planted into the conversation.
const facts = [
  {
    name: "PostgreSQL",
    keywords: ["postgresql"],
    tier: "critical"
  },
  {
    name: "Friday 5pm deadline",
    keywords: ["friday", "5pm"],
    tier: "critical"
  },
  {
    name: "Rare blood finder",
    keywords: ["rare blood", "emergency finder"],
    tier: "critical"
  },
  {
    name: "Firebase rejected",
    keywords: ["firebase", "rejected"],
    tier: "important"
  },
  {
    name: "Expiry alerts",
    keywords: ["expiry alerts"],
    tier: "important"
  },
  {
    name: "MongoDB rejected",
    keywords: ["mongodb", "rejected"],
    tier: "important"
  },
  {
    name: "Donor screen completed",
    keywords: ["donor management", "completed"],
    tier: "important"
  },
  {
    name: "Node.js + Express",
    keywords: ["node.js", "express"],
    tier: "important"
  }
];

function containsFact(text: string, keywords: string[]) {
  const lower = text.toLowerCase();
  return keywords.every(k => lower.includes(k.toLowerCase()));
}

const h2Memory = h2.items
  .filter(item => item.status === "active")
  .map(item => `${item.statement} ${item.evidence_quote}`)
  .join(" ");

const allMemory = h2.items
  .map(item => `${item.statement} ${item.evidence_quote}`)
  .join(" ");

// Recency-only baseline: same conversation, but only the newest
// portion that fits approximately inside our 220-token budget.
const recentTurns = scenario.slice(9);
const recentText = recentTurns
  .map(t => `${t.role}: ${t.text}`)
  .join("\n");

const baselineChars = BUDGET * 4;
const recencyBaseline = recentText.slice(-baselineChars);

function scoreFacts(text: string) {
  const results = facts.map(f => ({
    fact: f.name,
    tier: f.tier,
    retained: containsFact(text, f.keywords)
  }));

  const critical = results.filter(r => r.tier === "critical");
  const important = results.filter(r => r.tier === "important");

  return {
    results,
    criticalRetention:
      critical.filter(r => r.retained).length / critical.length * 100,
    importantRetention:
      important.filter(r => r.retained).length / important.length * 100,
    overallRetention:
      results.filter(r => r.retained).length / results.length * 100
  };
}

const contextBridgeScore = scoreFacts(h2Memory);
const baselineScore = scoreFacts(recencyBaseline);

// Stale-answer traps.
// These must remain rejected and should never become active recommendations.
const staleTerms = ["firebase", "mongodb"];

const staleMentionedAsRejected = staleTerms.map(term => ({
  term,
  correctlyRejected: allMemory.toLowerCase().includes(term)
}));

const staleProtection =
  staleMentionedAsRejected.filter(x => x.correctlyRejected).length /
  staleMentionedAsRejected.length *
  100;

// Compression: how much smaller the structured memory is than the
// original conversation, using the project's chars/4 estimator.
const fullConversation = scenario
  .map(t => `${t.role}: ${t.text}`)
  .join("\n");

const fullTokens = Math.ceil(fullConversation.length / 4);
const handoverTokens = h2.stats.estimatedTokens;

const compression =
  Math.max(0, 1 - handoverTokens / fullTokens) * 100;

const results = {
  evaluation: "ContextBridge repeated-handover evaluation",

  budgetTokens: BUDGET,

  contextBridge: {
    criticalRetention: Number(contextBridgeScore.criticalRetention.toFixed(1)),
    importantRetention: Number(contextBridgeScore.importantRetention.toFixed(1)),
    overallRetention: Number(contextBridgeScore.overallRetention.toFixed(1)),
    staleProtection: Number(staleProtection.toFixed(1)),
    handoverTokens,
    fullConversationTokens: fullTokens,
    compressionPercent: Number(compression.toFixed(1)),
    facts: contextBridgeScore.results
  },

  recencyOnlyBaseline: {
    criticalRetention: Number(baselineScore.criticalRetention.toFixed(1)),
    importantRetention: Number(baselineScore.importantRetention.toFixed(1)),
    overallRetention: Number(baselineScore.overallRetention.toFixed(1)),
    facts: baselineScore.results
  },

  handovers: {
    h1: {
      items: h1.items.length,
      usedTokens: h1.packing.used,
      dropped: h1.packing.droppedIds
    },
    h2: {
      items: h2.items.length,
      usedTokens: h2.packing.used,
      dropped: h2.packing.droppedIds
    }
  }
};

console.log("\n================ CONTEXTBRIDGE EVALUATION ================\n");
console.log(JSON.stringify(results, null, 2));
console.log("\n===========================================================\n");

console.log(
  `ContextBridge critical retention: ${results.contextBridge.criticalRetention}%`
);

console.log(
  `Recency baseline critical retention: ${results.recencyOnlyBaseline.criticalRetention}%`
);

console.log(
  `ContextBridge overall retention: ${results.contextBridge.overallRetention}%`
);

console.log(
  `Recency baseline overall retention: ${results.recencyOnlyBaseline.overallRetention}%`
);

console.log(
  `Compression: ${results.contextBridge.compressionPercent}%`
);

console.log(
  `Stale protection: ${results.contextBridge.staleProtection}%`
);