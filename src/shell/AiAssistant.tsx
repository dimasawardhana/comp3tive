import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "../account/session";

/**
 * The AI assistant (TASK-130): a balloon button at the bottom-right of every
 * screen, opening a chat panel.
 *
 * It belongs to the chrome rather than to Settings because the question ("who
 * rates highest in Fitness?") arrives while the organizer is looking at the
 * roster, not while they are changing the theme. The transcript is
 * client-owned — the server is stateless — and it lives above the panel's
 * visibility, so closing the panel and asking again keeps the thread. Each
 * request posts the recent turns so the model keeps context within one sitting.
 *
 * Signed-out behavior follows the account module's rule: `apiFetch` returns
 * null for a Guest, and the panel says the assistant needs an Account rather
 * than pretending to think.
 *
 * The balloon clears the tab bar and sits on the app card's bottom inset; the
 * panel hangs off its left edge and grows upward. On the split and match
 * screens the sticky action bars (`src/split.css:789`) occupy that same corner,
 * so the balloon overlays the right end of the bar — a 48px bite out of a
 * 262px-wide primary on a 390 screen, with the label and the rest of the button
 * still live. That overlap is the accepted cost of the corner placement.
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

/** The close glyph: two strokes, matching the shell's icon weight. A text ✕
 *  would inherit the face's own cross and read as a different weight from every
 *  other icon in the chrome. */
function CloseGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </svg>
  );
}

/** The balloon glyph: a speech bubble with a tail and three dots, in ink. */
function BalloonGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M8.4 17H7a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-4.1L8.4 20.6V17Z" />
      <circle cx="8.6" cy="11" r="1.05" fill="currentColor" stroke="none" />
      <circle cx="12" cy="11" r="1.05" fill="currentColor" stroke="none" />
      <circle cx="15.4" cy="11" r="1.05" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<AiTurnView[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);

  // Opening puts the caret in the question box: the user pressed a chat
  // button, so the next keystroke is a question. Closing hands focus back to
  // the balloon, or Escape would drop it to the top of the page.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

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
        // The Ask button is disabled the moment the box empties, and clicking
        // it had put focus on it — so without this the caret lands on `<body>`
        // and Escape (handled on the panel) stops closing it.
        inputRef.current?.focus();
        scrollToEnd();
      }
    },
    [busy, turns, scrollToEnd],
  );

  return (
    <div className="ai-chat">
      <section
        id="ai-panel"
        className="ai-panel"
        role="dialog"
        aria-label="AI assistant"
        hidden={!open}
        onKeyDown={(e) => {
          if (e.key !== "Escape") return;
          e.stopPropagation();
          setOpen(false);
          launcherRef.current?.focus();
        }}
      >
        <header className="ai-head">
          <span className="ai-title">AI assistant</span>
          <span className="ai-sub">Reads your data through the app's own tools. It can look, never change.</span>
        </header>

        <div className="ai-log" ref={listRef} role="log" aria-live="polite">
          {turns.length === 0 && !busy && (
            <p className="ai-empty">Try: “Who rates highest in Fitness?” or “How many players are in Sunday League?”</p>
          )}
          {turns.map((turn, i) => (
            <div key={i} className={`ai-turn ai-turn-${turn.role}`}>
              <span className="ai-who">{turn.role === "user" ? "You" : "Assistant"}</span>
              {turn.toolCalls && turn.toolCalls.length > 0 && (
                <ul className="ai-tools" aria-label="Tools the assistant used">
                  {turn.toolCalls.map((t, j) => (
                    <li key={j}>
                      <code>{t.tool}</code>
                      <span className="ai-tool-args">{JSON.stringify(t.args)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="ai-content">{turn.content}</p>
            </div>
          ))}
          {busy && (
            <div className="ai-turn ai-turn-assistant">
              <span className="ai-who">Assistant</span>
              <p className="ai-content ai-thinking" role="status">
                Looking things up…
              </p>
            </div>
          )}
        </div>

        {error && (
          <p className="ai-error" role="alert">
            {error}
          </p>
        )}

        <form
          className="ai-composer"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <input
            ref={inputRef}
            type="text"
            className="input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your roster…"
            aria-label="Ask the assistant"
          />
          <button type="submit" className="btn btn-primary small" disabled={busy || !input.trim()}>
            {busy ? "…" : "Ask"}
          </button>
        </form>
      </section>

      <button
        ref={launcherRef}
        type="button"
        className="ai-launcher"
        aria-expanded={open}
        aria-controls="ai-panel"
        aria-label={open ? "Close the AI assistant" : "Ask the AI assistant"}
        title={open ? "Close the AI assistant" : "Ask the AI assistant"}
        onClick={() => setOpen((prev) => !prev)}
      >
        {open ? <CloseGlyph /> : <BalloonGlyph />}
      </button>
    </div>
  );
}
