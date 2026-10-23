import { useCallback, useRef, useState } from "react";
import { apiFetch } from "../account/session";

/**
 * The AI assistant panel (TASK-130).
 *
 * One screen, reachable from Settings for now: a question box, the recent
 * turns, and the tool trace. The client owns the transcript — the server is
 * stateless — and every request posts the recent turns so the model keeps
 * context within one sitting.
 *
 * Signed-out behavior follows the account module's rule: `apiFetch` returns
 * null for a Guest, and the panel says the assistant needs an Account rather
 * than pretending to think.
 */

interface ToolCallTrace {
  tool: string;
  args: unknown;
}

interface AiTurnView {
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCallTrace[];
}

const MAX_TURNS_SENT = 12;

/** Sends the conversation and returns the reply, or throws a readable error. */
async function askAssistant(turns: AiTurnView[]): Promise<{ reply: string; toolCalls: ToolCallTrace[] }> {
  const response = await apiFetch("/api/ai/chat", {
    method: "POST",
    body: JSON.stringify({
      turns: turns
        .filter((t) => !t.toolCalls) // tool traces are view-only, never re-sent
        .slice(-MAX_TURNS_SENT)
        .map((t) => ({ role: t.role, content: t.content })),
    }),
  });
  if (response === null) throw new Error("The assistant needs an Account. Sign in to use it.");
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? "The assistant could not answer right now.");
  }
  const data = (await response.json()) as { reply?: string; toolCalls?: ToolCallTrace[] };
  return { reply: data.reply ?? "", toolCalls: data.toolCalls ?? [] };
}

export default function AiAssistantScreen() {
  const [turns, setTurns] = useState<AiTurnView[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }));
  }, []);

  const send = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || busy) return;
      setError(null);
      const withQuestion: AiTurnView[] = [...turns, { role: "user", content: question }];
      setTurns(withQuestion);
      setInput("");
      setBusy(true);
      scrollToEnd();
      try {
        const { reply, toolCalls } = await askAssistant(withQuestion);
        setTurns((prev) => [...prev, { role: "assistant", content: reply, toolCalls }]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "The assistant could not answer right now.");
      } finally {
        setBusy(false);
        scrollToEnd();
      }
    },
    [busy, turns, scrollToEnd],
  );

  return (
    <section className="ai-assistant" aria-label="AI assistant">
      <h2>AI assistant</h2>
      <p className="ai-assistant-hint">
        Ask about your players, ratings, squads and splits. The assistant reads your data through the
        app's own tools. It can look, never change.
      </p>

      <div className="ai-assistant-log" ref={listRef}>
        {turns.length === 0 && !busy && (
          <p className="ai-assistant-empty">Try: “Who rates highest in Fitness?” or “How many players are in Sunday League?”</p>
        )}
        {turns.map((turn, i) => (
          <div key={i} className={`ai-assistant-turn ai-assistant-${turn.role}`}>
            <span className="ai-assistant-who">{turn.role === "user" ? "You" : "Assistant"}</span>
            {turn.toolCalls && turn.toolCalls.length > 0 && (
              <ul className="ai-assistant-tools" aria-label="Tools the assistant used">
                {turn.toolCalls.map((t, j) => (
                  <li key={j}>
                    <code>{t.tool}</code>
                    <span className="ai-assistant-tool-args">{JSON.stringify(t.args)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="ai-assistant-content">{turn.content}</p>
          </div>
        ))}
        {busy && (
          <div className="ai-assistant-turn ai-assistant-assistant">
            <span className="ai-assistant-who">Assistant</span>
            <p className="ai-assistant-content ai-assistant-thinking" role="status">
              Looking things up…
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className="ai-assistant-error" role="alert">
          {error}
        </p>
      )}

      <form
        className="ai-assistant-composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your roster…"
          aria-label="Ask the assistant"
          disabled={busy}
        />
        <button type="submit" disabled={busy || !input.trim()}>
          {busy ? "…" : "Ask"}
        </button>
      </form>
    </section>
  );
}
