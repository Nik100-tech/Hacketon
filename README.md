# ContextBridge

ContextBridge is an AI conversation handover system for long conversations. When a conversation approaches a simulated context limit, Gemma 4 turns the recent conversation into a compact, structured memory ledger that a fresh session can use to continue without losing critical decisions.

## What makes it different

- **Three memory tiers:** critical, important, temporary.
- **Evidence anchored:** every extracted memory keeps a short verbatim evidence quote.
- **Incremental ledger:** previous memories are updated instead of recursively summarizing summaries.
- **Supersession tracking:** changed decisions remain visible as no-longer-valid items.
- **Code-side verification:** evidence quotes are checked against source turns and the packing/diff logic is deterministic.
- **Evaluation:** a baseline recursive summary is compared with ContextBridge over repeated handovers.

## Stack

TypeScript, React/Vite, Express, Google GenAI SDK, Gemma 4, Zod. No database.

## Setup in VS Code

```bash
npm install
copy .env.example .env
```

Put your Gemini API key in `.env`.

Run the core smoke test:

```bash
npm run test:core
```

Run the app:

```bash
npm run dev
```

Frontend: http://localhost:5173
API: http://localhost:3001

## Models

The project defaults to `gemma-4-31b-it` for handover extraction and `gemma-4-26b-a4b-it` for answering. If the currently available API model IDs differ, change them in `.env`.

## Token budget

The demo uses a deliberately small simulated context budget. Token estimation is intentionally simple: `ceil(characters / 4)`. This is an approximation used consistently for the experiment, not a claim about the model tokenizer.
