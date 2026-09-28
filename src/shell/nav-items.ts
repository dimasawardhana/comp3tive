import type { HubMode } from "./useNavigation";

/** The five hub destinations. Rendered twice: rail (desktop) and bottom nav (handheld).
 *  Labels are the accessible names the e2e `hubButton` helper matches on. */
export const NAV_ITEMS = [
  { mode: "dashboard", label: "Home", icon: "⌂" },
  { mode: "roster", label: "Roster", icon: "◉" },
  { mode: "games", label: "Games", icon: "▣" },
  { mode: "history", label: "History", icon: "≡" },
  { mode: "squads", label: "Squads", icon: "◇" },
] as const satisfies ReadonlyArray<{ mode: HubMode; label: string; icon: string }>;
