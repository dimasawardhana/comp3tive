import type { ReactNode } from "react";

/**
 * The app's icons, drawn here rather than imported. Sixteen-pixel outline
 * shapes on a 24-unit grid at 1.5 stroke, so every one of them shares a weight
 * with the two faces and none of them arrives from a library that would give
 * the app someone else's look. (Moved verbatim from `AppChrome.tsx`, which had
 * been the only drawer; Roster's toolbar and Settings' chips now share it, and
 * a second private map beside theirs would have been two house styles.)
 *
 * Every glyph answers "what does pressing this do", never "this is magic":
 * no sparkles, no lightning, no stars (the delivery gate's R-04).
 */
export type IconName =
  | "home"
  | "roster"
  | "games"
  | "history"
  | "squads"
  | "settings"
  | "plus"
  | "menu"
  | "close"
  | "check"
  | "caret"
  | "panel"
  | "import"
  | "download"
  | "table"
  | "sun"
  | "moon"
  | "half"
  | "monitor"
  | "phone"
  | "devices";

const ICONS: Record<IconName, ReactNode> = {
  home: (
    <>
      <path d="M4 10.4 12 4l8 6.4" />
      <path d="M6.2 9.6V19a1 1 0 0 0 1 1h9.6a1 1 0 0 0 1-1V9.6" />
      <path d="M9.8 20v-5.2h4.4V20" />
    </>
  ),
  roster: (
    <>
      <circle cx="9.2" cy="8.4" r="2.7" />
      <path d="M4 19.4a5.2 5.2 0 0 1 10.4 0" />
      <path d="M15.8 6.1a2.6 2.6 0 0 1 0 4.9" />
      <path d="M16.6 14.4a4.6 4.6 0 0 1 3.4 4.4" />
    </>
  ),
  games: (
    <>
      <path d="M8.2 4h7.6v4.4a3.8 3.8 0 0 1-7.6 0Z" />
      <path d="M8.2 5.4H5.4v1.4a3.2 3.2 0 0 0 3.1 3.2" />
      <path d="M15.8 5.4h2.8v1.4a3.2 3.2 0 0 1-3.1 3.2" />
      <path d="M12 12.2v3.6" />
      <path d="M8.6 19.6h6.8" />
    </>
  ),
  history: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.4V12l3.1 1.9" />
    </>
  ),
  squads: (
    <>
      <path d="M12 4 20 8.4 12 12.8 4 8.4Z" />
      <path d="M4 12.2 12 16.6 20 12.2" />
      <path d="M4 16 12 20.4 20 16" />
    </>
  ),
  settings: (
    <>
      <path d="M3.8 8.4h7.4" />
      <path d="M15.6 8.4h4.6" />
      <circle cx="13.4" cy="8.4" r="2.2" />
      <path d="M3.8 15.6h4.6" />
      <path d="M12.8 15.6h7.4" />
      <circle cx="10.6" cy="15.6" r="2.2" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5.2v13.6" />
      <path d="M5.2 12h13.6" />
    </>
  ),
  menu: (
    <>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </>
  ),
  close: (
    <>
      <path d="M6.4 6.4 17.6 17.6" />
      <path d="M17.6 6.4 6.4 17.6" />
    </>
  ),
  check: <path d="M5.2 12.4 10 17.2 18.8 7.2" />,
  caret: <path d="M7.6 10.2 12 14.6l4.4-4.4" />,
  panel: (
    <>
      <rect x="3.6" y="4.6" width="16.8" height="14.8" rx="2" />
      <path d="M9.4 4.6v14.8" />
    </>
  ),
  /* Import: a tray with an arrow dropping into it — the shape reads "into
     here", which is what importing a file does. */
  import: (
    <>
      <path d="M12 4.6v9.2" />
      <path d="M8.4 10.4 12 13.8l3.6-3.4" />
      <path d="M5 14.6v3.2a1.4 1.4 0 0 0 1.4 1.4h11.2a1.4 1.4 0 0 0 1.4-1.4v-3.2" />
    </>
  ),
  /* Download: an arrow landing on a baseline, no tray. It used to be a
     byte-for-byte copy of `import` — the comment claimed a "tray mirror" while
     the paths were identical, so the roster's import and template buttons
     rendered the same glyph and neither told the user anything. A tray means
     "into the app"; a baseline means "onto your disk". One verb, one shape. */
  download: (
    <>
      <path d="M12 4.4v10.2" />
      <path d="M8.2 11 12 14.8 15.8 11" />
      <path d="M5.6 19.4h12.8" />
    </>
  ),
  /* Table: a spreadsheet grid — two rows and a column divider. The CSV
     template is a spreadsheet before it is a download, and this shape says so
     at 16px where a file-with-arrow could mean any file at all. */
  table: (
    <>
      <rect x="3.8" y="5" width="16.4" height="14" rx="1.8" />
      <path d="M3.8 9.8h16.4" />
      <path d="M3.8 14.4h16.4" />
      <path d="M10.2 9.8V19" />
    </>
  ),
  /* Light: the sun, eight rays at 45 degrees. */
  sun: (
    <>
      <circle cx="12" cy="12" r="3.6" />
      <path d="M12 3.4v2.2M12 18.4v2.2M3.4 12h2.2M18.4 12h2.2M5.9 5.9l1.6 1.6M16.5 16.5l1.6 1.6M18.1 5.9l-1.6 1.6M7.5 16.5l-1.6 1.6" />
    </>
  ),
  /* Dark: the crescent, one arc minus another. */
  moon: <path d="M19.2 14.2A7.6 7.6 0 0 1 9.8 4.8a7.6 7.6 0 1 0 9.4 9.4Z" />,
  /* Auto theme: half light, half dark — the circle split down the middle,
     one side filled. Reads as "between the two". */
  half: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" stroke="none" />
    </>
  ),
  /* Desktop: the monitor with its stand. */
  monitor: (
    <>
      <rect x="3.6" y="4.6" width="16.8" height="11" rx="1.5" />
      <path d="M12 15.6v3" />
      <path d="M8.4 19.4h7.2" />
    </>
  ),
  /* Phone: the handset outline with its speaker line. */
  phone: (
    <>
      <rect x="7.4" y="3.6" width="9.2" height="16.8" rx="1.8" />
      <path d="M10.8 17.4h2.4" />
    </>
  ),
  /* Auto layout: monitor and phone together, the small one in front of the
     big one — the choice the setting makes on its own. */
  devices: (
    <>
      <path d="M3.6 5.2A1.6 1.6 0 0 1 5.2 3.6h11.6a1.6 1.6 0 0 1 1.6 1.6v6.4" />
      <path d="M3.6 5.2v7.4a1.6 1.6 0 0 0 1.6 1.6h6.2" />
      <path d="M8.2 18.2h3.4" />
      <rect x="13.6" y="11.2" width="6.8" height="9.2" rx="1.4" />
      <path d="M16.2 18.2h1.6" />
    </>
  ),
};

export function Icon({ name, size }: { name: IconName; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICONS[name]}
    </svg>
  );
}
