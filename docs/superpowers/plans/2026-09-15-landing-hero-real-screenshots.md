# Landing Page Hero: Real Component Screenshots

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder hero images on the landing page with real screenshots captured from the actual comp3tive app's split screen.

**Architecture:** The `scripts/capture-hero.mjs` script already captures real screenshots of the app's split result using Playwright. It seeds IndexedDB with fictional MLBB data, navigates to the app, runs a split, and captures the split screen and full page as PNGs. The landing page at `index.html` references `/hero/split-mobile.png` and `/hero/split-desktop.png`.

**Tech Stack:** Playwright, Chromium, Vite dev server (`localhost:4173`), Node.js scripts

**Spec:** `scripts/capture-hero.mjs`, `e2e/tests/landing/landing.spec.ts`, `index.html`, `DESIGN.md` (the "signature moment" section)

## Global Constraints

- The app runs on `http://localhost:4173/app/` during capture
- The capture script outputs `hero-split-{mobile,desktop}.png` and `hero-full-{mobile,desktop}.png` to `public/hero/`
- The landing page references `split-mobile.png` and `split-desktop.png` (not `hero-split-*`)
- The e2e test checks `width="890"` and `height="625"` on the hero `<img>`
- The e2e test verifies the image swaps at mobile breakpoint (390px → mobile, ≥1280px → desktop)
- Bib colors must be present in captured images (MIN_BIB_PIXELS >= 5000 each)

## Files

- **Modify:** `index.html` — update hero `<img>` src and dimensions if changed
- **Replace:** `public/hero/split-desktop.png` and `public/hero/split-mobile.png` — captured screenshots
- **No new files needed** — the capture script already exists

---

### Task 1: Verify the capture script produces correct filenames

**Files:**
- Read: `scripts/capture-hero.mjs`
- Read: `public/hero/`

**Interfaces:**
- Consumes: The app at `http://localhost:4173/app/`
- Produces: `public/hero/hero-split-mobile.png`, `public/hero/hero-split-desktop.png`, `public/hero/hero-full-mobile.png`, `public/hero/hero-full-desktop.png`

- [ ] **Step 1: Check current output filenames in capture-hero.mjs**

Read `scripts/capture-hero.mjs` around lines 277-278 to confirm the output filenames (`hero-split-${vp.label}.png` and `hero-full-${vp.label}.png`).

- [ ] **Step 2: Check current hero image filenames in public/hero/**

Compare the current filenames (`split-mobile.png`, `split-desktop.png`) with the capture script output filenames (`hero-split-*`, `hero-full-*`).

- [ ] **Step 3: Determine the rename/copy strategy**

The landing page references `split-mobile.png` and `split-desktop.png`. The capture script outputs `hero-split-{label}.png`. Either:
  - Option A: Update `index.html` to reference `hero-split-{label}.png`
  - Option B: Rename/copy the captured files to `split-{label}.png`

Choose the approach that requires fewer changes and aligns with the existing e2e test expectations.

- [ ] **Step 4: Commit the analysis**

```bash
git add -A && git commit -m "chore: analyze capture-hero output filenames"
```

---

### Task 2: Capture real screenshots of the split screen

**Files:**
- Run: `scripts/capture-hero.mjs`
- Output: `public/hero/`

**Interfaces:**
- Consumes: `vite` dev server at `localhost:4173`, `playwright` test runner
- Produces: Real PNG screenshots in `public/hero/`

- [ ] **Step 1: Start the Vite dev server**

```bash
npm run dev
```

Expected: Server running at `http://localhost:4173`

- [ ] **Step 2: Run the capture script**

```bash
npm run capture:hero
```

Expected: `hero-split-mobile.png`, `hero-split-desktop.png`, `hero-full-mobile.png`, `hero-full-desktop.png` written to `public/hero/`

- [ ] **Step 3: Verify the captured images have bib colors**

```bash
node scripts/analyze-png.mjs public/hero/hero-split-desktop.png
node scripts/analyze-png.mjs public/hero/hero-split-mobile.png
```

Expected: Bib-a and bib-b pixel counts >= 5000 each

- [ ] **Step 4: If capture fails, debug and retry**

Common issues: app not running, IndexedDB seeding fails, split button not found. Check the script output for errors.

- [ ] **Step 5: Commit the captured images**

```bash
git add public/hero/
git commit -m "feat: add real hero screenshots from split screen"
```

---

### Task 3: Update the landing page to use captured screenshots

**Files:**
- Modify: `index.html`
- Modify: `src/landing.css` (if dimensions changed)

**Interfaces:**
- Consumes: Captured PNGs in `public/hero/`
- Produces: Landing page with real screenshots

- [ ] **Step 1: Determine the correct image dimensions**

```bash
node -e "const fs=require('fs'); const b=fs.readFileSync('public/hero/hero-split-desktop.png'); console.log(b.length)"
```

Or use `sips`/`identify` to get dimensions:
```bash
sips -g pixelWidth -g pixelHeight public/hero/hero-split-desktop.png
sips -g pixelWidth -g pixelHeight public/hero/hero-split-mobile.png
```

- [ ] **Step 2: Update index.html with correct image paths and dimensions**

Replace the `<picture class="landing-hero">` section in `index.html` to reference the captured images. Update `width` and `height` attributes to match the actual dimensions.

If the filenames changed (e.g., `hero-split-*` instead of `split-*`), update the `<source>` and `<img>` `srcset`/`src` accordingly.

- [ ] **Step 3: Update src/landing.css if needed**

If the image aspect ratio changed, update `.landing-hero img` CSS in `src/landing.css` to maintain proper sizing.

- [ ] **Step 4: Run the e2e test to verify**

```bash
npx playwright test e2e/tests/landing/landing.spec.ts
```

Expected: All landing page tests pass, especially "the hero swaps image at the mobile breakpoint without layout shift"

- [ ] **Step 5: Commit the landing page changes**

```bash
git add index.html src/landing.css public/hero/
git commit -m "feat: use real split screen screenshots for landing page hero"
```

---

### Task 4: Verify the full landing page renders correctly

**Files:**
- Read: `index.html`
- Read: `src/landing.css`

**Interfaces:**
- Consumes: Updated hero images
- Produces: Verified landing page

- [ ] **Step 1: Build the site and verify the images are included**

```bash
npm run build
```

Expected: Build succeeds, hero images are in `dist/hero/`

- [ ] **Step 2: Preview the built site**

```bash
npm run preview
```

Expected: Landing page at `http://localhost:4173` shows the real split screenshot

- [ ] **Step 3: Run the full e2e suite for landing tests**

```bash
npx playwright test e2e/tests/landing/landing.spec.ts
```

Expected: All 6 landing page tests pass

- [ ] **Step 4: Commit any final fixes**

```bash
git add -A && git commit -m "fix: landing page hero image adjustments"
```
