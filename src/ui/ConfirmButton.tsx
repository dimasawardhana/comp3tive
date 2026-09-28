import { useState } from "react";

interface Props {
  /** Idle-state label. */
  label: string;
  /** Confirm-state label. */
  confirmLabel: string;
  /** The warning copy, rendered beside the confirm controls. */
  message?: string;
  onConfirm: () => void;
  /** Idle button class. Defaults to "btn btn-ghost". */
  className?: string;
  /**
   * Optional accessible name for the idle button. Required when `label` is a bare
   * verb in a list of repeated rows, so the name stays unique and unchanged.
   * The confirm-state button needs none: it is unique while it is rendered.
   */
  ariaLabel?: string;
}

/**
 * The two-step destructive confirm the tournament delete already uses: a boolean
 * swaps the button for Cancel + a danger confirm, in place, with no modal and no
 * focus move. Returns a fragment so each site drops it into the row it has.
 *
 * The one thing a native `window.confirm` did that this cannot is stop the rest
 * of the page: nothing here blocks, and the message is ordinary text in the DOM,
 * so a test — or a screen reader — can read it.
 */
export function ConfirmButton({ label, confirmLabel, message, onConfirm, className = "btn btn-ghost", ariaLabel }: Props) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button type="button" className={className} aria-label={ariaLabel} onClick={() => setConfirming(true)}>
        {label}
      </button>
    );
  }
  return (
    <>
      {message && <span className="status-msg">{message}</span>}
      <button type="button" className="btn btn-ghost" onClick={() => setConfirming(false)}>
        Cancel
      </button>
      <button
        type="button"
        className="btn btn-danger-ghost"
        onClick={() => {
          setConfirming(false);
          onConfirm();
        }}
      >
        {confirmLabel}
      </button>
    </>
  );
}
