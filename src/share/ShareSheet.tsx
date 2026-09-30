import { useRef, useState } from "react";
import type { Discipline, Player, SplitResult } from "../domain/types";
import { Modal } from "../ui/Modal";
import { teamsAsText } from "./share-text";
import { renderShareImage } from "./share-image";

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
 * One sentence for every way the image fails to reach the organizer — a canvas
 * that will not draw, a clipboard that will not take it, a file that will not
 * be written — and the same recovery `COPY_FAILED` gives, because the recovery
 * *is* the same: the text is still on screen, and it is the only thing left
 * that can be sent.
 *
 * The organizer cannot tell those three apart, so neither can the sheet: what
 * they share is that no image arrived. Naming the cause instead ("couldn't
 * draw") would be a claim about a cause they cannot act on, and it would be
 * wrong for the two failures that are not the canvas.
 */
const IMAGE_FAILED = "Image failed. Select the text above and copy it.";

/**
 * The filename the fallback saves under, stamped UTC so it cannot depend on the
 * machine's timezone: `src/data/sample-data.ts`'s download takes its name from
 * the data it loaded, and there is no data record here to name it.
 */
const posterName = (): string => `comp3tive-teams-${new Date().toISOString().slice(0, 10)}.png`;

/**
 * The share surface: the finished teams, as text for a chat and as a poster
 * for anywhere a picture is what lands.
 *
 * Two ways out of one sheet, because the two are not substitutes. The text is
 * searchable, quotable and pasteable into a group chat; the poster is the same
 * split drawn, for a channel where a wall of names reads as noise. Both are
 * built from the one `result` and the one `roster` in scope, so neither can
 * describe a split the other does not.
 *
 * The preview is not a second rendering of the split. It is the string
 * `teamsAsText` returns, character for character, because that string is what
 * leaves the app — into a group chat, quoted back at the people who made it.
 * A sheet that re-derived the text beside the module that owns it would be free
 * to disagree with it, and the disagreement would only ever surface after the
 * message was sent. The poster takes the same module's `closingLine` for the
 * same reason, from the same `result`.
 *
 * `discipline` carries its own name, so the sheet never takes `disciplineName`
 * beside it: two props for one value is one of them silently wrong. Both
 * renderings are handed `discipline.name` — the poster's input wants a
 * `disciplineName`, and it is the one value, not two.
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

  /**
   * Feature-detected, not assumed: a browser may have `ClipboardItem` and still
   * refuse `image/png`, in which case the download is the honest action.
 *
   * This picks the *label* and nothing else. It is a heuristic, and a wrong
   * `true` costs the organizer one status line — the copy is attempted, fails,
   * and the blob that was just drawn is written to a file instead. The
   * guarantee is `downloadImage`, which needs no capability at all.
   */
  const canCopyImage = typeof ClipboardItem !== "undefined" && ClipboardItem.supports?.("image/png") === true;

  /**
   * The shared recovery, beside `selectAll` rather than inside the handler, so
   * the image path cannot grow a second spelling of what the text path already
   * says.
   */
  const imageFailed = () => {
    setStatus(IMAGE_FAILED);
    selectAll();
  };

  /**
   * A blob the click already drew, handed to the browser as a file, and the
   * one path that needs no capability at all — which is why the copy path
   * falls back to it and why it has to be the one that cannot fail outward.
   *
   * It is total: every browser call in it can refuse — `createObjectURL` on a
   * revoked or sandboxed document, `appendChild`, the synthetic click — and
   * this function is called from inside `shareImage`'s `catch`, so a throw
   * from here would escape the very handler meant to contain the failure and
   * leave the button doing nothing visible. It answers with a boolean instead
   * and revokes in a `finally`, so a refusal at any step still gives the URL
   * back rather than stranding the blob for the life of the document.
   */
  const downloadImage = (blob: Blob, saved: string): boolean => {
    let url: string | null = null;
    try {
      url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = posterName();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setStatus(saved);
      return true;
    } catch {
      return false;
    } finally {
      // Structural, not positional: the next task cannot move the revoke above
      // the click and leak. Deferred by a task because the download reads the
      // URL as the click is dispatched, not after `click()` returns — the same
      // shape `src/App.tsx` uses for its own anchor download.
      const created = url;
      if (created) setTimeout(() => URL.revokeObjectURL(created), 0);
    }
  };

  const shareImage = async () => {
    let blob: Blob;
    try {
      // Drawn once for both paths. A poster the clipboard refused is the same
      // poster, not a second draw that can fail where the first one did not —
      // and `layoutShareImage` is cheap but `fillText` over 1080 px of type is
      // not free.
      blob = await renderShareImage({ disciplineName: discipline.name, discipline, result, roster });
    } catch {
      // The documented failure is a canvas that will not hand out a 2D
      // context, and then there is no blob to download and no file to save.
      // Saying so is the whole behaviour: without this the button is a control
      // that silently does nothing, which is what the sheet's copy path refuses
      // to be.
      imageFailed();
      return;
    }
    if (!canCopyImage) {
      if (!downloadImage(blob, "Downloaded the image.")) imageFailed();
      return;
    }
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setStatus("Copied.");
    } catch {
      // A refused write never costs the user the text the sheet already holds,
      // and the poster is already made — so the file is one click from going
      // out, and the sentence says which of the two things happened. If even
      // that is refused, `imageFailed` owns the outcome, so no path out of this
      // handler can end with a button that did nothing and said nothing.
      if (!downloadImage(blob, "Couldn't copy the image. Downloaded it instead.")) imageFailed();
    }
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
        <button
          type="button"
          className="btn btn-ghost"
          data-testid="share-image"
          onClick={() => void shareImage()}
        >
          {canCopyImage ? "Copy image" : "Download image"}
        </button>
      </div>
    </Modal>
  );
}
