import { useRef, useState } from "react";
import type { Discipline, Player, SplitResult } from "../domain/types";
import { Modal } from "../ui/Modal";
import { teamsAsText } from "./share-text";

interface Props {
  /** Names the community in the headline; who these teams are for. */
  communityName: string;
  /** Supplies both the headline name and the per-player strength. */
  discipline: Discipline;
  result: SplitResult;
  roster: Player[];
  onClose: () => void;
}

/** One sentence for both ways copying can fail, so the two cannot drift. */
const COPY_FAILED = "Copy failed. Select the text above and copy it.";

/**
 * The share surface: the finished teams as one block of text, onto the
 * clipboard.
 *
 * The preview is not a second rendering of the split. It is the string
 * `teamsAsText` returns, character for character, because that string is what
 * leaves the app — into a group chat, quoted back at the people who made it.
 * A sheet that re-derived the text beside the module that owns it would be free
 * to disagree with it, and the disagreement would only ever surface after the
 * message was sent.
 *
 * `discipline` carries its own name, so the sheet never takes `disciplineName`
 * beside it: two props for one value is one of them silently wrong.
 */
export function ShareSheet({ communityName, discipline, result, roster, onClose }: Props) {
  const text = teamsAsText({ communityName, disciplineName: discipline.name, discipline, result, roster });
  const [status, setStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const previewRef = useRef<HTMLTextAreaElement>(null);

  /**
   * The fallback path: the text is never lost, and it is left selected so a
   * manual copy is one keystroke rather than a re-selection by hand.
   */
  const selectAll = () => {
    const el = previewRef.current;
    if (!el) return;
    el.focus();
    el.select();
  };

  const copyText = async () => {
    // No alert: an alert would cover the very text the organizer needs.
    if (!navigator.clipboard?.writeText) {
      setStatus(COPY_FAILED);
      selectAll();
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setStatus("Copied.");
    } catch {
      setStatus(COPY_FAILED);
      selectAll();
    }
  };

  return (
    <Modal onClose={onClose}>
      <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
        &times;
      </button>
      <h1 className="modal-title">Share the teams</h1>
      <div className="modal-section">
        <textarea
          className="share-preview"
          readOnly
          value={text}
          ref={previewRef}
          rows={14}
          aria-label="Team list"
        />
      </div>
      <p className="share-status" role="status">
        {status}
      </p>
      <div className="bar">
        <button
          type="button"
          className="btn btn-primary"
          data-testid="share-copy-text"
          onClick={() => void copyText()}
        >
          {copied ? "Copied" : "Copy text"}
        </button>
      </div>
    </Modal>
  );
}
