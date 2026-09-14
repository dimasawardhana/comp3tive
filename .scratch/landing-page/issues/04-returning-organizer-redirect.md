# 04: Send returning organizers straight into the app

**What to build:** An organizer who already uses comp3tive should not be shown the Landing Page every time they open their bookmark. Detect their existing data and forward them into `/app` before the first paint, with an escape hatch.

Add to `<head>` of `index.html`, before any stylesheet so it runs before paint:

```html
<script>
  // Returning organizer: this key is written by the app's own community hook.
  // `?stay` keeps the Landing Page reachable after the app has been used.
  try {
    if (localStorage.getItem("tb-community") && !location.search.includes("stay")) {
      location.replace("/app/");
    }
  } catch (e) {
    /* storage blocked — show the page */
  }
</script>
```

Why this key: the app writes `localStorage["tb-community"]` on its first successful refresh (`src/domain/useCommunities.ts`, `writeActive`), and `localStorage` is origin-scoped — so it is readable from `/` and already means "this browser has run the app". No IndexedDB probe is needed, and the check is synchronous, which is what makes it safe to run pre-paint (no flash of the Landing Page).

`location.replace` rather than `location.href` so the Landing Page is not left in the history: pressing Back from the app should leave the site, not bounce off a redirect loop.

**Blocked by:** 03

**Status:** open

- [ ] With `tb-community` present, loading `/` lands in the app with no visible flash of the Landing Page
- [ ] With no `tb-community`, `/` shows the Landing Page
- [ ] `/?stay` shows the Landing Page **even when** `tb-community` is present
- [ ] Pressing Back after the redirect does not return to `/` and re-redirect (no loop)
- [ ] A browser with storage blocked (or throwing on `localStorage` access) shows the Landing Page rather than erroring
- [ ] A Playwright spec covers the three cases: pre-seeded redirect, fresh visit, and `?stay`
- [ ] The script is inline and tiny — the page still works with JavaScript disabled (it just shows the Landing Page)

**Design reference:** none.

**Notes:** Redirecting only the bare `/` is enough: the Landing Page is only ever served at the root, so `/app`, `/hero/*` and any future `/api/*` are untouched by this check.
