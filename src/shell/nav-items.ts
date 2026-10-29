import type { HubMode, View } from "./useNavigation";

/**
 * Every icon the shell draws, by name. The shapes and the one component that
 * draws them live in `src/ui/Icon.tsx`, shared with the screens' own icon
 * buttons; this file holds only the identity, so the nav table stays data.
 */
export type { IconName } from "../ui/Icon";
import type { IconName } from "../ui/Icon";

/** A destination that holds a slot in the navigation. Settings is a real
 *  destination but a utility, so it is not one of the five. */
export type NavMode = Exclude<HubMode, "settings">;

interface NavItem {
  mode: NavMode;
  label: string;
  icon: IconName;
}

/**
 * The five hub destinations. Rendered three times from this one list: the
 * sidebar, the phone sheet and the bottom bar.
 *
 * Five, not six: a bottom bar of six breaks the five-destination limit, and
 * Settings is not a place you go mid-game. It sits in the sidebar footer and in
 * the sheet instead (see `SETTINGS_ITEM`).
 *
 * Labels are the accessible names the e2e `hubButton` helper matches on.
 */
export const NAV_ITEMS = [
  { mode: "dashboard", label: "Home", icon: "home" },
  { mode: "roster", label: "Roster", icon: "roster" },
  { mode: "games", label: "Games", icon: "games" },
  { mode: "history", label: "History", icon: "history" },
  { mode: "squads", label: "Squads", icon: "squads" },
] as const satisfies readonly NavItem[];

/**
 * The utility destination. It is the same kind of control as a nav row and
 * goes through the same handler (`onGotoHub`); what differs is where it sits,
 * so it is kept out of the list the bottom bar maps over.
 */
export const SETTINGS_ITEM = {
  mode: "settings",
  label: "Settings",
  icon: "settings",
} as const satisfies { mode: HubMode; label: string; icon: IconName };

const HUB_TITLES: Record<HubMode, string> = {
  dashboard: "Dashboard",
  roster: "Roster",
  games: "Games",
  history: "History",
  squads: "Saved squads",
  settings: "Settings",
};

/**
 * The name the phone's top bar shows for whatever is on screen. Hub modes read
 * as the screen's own `h1` ("Dashboard", "Saved squads") rather than the nav
 * label, because the bar answers "where am I", and the tab bar underneath
 * already answers "where can I go". The views below a hub name themselves.
 */
export function screenTitle(view: View): string {
  switch (view.mode) {
    case "split":
      return "Split";
    case "match":
      return "Set the match";
    case "tournament":
      return "Tournament";
    case "disciplines":
      return "Disciplines";
    default:
      return HUB_TITLES[view.mode];
  }
}
