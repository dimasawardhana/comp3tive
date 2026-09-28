import type { ReactNode } from "react";

interface Props {
  /** Dismiss the modal. Fired by the overlay and by the close button. */
  onClose: () => void;
  children: ReactNode;
}

/**
 * The overlay + card skeleton five modals hand-rolled identically. It owns the
 * wrapper and the two handlers only: each call site keeps its own close button,
 * title and content, because they differ (TournamentScreen renders an inline-styled
 * <h1> rather than .modal-title; SplitScreen titles itself "Save squad").
 */
export function Modal({ onClose, children }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
