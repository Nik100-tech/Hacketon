import express from "express";
import cors from "cors";
import { fetchChatGptShare } from "chatgpt-share-parser";

import { createHandover } from "../core/extract.js";
import { diffHandovers } from "../core/diff.js";
import type { Handover, Turn, Item } from "../core/schema.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

let last: Handover | null = null;

/* ============================================================
   DETERMINISTIC FALLBACK

   Used when Gemma quota is exhausted.

   Important:
   - Keeps real project evidence.
   - Removes development/debugging chatter.
   - Does not invent NodeMCU facts.
   ============================================================ */

function fallbackHandover(
  turns: Turn[],
  budget: number,
  parent: Handover | null,
  id: string
): Handover {
  const allText = turns.map((t) => t.text).join("\n");

  const candidates: Array<{
    statement: string;
    type: Item["type"];
    tier: "critical" | "important";
    evidence_quote: string;
    reason: string;
    score: number;
  }> = [];

  function add(
    statement: string,
    type: Item["type"],
    tier: "critical" | "important",
    evidence: string,
    reason: string,
    score: number
  ) {
    const clean = statement.trim();

    if (!clean) return;

    if (
      !candidates.some(
        (x) =>
          x.statement.toLowerCase() === clean.toLowerCase()
      )
    ) {
      candidates.push({
        statement: clean,
        type,
        tier,
        evidence_quote: evidence.slice(0, 240),
        reason,
        score,
      });
    }
  }

  /*
   * These are conversation-management/debugging phrases.
   * They must NOT become project memory.
   */
  const noise = [
    "cannot post",
    "api/import-",
    "gemini",
    "gemini route",
    "gemini parser",
    "gemini import",
    "failed to import gemini",

    "chatgpt importer",
    "importing chatgpt conversation",

    "server/index.ts",
    "corrected complete server",
    "give you a corrected complete",
    "change only the gemini",
    "working chatgpt",
    "working chatgpt/handover",

    "keep the server terminal running",
    "server terminal",
    "running server is likely using",
    "old process",

    "restart the server",
    "restart server",
    "npm run server",
    "npm run dev",
    "npx tsc",
    "typescript compilation",

    "don't disturb the working",
    "do not disturb the working",

    "don't waste time",
    "do not waste time",
    "stop repeating",
    "repeating the curl",
    "curl test",
    "curl:",
    "node/curl",
    "node/curl cannot",

    "retrying it cannot fix",
    "same error again",
    "same clean error",
    "clean error",
    "previous run",
    "earlier index.ts",
    "current startup",
    "startup is successful",
    "server is running correctly",
    "running correctly",

    "network: use --host to expose",
    "use --host to expose",

    "debugging",
    "debug",
    "code fix",
    "fix the code",
    "replace the code",
    "replace this block",
    "paste this",
    "paste the code",
    "entire file",
    "complete file",

    "i can give you",
    "i will give you",
    "let's fix",
    "lets fix",
    "what is wrong with",
    "now what",
    "what should i do",
    "do this exact fix",

    "technical implementation detail is preserved",
    "implementation detail is preserved",
  ];

  for (const turn of turns) {
    /*
     * Split transcript into reasonably sized sentences.
     */
    const sentences = turn.text
      .replace(/\r/g, "")
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s) => s.trim())
      .filter(
        (s) =>
          s.length >= 15 &&
          s.length <= 500
      );

    for (const sentence of sentences) {
      /*
       * Clean markdown / HTML artifacts that can appear
       * in imported ChatGPT shared conversations.
       */
      const normalized = sentence
        .replace(/<[^>]*>/g, " ")
        .replace(/&[#a-z0-9]+;/gi, " ")
        .replace(/\*+/g, "")
        .replace(/`+/g, "")
        .replace(/\\+/g, "")
        .replace(/\s+/g, " ")
        .trim();

      if (!normalized) continue;

      const lower = normalized.toLowerCase();

      /*
       * Strong development/debugging exclusion.
       *
       * IMPORTANT:
       * We do NOT exclude "esptool" itself.
       * An actual esptool error can be valuable NodeMCU
       * project memory.
       */
      if (
        noise.some((phrase) => lower.includes(phrase)) ||
        lower.includes("debugging") ||
        lower.includes("server/index.ts") ||
        lower.includes("chatgpt importer") ||
        lower.includes("api route") ||
        lower.includes("backend") ||
        lower.includes("terminal") ||
        lower.includes("localhost") ||
        lower.includes("127.0.0.1") ||
        lower.includes("vite") ||
        lower.includes("express server")
      ) {
        continue;
      }

      /*
       * Ignore obvious shell/debug output.
       */
      if (
        /^(pre>|node\/curl|cannot post|curl:|error:|failed:)/i.test(
          normalized
        )
      ) {
        /*
         * Keep real hardware/tool errors such as:
         * "esptool: error: ..."
         *
         * Only reject generic development output.
         */
        if (
          !/\b(esptool|nodemcu|esp8266|esp32|arduino)\b/i.test(
            normalized
          )
        ) {
          continue;
        }
      }

      /*
       * Remove obvious conversational meta-instructions.
       */
      if (
        /^(yes|no|okay|ok|yep|yeah|sure|exactly|great|perfect)[,!. ]/i.test(
          normalized
        )
      ) {
        continue;
      }

      let score = 0;

      let tier: "critical" | "important" = "important";

      let type: Item["type"] = "progress";

      let reason =
        "Explicit information preserved from the transcript.";

      /* ========================================================
         REQUIREMENTS / DECISIONS
         ======================================================== */

      if (
        /\b(
          must|
          need to|
          required|
          requirement|
          should|
          have to|
          has to|
          use|
          using|
          selected|
          choose|
          chosen|
          decided|
          confirmed|
          keep|
          avoid|
          don't|
          do not|
          cannot|
          can't|
          rejected
        )\b/ix.test(normalized)
      ) {
        score += 5;
        tier = "critical";
        type = "requirement";

        reason =
          "An explicit requirement, decision, constraint, or rejected option appears in the transcript.";
      }

      /* ========================================================
         DEADLINES
         ======================================================== */

      if (
        /\b(
          deadline|
          due|
          today|
          tomorrow|
          tonight|
          before|
          by\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)|
          at\s+\d
        )\b/ix.test(normalized)
      ) {
        score += 7;
        tier = "critical";
        type = "requirement";

        reason =
          "A time-sensitive constraint or deadline appears in the transcript.";
      }

      /* ========================================================
         PROBLEMS / FAILURES
         ======================================================== */

      if (
        /\b(
          error|
          failed|
          failure|
          problem|
          issue|
          bug|
          broken|
          doesn't work|
          does not work|
          not working|
          unable|
          cannot
        )\b/ix.test(normalized)
      ) {
        score += 4;
        type = "progress";

        reason =
          "A problem or failed step is preserved so the next session does not repeat it.";
      }

      /* ========================================================
         SUCCESSFUL PROGRESS
         ======================================================== */

      if (
        /\b(
          installed|
          working|
          worked|
          succeeded|
          success|
          successful|
          completed|
          done|
          fixed|
          configured|
          connected|
          created|
          built|
          implemented|
          detected|
          accepted|
          passed
        )\b/ix.test(normalized)
      ) {
        score += 3;
        type = "progress";

        reason =
          "Completed or successful progress is preserved for continuity.";
      }

      /* ========================================================
         TECHNICAL / HARDWARE DETAILS
         ======================================================== */

      if (
        /https?:\/\/\S+|\/[A-Za-z0-9_.-]+\/|\b[A-Za-z0-9_.-]+\.[A-Za-z]{2,}\b/i.test(
          normalized
        ) ||
        /\b(
          esp8266|
          esp32|
          nodemcu|
          arduino|
          esptool|
          sensor|
          gpio|
          serial|
          uart|
          wifi|
          wi-fi|
          bluetooth|
          mqtt|
          microcontroller|
          board|
          usb|
          firmware|
          flash|
          port|
          baud|
          python|
          c\+\+|
          cpp|
          javascript|
          typescript|
          api|
          model|
          database
        )\b/ix.test(normalized)
      ) {
        score += 4;

        reason =
          "A concrete technical or hardware detail is preserved from the transcript.";
      }

      /*
       * User statements are slightly more valuable because they
       * usually represent the actual requirement or observation.
       */
      if (turn.role === "user") {
        score += 1;
      }

      /*
       * Reject short generic sentences.
       */
      if (
        /^(what|why|how|now what|okay|ok|yes|no|thanks|thank you)\b/i.test(
          normalized
        )
      ) {
        continue;
      }

      /*
       * Final quality threshold.
       */
      if (score >= 3) {
        add(
          normalized,
          type,
          tier,
          normalized,
          reason,
          score
        );
      }
    }
  }

  /*
   * If no reliable project evidence survived the filter,
   * do NOT dump the raw transcript back into memory.
   */
  if (candidates.length === 0) {
    add(
      "Continue from the verified context of the previous conversation.",
      "progress",
      "important",
      "No suitable transcript sentence passed the evidence filter.",
      "A safe generic continuity instruction is used instead of preserving filtered debugging chatter.",
      1
    );
  }

  /*
   * Highest-value evidence first.
   */
  candidates.sort(
    (a, b) =>
      b.score - a.score ||
      (a.tier === "critical" ? -1 : 1)
  );

  /*
   * Keep the memory compact.
   */
  const maxItems = Math.max(
    1,
    Math.floor(
      Math.max(100, budget - 80) / 45
    )
  );

  const selected = candidates.slice(0, maxItems);

  const items: Item[] = selected.map(
    (item, index) => ({
      id: `m${index + 1}`,
      tier: item.tier,
      type: item.type,
      statement: item.statement,
      status: "active",
      evidence_quote: item.evidence_quote,
      reason: item.reason,
      verified: true,
      tokens: Math.ceil(
        item.statement.length / 4
      ),
    })
  );

  const droppedIds = candidates
    .slice(selected.length)
    .map(
      (_, index) =>
        `m${selected.length + index + 1}`
    );

  const used = items.reduce(
    (sum, item) => sum + item.tokens,
    0
  );

  return {
    id,

    parentId:
      parent?.id ?? null,

    resumeBrief:
      "Continue from the verified requirements, decisions, problems, and completed progress preserved from the previous conversation. The fallback uses transcript evidence directly and does not invent domain-specific facts.",

    items,

    packing: {
      budget,
      used,
      criticalOverflow: false,
      droppedIds,
    },

    stats: {
      rawChars:
        allText.length +
        (parent?.stats.rawChars ?? 0),

      estimatedTokens:
        Math.ceil(allText.length / 4),

      itemCount: items.length,
    },
  };
}

/* ============================================================
   HEALTH
   ============================================================ */

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    model:
      process.env.HANDOVER_MODEL ??
      "gemma-4-31b-it",
  });
});

/* ============================================================
   CHATGPT IMPORT
   ============================================================ */

app.post(
  "/api/import-chatgpt",
  async (req, res) => {
    try {
      const url = String(
        req.body.url ?? ""
      ).trim();

      if (
        !url.startsWith(
          "https://chatgpt.com/share/"
        )
      ) {
        return res.status(400).json({
          error:
            "Please enter a valid ChatGPT shared conversation URL.",
        });
      }

      console.log(
        "Importing ChatGPT conversation..."
      );

      const chat =
        await fetchChatGptShare(url);

      const turns: Turn[] =
        chat.replies
          .filter(
            (reply: any) =>
              reply.type === "user" ||
              reply.type === "assistant"
          )
          .map(
            (
              reply: any,
              index: number
            ) => ({
              n: index + 1,
              role: reply.type,
              text: String(
                reply.statement ?? ""
              ),
            })
          )
          .filter(
            (turn: Turn) =>
              turn.text.trim().length > 0
          );

      console.log(
        `Imported ${turns.length} ChatGPT turns.`
      );

      return res.json({
        title: chat.title,
        source: "chatgpt",
        turns,
      });
    } catch (error) {
      console.error(
        "ChatGPT import failed:",
        error
      );

      return res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Failed to import ChatGPT conversation.",
      });
    }
  }
);

/* ============================================================
   CREATE HANDOVER
   ============================================================ */

app.post(
  "/api/handover",
  async (req, res) => {
    try {
      const turns =
        req.body.turns as Turn[];

      const budget = Number(
        req.body.budget ?? 400
      );

      if (
        !Array.isArray(turns) ||
        turns.length === 0
      ) {
        return res.status(400).json({
          error:
            "No conversation turns provided.",
        });
      }

      const id = `h${Date.now()}`;

      try {
        console.log(
          "Trying Gemma handover..."
        );

        const handover =
          await createHandover({
            id,
            parent: last,
            turns,
            budget,
          });

        const diff =
          diffHandovers(
            last,
            handover
          );

        last = handover;

        console.log(
          "Gemma handover succeeded."
        );

        return res.json({
          handover,
          diff,
          mode: "gemma",
        });
      } catch (gemmaError) {
        const message =
          gemmaError instanceof Error
            ? gemmaError.message
            : String(gemmaError);

        if (
          message.includes("429") ||
          message.includes(
            "RESOURCE_EXHAUSTED"
          ) ||
          message.includes("quota") ||
          message.includes("Quota")
        ) {
          console.log(
            "Gemma quota exhausted."
          );

          console.log(
            "Using deterministic fallback for demo."
          );

          const handover =
            fallbackHandover(
              turns,
              budget,
              last,
              id
            );

          const diff =
            diffHandovers(
              last,
              handover
            );

          last = handover;

          return res.json({
            handover,
            diff,
            mode: "fallback",
            notice:
              "Gemma API quota exhausted; deterministic evidence-preserving fallback used.",
          });
        }

        throw gemmaError;
      }
    } catch (error) {
      console.error(
        "Handover failed:",
        error
      );

      return res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : String(error),
      });
    }
  }
);

/* ============================================================
   RESET
   ============================================================ */

app.post(
  "/api/reset",
  (_req, res) => {
    last = null;

    res.json({
      ok: true,
    });
  }
);

/* ============================================================
   START SERVER
   ============================================================ */

const port = Number(
  process.env.PORT ?? 3001
);

app.listen(port, () => {
  console.log(
    `ContextBridge API running on http://localhost:${port}`
  );
});