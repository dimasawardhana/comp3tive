import { useEffect, useState } from "react";

/** Persisted preference (theme, layout) with a localStorage fallback. */
export function useStoredPref(key: string, initial: string) {
  const [value, setValue] = useState<string>(() => {
    try {
      return localStorage.getItem(key) ?? initial;
    } catch {
      return initial;
    }
  });
  const set = (v: string) => {
    setValue(v);
    try {
      localStorage.setItem(key, v);
    } catch {
      /* ignore */
    }
  };
  return [value, set] as const;
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

/**
 * The two preferences that are also DOM attributes, plus the media query that
 * resolves `layout: "auto"`.
 *
 * **Why this is here and not in `App`.** These three lines are one behaviour —
 * *the document element carries the theme and layout, and `auto` means "no
 * attribute"* — and the effect that writes them is meaningless apart from the
 * prefs it reads. They were already two `useStoredPref` calls, a `useMediaQuery`
 * and a `useEffect` in `App`, four constructs for one idea.
 *
 * **`auto` deletes the attribute rather than writing `"auto"`.** That is the
 * whole contract: the stylesheets key off the attribute's *absence* for their
 * default, so writing the literal string would select a selector that does not
 * exist and silently drop the user back to the light theme. Preserved exactly.
 *
 * **`effectiveLayout` is the resolved answer, not the pref.** `App` renders
 * `data-layout={effectiveLayout}` on the app root, so the raw `"auto"` pref is
 * never a valid layout and must not leak out of here.
 */
export function useThemeAndLayout() {
  const [themePref, setThemePref] = useStoredPref("tb-theme", "auto");
  const [layoutPref, setLayoutPref] = useStoredPref("tb-layout", "auto");
  const isWide = useMediaQuery("(min-width: 1024px)");
  const effectiveLayout: "mobile" | "desktop" =
    layoutPref === "auto" ? (isWide ? "desktop" : "mobile") : (layoutPref as "mobile" | "desktop");

  useEffect(() => {
    const el = document.documentElement;
    if (themePref === "auto") {
      delete el.dataset.theme;
    } else {
      el.dataset.theme = themePref;
    }
    if (layoutPref === "auto") {
      delete el.dataset.layout;
    } else {
      el.dataset.layout = layoutPref;
    }
  }, [themePref, layoutPref]);

  return { themePref, setThemePref, layoutPref, setLayoutPref, effectiveLayout };
}
