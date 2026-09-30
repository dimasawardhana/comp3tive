import { useCallback, useState } from "react";

export type ToastType = "success" | "error" | "info";

export interface Toast {
  id: string;
  text: string;
  type: ToastType;
}

/**
 * Toast state + a stable `notify`. Behaviour is unchanged from App's inline
 * version: a crypto.randomUUID() id, appended, removed after 3000 ms. useCallback
 * makes notify a stable dependency for the import and flow handlers.
 *
 * THIS IS PER-CALLER STATE, NOT A CONTEXT. Call it ONCE, in `src/App.tsx`, and
 * thread `notify` down as a prop. A second call anywhere else — a modal, a
 * screen, a share sheet — would create a second list that nothing renders, and
 * its messages would be invisible. There is no `ToastProvider` in this phase and
 * none is planned: the app has no React context anywhere (`grep -rn "createContext"
 * src/` → no matches), and adding one to carry two functions is not this phase's
 * job. Phase D calls `props.notify`, not `useToasts()`.
 */
export function useToasts(): { toasts: Toast[]; notify: (text: string, type?: ToastType) => void } {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const notify = useCallback((text: string, type: ToastType = "info") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);
  return { toasts, notify };
}
