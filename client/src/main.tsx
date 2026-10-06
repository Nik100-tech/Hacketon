import { useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

type Turn = {
  n: number;
  role: "user" | "assistant";
  text: string;
};

type Source = "chatgpt" | "gemini";

type AppData = {
  handover: any;
  diff: any;
};

const API = "http://localhost:3001";

const initialTurns: Turn[] = [
  {
    n: 1,
    role: "user",
    text: "We're building a blood bank app. Backend must be PostgreSQL, Firebase is rejected because of cost.",
  },
  {
    n: 2,
    role: "assistant",
    text: "Understood: PostgreSQL, no Firebase.",
  },
  {
    n: 3,
    role: "user",
    text: "The demo is due Friday 5pm, that's a hard deadline.",
  },
  {
    n: 4,
    role: "assistant",
    text: "Noted. Donor module is next.",
  },
  {
    n: 5,
    role: "user",
    text: "Rare blood emergency finder and expiry alerts matter most.",
  },
  {
    n: 6,
    role: "assistant",
    text: "Got it. Those are the priority modules.",
  },
];

function App() {
  const [turns, setTurns] = useState<Turn[]>(initialTurns);
  const [text, setText] = useState("");
  const [budget, setBudget] = useState(400);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const [source, setSource] = useState<Source>("chatgpt");
  const [conversationUrl, setConversationUrl] = useState("");

  const [data, setData] = useState<AppData | null>(null);

  function add() {
    const value = text.trim();

    if (!value) return;

    setTurns((current) => [
      ...current,
      {
        n: current.length + 1,
        role: "user",
        text: value,
      },
    ]);

    setText("");
  }

  async function handover() {
    if (!turns.length) return;

    setLoading(true);

    try {
      const response = await fetch(`${API}/api/handover`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          turns,
          budget,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create handover");
      }

      setData(result);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Failed to create handover."
      );
    } finally {
      setLoading(false);
    }
  }

  async function importConversation() {
    const url = conversationUrl.trim();

    if (!url) return;

    setImporting(true);

    try {
      const endpoint =
        source === "chatgpt"
          ? "/api/import-chatgpt"
          : "/api/import-gemini";

      const response = await fetch(`${API}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            `Failed to import ${source === "chatgpt" ? "ChatGPT" : "Gemini"} conversation`
        );
      }

      const importedTurns: Turn[] = Array.isArray(result.turns)
        ? result.turns.map((turn: any, index: number) => ({
            n: index + 1,
            role: turn.role === "assistant" ? "assistant" : "user",
            text: String(turn.text ?? ""),
          }))
        : [];

      if (!importedTurns.length) {
        throw new Error(
          `The ${source === "chatgpt" ? "ChatGPT" : "Gemini"} conversation contained no readable turns.`
        );
      }

      setTurns(importedTurns);
      setData(null);
      setConversationUrl("");

      alert(
        `Imported ${importedTurns.length} conversation turns from ${
          source === "chatgpt" ? "ChatGPT" : "Gemini"
        }.`
      );
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : `Failed to import ${
              source === "chatgpt" ? "ChatGPT" : "Gemini"
            } conversation.`
      );
    } finally {
      setImporting(false);
    }
  }

  async function newSession() {
    try {
      await fetch(`${API}/api/reset`, {
        method: "POST",
      });
    } catch {
      // Backend reset is optional for the UI.
    }

    setTurns([]);
    setData(null);
    setText("");
    setConversationUrl("");
  }

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>ContextBridge</h1>
          <p>Conversation handover with Gemma 4</p>
        </div>

        <div className="badge">{turns.length} turns</div>
      </header>

      <main>
        {/* AI SOURCE IMPORT */}

        <section className="panel import-panel">
          <div className="title">
            <b>Import previous AI conversation</b>
          </div>

          <p className="empty">
            Choose an AI platform and import its conversation into
            ContextBridge.
          </p>

          {/* SOURCE SELECTOR */}

          <div
            style={{
              display: "flex",
              gap: "10px",
              marginBottom: "14px",
            }}
          >
            <button
              className={source === "chatgpt" ? "primary" : ""}
              onClick={() => setSource("chatgpt")}
              disabled={importing}
            >
              ChatGPT
            </button>

            <button
              className={source === "gemini" ? "primary" : ""}
              onClick={() => setSource("gemini")}
              disabled={importing}
            >
              Gemini
            </button>
          </div>

          <div className="composer">
            <input
              value={conversationUrl}
              onChange={(e) =>
                setConversationUrl(e.target.value)
              }
              placeholder={
                source === "chatgpt"
                  ? "https://chatgpt.com/share/..."
                  : "Paste Gemini conversation URL..."
              }
            />

            <button
              className="primary"
              onClick={importConversation}
              disabled={
                importing || !conversationUrl.trim()
              }
            >
              {importing
                ? "Importing..."
                : `Import ${
                    source === "chatgpt" ? "ChatGPT" : "Gemini"
                  }`}
            </button>
          </div>
        </section>

        {/* CONVERSATION */}

        <section className="panel transcript">
          <div className="title">
            <b>Conversation</b>
            <span>{turns.length} turns</span>
          </div>

          <div className="meter">
            <span
              style={{
                width: `${Math.min(
                  100,
                  turns.reduce(
                    (total, turn) =>
                      total + turn.text.length,
                    0
                  ) / 15
                )}%`,
              }}
            />
          </div>

          <div className="messages">
            {turns.map((turn) => (
              <div
                className={`msg ${turn.role}`}
                key={turn.n}
              >
                <small>
                  Turn {turn.n} · {turn.role}
                </small>

                {turn.text}
              </div>
            ))}
          </div>

          <div className="composer">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  add();
                }
              }}
              placeholder="Add a conversation turn..."
            />

            <button onClick={add}>Add</button>
          </div>

          <div className="actions">
            <label>
              Memory budget{" "}
              <input
                type="number"
                value={budget}
                onChange={(e) =>
                  setBudget(Number(e.target.value))
                }
              />{" "}
              tokens
            </label>

            <button
              className="primary"
              onClick={handover}
              disabled={loading || !turns.length}
            >
              {loading
                ? "Creating..."
                : "Create handover"}
            </button>

            <button onClick={newSession}>
              New session
            </button>
          </div>
        </section>

        {/* HANDOVER */}

        <section className="panel handover">
          <div className="title">
            <b>Handover</b>

            {data && (
              <span>
                {data.handover.stats.itemCount} memories
              </span>
            )}
          </div>

          {!data ? (
            <div className="empty">
              Create a handover to see what survives
              the context boundary.
            </div>
          ) : (
            <>
              <div className="brief">
                <b>Resume brief</b>
                <p>{data.handover.resumeBrief}</p>
              </div>

              <div className="items">
                {data.handover.items.map(
                  (item: any) => (
                    <article
                      className={`item ${item.tier}`}
                      key={item.id}
                    >
                      <div>
                        <b>{item.statement}</b>

                        <span>
                          {item.tier} · {item.type} ·{" "}
                          {item.verified
                            ? "verified"
                            : "unverified"}
                        </span>
                      </div>

                      <small>
                        Evidence: “
                        {item.evidence_quote}
                        ”
                        <br />
                        Reason: {item.reason}
                      </small>
                    </article>
                  )
                )}
              </div>
            </>
          )}
        </section>

        {/* MEMORY DIFF */}

        <section className="panel diff">
          <div className="title">
            <b>Memory diff</b>
          </div>

          {!data ? (
            <div className="empty">
              Preserved / dropped / changed / added
              will appear here.
            </div>
          ) : (
            <>
              <div className="stat">
                <b>{data.diff.preserved.length}</b>
                <span>Preserved</span>
              </div>

              <div className="stat">
                <b>{data.diff.added.length}</b>
                <span>Added</span>
              </div>

              <div className="stat">
                <b>{data.diff.changed.length}</b>
                <span>Changed</span>
              </div>

              <div className="stat">
                <b>{data.diff.dropped.length}</b>
                <span>Dropped</span>
              </div>

              <hr />

              <pre>
                {JSON.stringify(
                  data.diff,
                  null,
                  2
                )}
              </pre>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

createRoot(
  document.getElementById("root")!
).render(<App />);