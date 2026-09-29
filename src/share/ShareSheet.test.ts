import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ShareSheet } from "./ShareSheet";
import { teamsAsText } from "./share-text";
import { freshSplit } from "../session/edit";
import { FUTSAL_DISCIPLINE } from "../domain/seed";
import type { Player, SplitResult } from "../domain/types";

const ROLES = ["goalkeeper", "defender", "winger", "pivot"];

/**
 * `Ben & Jerry` is not a decoration: React escapes `&` to `&amp;` when it
 * serialises a `value`, so a sheet that mangled or double-encoded the text
 * would look identical here without a name that has something to escape.
 */
const ROSTER: Player[] = [
  "Andi", "Budi", "Citra", "Dewi", "Eka", "Ben & Jerry", "Gita", "Hana", "Irfan", "Joko",
].map((name, i) => ({
  id: `p${i + 1}`,
  communityId: "c1",
  name,
  capabilities: [
    {
      disciplineId: FUTSAL_DISCIPLINE.id,
      attributeRatings: { technical: 5 - (i % 4), fitness: 4 - (i % 3), "game-iq": 3 + (i % 3) },
      eligibleRoles: ROLES,
      preferredRole: null,
    },
  ],
}));

const RESULT: SplitResult = freshSplit(ROSTER.map((p) => p.id), ROSTER, FUTSAL_DISCIPLINE, { teamCount: 2 });

const sheet = () =>
  renderToStaticMarkup(
    createElement(ShareSheet, {
      communityName: "Thursday Crew",
      discipline: FUTSAL_DISCIPLINE,
      result: RESULT,
      roster: ROSTER,
      onClose: () => {},
    }),
  );

/** The five entities React emits for a `value`, undone — the box shows the raw string. */
const unescape = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&");

/** What the organizer actually sees in the box, decoded out of the markup. */
const previewOf = (html: string) => unescape(html.match(/<textarea[^>]*>([\s\S]*?)<\/textarea>/)?.[1] ?? "");

describe("the share sheet", () => {
  it("previews exactly the string `teamsAsText` produces, and no second rendering of it", () => {
    // The one assertion that matters here. The preview is what the organizer
    // reads before sending and what the clipboard then carries, so if the sheet
    // re-derived the wording beside the module that owns it, the two would be
    // free to drift — and the drift would only surface after the message was
    // sent. Fails if the sheet builds its own headline, drops the closing line,
    // re-sorts the players, or hardcodes the team count.
    expect(previewOf(sheet())).toBe(
      teamsAsText({
        communityName: "Thursday Crew",
        disciplineName: FUTSAL_DISCIPLINE.name,
        discipline: FUTSAL_DISCIPLINE,
        result: RESULT,
        roster: ROSTER,
      }),
    );
  });

  it("previews a read-only box, so the text cannot be edited into something the app never computed", () => {
    // Fails if `readOnly` is dropped: the organizer could retype a gap or a
    // name, and the sheet would then copy an arrangement the solver never saw
    // under the app's own verdict.
    expect(sheet()).toContain("<textarea class=\"share-preview\" readOnly=\"\"");
  });

  it("offers one copy control and says nothing about the copy before it happens", () => {
    // Fails if the status region is seeded with a claim ("Copied.", "Ready.")
    // rather than waiting on the click, or if the button loses its testid and
    // the e2e can no longer reach the control it is asserting on.
    const html = sheet();
    expect(html).toContain('data-testid="share-copy-text"');
    expect(html).toContain("Copy text");
    expect(html).toMatch(/<p class="share-status" role="status"><\/p>/);
  });

  it("gives the sheet a named close control, so it is dismissible from the keyboard", () => {
    // Narrower than it looks: `Modal` owns the overlay's click-to-dismiss and
    // the card's stopPropagation, and neither handler survives static rendering,
    // so this cannot claim to test them — the e2e dismisses through the
    // overlay. What SSR can see is that a focusable, named close control exists
    // at all. Fails if it is dropped or left unlabelled, which would leave a
    // keyboard user inside the sheet with no way out.
    expect(sheet()).toMatch(/<button type="button" class="modal-close" aria-label="Close">/);
  });
});
