import type { ToastType } from "../shell/useToasts";

interface Props {
  toasts: Array<{ id: string; text: string; type: ToastType }>;
}

/** The live region App.tsx rendered inline. Markup unchanged. */
export function Toasts({ toasts }: Props) {
  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.type}`} role="status">
          {t.text}
        </div>
      ))}
    </div>
  );
}
