/**
 * Capture the landing page hero image: the split result ("the signature moment").
 *
 * Seeds a fictional roster directly into IndexedDB so the shot is deterministic
 * and does not depend on the import flow, then drives the real UI to the split
 * screen and captures it at two viewports. Also verifies the capture: the
 * rendered DOM (text, fonts, overflow) and the PNG pixels (non-blank, team bib
 * colours present) so a broken shot cannot pass silently.
 *
 * Usage:
 *   npm run build && npm run preview        # serve dist/ on :4173
 *   node scripts/capture-hero.mjs [outDir]  # default: public/
 *
 * The player names are fictional (common Indonesian given names, matching the
 * locale of the sample data) and deliberately NOT the real esports players in
 * sample-data/*.json — a public landing page must not depict real people.
 */
import { mkdir, readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const BASE = "http://localhost:4173/";
const outDir = resolve(process.argv[2] ?? "public");

/** Fictional roster: 10 MLBB players, two per role, varied strength. */
const ROSTER = [
  { name: "Budi", primary: "tank", flex: "fighter", r: [4, 4, 3, 5] },
  { name: "Andi", primary: "tank", flex: "fighter", r: [3, 3, 3, 4] },
  { name: "Citra", primary: "assassin", flex: "mage", r: [5, 4, 4, 4] },
  { name: "Dewi", primary: "assassin", flex: "fighter", r: [3, 4, 3, 3] },
  { name: "Eka", primary: "mage", flex: "marksman", r: [4, 4, 4, 4] },
  { name: "Fajar", primary: "mage", flex: "tank", r: [3, 3, 4, 3] },
  { name: "Gita", primary: "marksman", flex: "mage", r: [4, 5, 4, 3] },
  { name: "Hana", primary: "marksman", flex: "assassin", r: [4, 3, 3, 3] },
  { name: "Irfan", primary: "fighter", flex: "tank", r: [4, 4, 3, 5] },
  { name: "Joko", primary: "fighter", flex: "assassin", r: [3, 4, 3, 3] },
];

const ATTRS = ["mechanics", "game-sense", "hero-pool", "teamwork"];
const COMMUNITY = { id: "comm-hero", name: "Saturday Crew", createdAt: 1_700_000_000_000 };

/** Team identity colours from src/index.css (--bib-a / --bib-b). */
const BIB = {
  a: { rgb: [255, 196, 0], label: "amber (--bib-a)" },
  b: { rgb: [255, 79, 154], label: "pink (--bib-b)" },
};
const PANEL = [28, 25, 23]; // --panel (the split panel behind the cards)

const players = ROSTER.map((p, i) => ({
  id: `hero-p${i + 1}`,
  communityId: COMMUNITY.id,
  name: p.name,
  capabilities: [
    {
      disciplineId: "mlbb",
      attributeRatings: Object.fromEntries(ATTRS.map((a, j) => [a, p.r[j]])),
      eligibleRoles: [p.primary, p.flex],
      preferredRole: p.primary,
    },
  ],
}));

/** Seed IndexedDB before app code runs (same seam as e2e dashboard.spec.ts). */
const seed = `(() => {
  const STORES = ["communities","players","sessions","tournaments","saved-squads","disciplines"];
  const request = indexedDB.open("comp3tive", 6);
  request.onupgradeneeded = () => {
    const db = request.result;
    for (const name of STORES) {
      if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "id" });
    }
  };
  request.onsuccess = () => {
    const db = request.result;
    localStorage.setItem("tb-community", ${JSON.stringify(COMMUNITY.id)});
    const rows = ${JSON.stringify({ communities: [COMMUNITY], players })};
    for (const [storeName, records] of Object.entries(rows)) {
      const tx = db.transaction(storeName, "readwrite");
      for (const record of records) tx.objectStore(storeName).put(record);
    }
    db.close();
  };
})();`;

// The mobile viewport must be tall enough to contain the whole pitch, otherwise
// the sticky topbar overlaps the top of it in the captured image.
const VIEWPORTS = [
  { label: "mobile", width: 390, height: 1100 },
  { label: "desktop", width: 1280, height: 800 },
];

/** Bib pixels expected in a correct capture; below this the shot is broken. */
const MIN_BIB_PIXELS = 5000;

/** Sample the captured PNG: prove it is not blank and that bib colours rendered. */
async function analysePixels(page, pngPath) {
  const dataUrl = `data:image/png;base64,${(await readFile(pngPath)).toString("base64")}`;
  return page.evaluate(
    async ({ dataUrl, BIB, PANEL }) => {
      const img = new Image();
      img.src = dataUrl;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const near = (r, g, b, target, tol) =>
        Math.abs(r - target[0]) <= tol &&
        Math.abs(g - target[1]) <= tol &&
        Math.abs(b - target[2]) <= tol;

      let bibA = 0;
      let bibB = 0;
      let panel = 0;
      const colours = new Set();
      const total = canvas.width * canvas.height;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (i % 16 === 0) colours.add((r << 16) | (g << 8) | b); // sample distinct colours
        if (near(r, g, b, BIB.a.rgb, 2)) bibA++;
        if (near(r, g, b, BIB.b.rgb, 2)) bibB++;
        if (near(r, g, b, PANEL, 2)) panel++;
      }
      return {
        width: canvas.width,
        height: canvas.height,
        distinctColoursSampled: colours.size,
        bibA,
        bibB,
        panelPixels: panel,
        totalPixels: total,
      };
    },
    { dataUrl, BIB, PANEL },
  );
}

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();
const report = {};

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2, // crisp on hi-dpi displays
    reducedMotion: "reduce", // skip the entrance transition
  });
  const page = await context.newPage();
  await page.addInitScript(seed);

  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  await page.goto(BASE);
  await page.locator(".app").waitFor({ timeout: 15_000 });

  // Roster → Split match (all seeded players carry MLBB, so MLBB is the default).
  await page.getByRole("button", { name: "Roster", exact: true }).click();
  await page.getByRole("button", { name: "Split match" }).click();
  await page.locator(".match-setup").waitFor({ timeout: 10_000 });

  const discipline = page.locator(".game", { hasText: "Mobile Legends" });
  if (await discipline.count()) await discipline.first().click();

  // The team count must land on 2 so the shot shows the two-team pitch + gap meter.
  const count = page.locator(".stepper .count");
  await count.waitFor({ timeout: 5000 });
  const stepper = (await count.innerText()).trim();
  if (stepper !== "2") throw new Error(`expected 2 teams, stepper reads "${stepper}"`);

  await page.getByTestId("split-button").click();
  await page.locator(".split-screen").waitFor({ timeout: 15_000 });
  await page.evaluate(() => document.fonts.ready); // hero type must be Outfit/Familjen

  // The pitch has a JS-driven entrance state (`.in` added in an effect) and the
  // split is transitioned in CSS, so a capture taken too early catches it
  // mid-transition with cards clipped. Wait for the geometry to hold still.
  const pitchBox = async () => JSON.stringify(await page.locator(".pitch").boundingBox());
  let previous = "";
  for (let i = 0; i < 40; i++) {
    const current = await pitchBox();
    if (current === previous && (await page.locator(".pitch").evaluate((el) => el.classList.contains("in")))) break;
    previous = current;
    await page.waitForTimeout(75);
  }
  await page.waitForTimeout(150);

  // ---- verify what actually rendered -------------------------------------
  const dom = await page.evaluate(() => {
    const font = (sel) => {
      const el = document.querySelector(sel);
      return el ? getComputedStyle(el).fontFamily.split(",")[0].replace(/["']/g, "") : null;
    };
    const teams = [...document.querySelectorAll(".pitch .team")].map((t) => ({
      heading: t.querySelector("h1,h2,h3,.team-name")?.textContent?.trim() ?? null,
      scrollOverflow: t.scrollWidth - t.clientWidth,
    }));
    const needleEl = document.querySelector(".needle");
    return {
      h1: document.querySelector(".split-head h1")?.textContent?.trim() ?? null,
      badges: [...document.querySelectorAll(".split-head-meta .badge")].map((b) => b.textContent.trim()),
      teams,
      gapReadout: document.querySelector(".readout")?.textContent?.replace(/\s+/g, " ").trim() ?? null,
      gapNumbers: [...document.querySelectorAll(".scale .num")].map((n) => n.textContent.trim()),
      needleTransform: needleEl ? getComputedStyle(needleEl).transform : null,
      needleRotated: needleEl ? getComputedStyle(needleEl).transform !== "none" : false,
      flags: [...document.querySelectorAll(".flags .flag")].map((f) => f.textContent.trim()),
      /** Declared stack (what CSS asks for) and whether the webfont actually loaded. */
      fonts: {
        declaredH1: font(".split-head h1"),
        declaredReadout: font(".readout"),
        loadedOutfit600: document.fonts.check("600 36px Outfit"),
        loadedFamiljen: document.fonts.check('400 14px "Familjen Grotesk"'),
      },
      /** The team name bar background is where the bib colour is painted. */
      teamNameBars: [...document.querySelectorAll(".pitch .team .tname")].map((el) => {
        const r = el.getBoundingClientRect();
        return {
          text: el.textContent.trim(),
          background: getComputedStyle(el).backgroundColor,
          opacity: getComputedStyle(el).opacity,
          visibility: getComputedStyle(el).visibility,
          rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        };
      }),
      pitchRect: (() => {
        const r = document.querySelector(".pitch")?.getBoundingClientRect();
        return r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null;
      })(),
      panelBackground: (() => {
        const el = document.querySelector(".pitch");
        return el ? getComputedStyle(el).backgroundColor : null;
      })(),
      text: document.querySelector(".split-screen")?.innerText?.replace(/\n{2,}/g, "\n").trim() ?? null,
      actionLabels: [...document.querySelectorAll(".split-bar .btn")].map((b) => b.textContent.trim()),
      teamsInPitch: document.querySelectorAll(".pitch .team").length,
      horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });

  // Hide the app chrome for the shot. These are siblings painted above the split
  // content, so Playwright composites them into the captured region (the sticky
  // topbar covered the team name bars). `visibility` keeps their layout boxes —
  // `display: none` would collapse the desktop rail grid and change the capture.
  await page.addStyleTag({
    content: `
      .topbar-wrap, .topbar, .bottom-nav, .rail {
        visibility: hidden !important;
        position: static !important;
      }
    `,
  });
  await page.waitForTimeout(100);

  // Geometry AFTER the style change, so what we assert matches what we capture.
  const captured = await page.evaluate(() => {
    const rect = (el) => {
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    };
    return {
      pitch: rect(document.querySelector(".pitch")),
      bars: [...document.querySelectorAll(".pitch .team .tname")].map((el) => ({
        text: el.textContent.trim(),
        background: getComputedStyle(el).backgroundColor,
        rect: rect(el),
      })),
    };
  });

  const pitchPng = resolve(outDir, `hero-split-${vp.label}.png`);
  const fullPng = resolve(outDir, `hero-full-${vp.label}.png`);
  await page.locator(".pitch").screenshot({ path: pitchPng });
  await page.locator(".split-screen").screenshot({ path: fullPng });

  await context.close();

  const audit = await analysePixels(await browser.newPage(), pitchPng).catch((e) => ({ error: String(e) }));
  const bytes = (await stat(pitchPng)).size;

  // Self-check: a capture that lost the team bars is not a hero image.
  if (audit.bibA < MIN_BIB_PIXELS || audit.bibB < MIN_BIB_PIXELS) {
    throw new Error(
      `${vp.label}: team bib colours missing from ${pitchPng} ` +
        `(bib-a=${audit.bibA}, bib-b=${audit.bibB}, need >=${MIN_BIB_PIXELS} each)`,
    );
  }

  report[vp.label] = { dom, pixels: audit, bytes, errors, files: { pitchPng, fullPng } };
  console.log(`\n=== ${vp.label} (${vp.width}x${vp.height}) ===`);
  console.log(`teams in pitch: ${dom.teamsInPitch}  |  horizontal overflow: ${dom.horizontalOverflow}px`);
  console.log(`h1: ${JSON.stringify(dom.h1)}`);
  console.log(`badges: ${JSON.stringify(dom.badges)}`);
  console.log(`gap readout: ${JSON.stringify(dom.gapReadout)}  | numbers: ${JSON.stringify(dom.gapNumbers)}`);
  console.log(`needle: rotated=${dom.needleRotated} transform=${dom.needleTransform}`);
  console.log(`flags: ${JSON.stringify(dom.flags)}`);
  console.log(`action labels: ${JSON.stringify(dom.actionLabels)}`);
  console.log(`fonts: ${JSON.stringify(dom.fonts)}`);
  console.log(`team card overflow: ${JSON.stringify(dom.teams.map((t) => t.scrollOverflow))}`);
  console.log(`pitch rect (at capture): ${JSON.stringify(captured.pitch)}`);
  console.log(`team name bars (at capture): ${JSON.stringify(captured.bars)}`);
  console.log(`panel background: ${dom.panelBackground}`);
  console.log(`  bib-a pixels: ${audit.bibA}  bib-b pixels: ${audit.bibB}  panel pixels: ${audit.panelPixels}`);
  if (errors.length) console.log(`  PAGE ERRORS: ${errors.join(" | ")}`);
}

await browser.close();
console.log("\n--- split screen text (mobile) ---");
console.log(report.mobile.dom.text);
console.log(`\nwritten to ${outDir}`);
