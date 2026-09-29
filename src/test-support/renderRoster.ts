import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RosterScreen, type RosterScreenProps } from "../shell/RosterScreen";
import type { Community } from "../domain/types";

/**
 * The one way a node test renders `RosterScreen`.
 *
 * `renderToStaticMarkup` runs no effects, which is why the roster's screen is
 * worth rendering at all in node: every value it shows arrives as a prop, so a
 * test can put a community on it, a catalog under it, and read the HTML that a
 * browser would receive. The two tests that render it — the storage note's and
 * the CSV hint's — share this because `RosterScreenProps` has twenty-six
 * required members, and a second hand-written copy of that literal is a
 * twenty-six-line file that silently stops matching the interface: the copy
 * would still typecheck (it is `Partial`-free but the excess-property check only
 * bites on object literals) and would quietly pass props the screen no longer
 * reads.
 *
 * **It lives here, outside both `.test.ts` files, for the reason
 * `safetyCopy.ts` sets out at length:** importing a `.test.ts` from another
 * `.test.ts` executes the donor file's `describe` and `it` calls inside the
 * importer's module graph, so vitest collects the donor's cases a second time
 * and the suite doubles. The vitest include glob matches only `*.test.ts` under
 * `src`, so this module is never collected as a test.
 */

/** The community both screen tests hang their copy on. */
export const ROSTER_COMMUNITY: Community = { id: "c1", name: "Thursday Crew", createdAt: 0 };

/** Inert for every prop a test is not asking about. */
const NOOP_PROPS: Omit<RosterScreenProps, "activeCommunity"> = {
  disciplines: [],
  players: [],
  visiblePlayers: [],
  filterIds: [],
  disciplinesById: new Map(),
  editingPlayer: null,
  fileInputRef: { current: null },
  onToggleFilter: () => {},
  onClearFilters: () => {},
  onAddPlayer: () => {},
  onOpenPlayer: () => {},
  pendingMerge: null,
  lastReport: null,
  onConfirmMerge: () => {},
  onCancelMerge: () => {},
  importFile: async () => {},
  onExport: () => {},
  onSplitMatch: () => {},
  onSavePlayer: async () => {},
  onDeletePlayer: async () => {},
  onCloseEditor: () => {},
  persisted: null,
  notify: () => {},
};

/** The roster's HTML, with only the props a test names. */
export function renderRoster(overrides: Partial<RosterScreenProps> = {}): string {
  return renderToStaticMarkup(
    createElement(RosterScreen, { activeCommunity: ROSTER_COMMUNITY, ...NOOP_PROPS, ...overrides }),
  );
}
