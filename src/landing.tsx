import { createRoot } from "react-dom/client";
import { SplitScreen } from "./session/SplitScreen";
import { SplitDeal } from "./landingDeal";
import { MLBB_DISCIPLINE } from "./domain/seed";
import { freshSplit } from "./session/edit";
import type { Session, Player } from "./domain/types";
import "./index.css";

/**
 * The Landing Page's demonstrations (§ "every claim is a row").
 *
 * Every number below is produced by the real code paths this page advertises —
 * `freshSplit` runs the shipped solver over the sample roster — so the hero is
 * the product working, not a picture of it. The roster itself is authored
 * sample data; the solver output is genuine and therefore can disagree with the
 * hand-written rail figures, which is why the gap in the rail is read from the
 * result rather than typed.
 */

const ROSTER: Player[] = [
  { id: "hero-p1", communityId: "comm-hero", name: "Budi", capabilities: [{ disciplineId: "mlbb", attributeRatings: { mechanics: 4, "game-sense": 4, "hero-pool": 3, teamwork: 5 }, eligibleRoles: ["tank", "fighter"], preferredRole: "tank" }] },
  { id: "hero-p2", communityId: "comm-hero", name: "Andi", capabilities: [{ disciplineId: "mlbb", attributeRatings: { mechanics: 3, "game-sense": 3, "hero-pool": 3, teamwork: 4 }, eligibleRoles: ["tank", "fighter"], preferredRole: "tank" }] },
  { id: "hero-p3", communityId: "comm-hero", name: "Citra", capabilities: [{ disciplineId: "mlbb", attributeRatings: { mechanics: 5, "game-sense": 4, "hero-pool": 4, teamwork: 4 }, eligibleRoles: ["assassin", "mage"], preferredRole: "assassin" }] },
  { id: "hero-p4", communityId: "comm-hero", name: "Dewi", capabilities: [{ disciplineId: "mlbb", attributeRatings: { mechanics: 3, "game-sense": 4, "hero-pool": 3, teamwork: 3 }, eligibleRoles: ["assassin", "fighter"], preferredRole: "assassin" }] },
  { id: "hero-p5", communityId: "comm-hero", name: "Eka", capabilities: [{ disciplineId: "mlbb", attributeRatings: { mechanics: 4, "game-sense": 4, "hero-pool": 4, teamwork: 4 }, eligibleRoles: ["mage", "marksman"], preferredRole: "mage" }] },
  { id: "hero-p6", communityId: "comm-hero", name: "Fajar", capabilities: [{ disciplineId: "mlbb", attributeRatings: { mechanics: 3, "game-sense": 3, "hero-pool": 4, teamwork: 3 }, eligibleRoles: ["mage", "tank"], preferredRole: "mage" }] },
  { id: "hero-p7", communityId: "comm-hero", name: "Gita", capabilities: [{ disciplineId: "mlbb", attributeRatings: { mechanics: 4, "game-sense": 5, "hero-pool": 4, teamwork: 3 }, eligibleRoles: ["marksman", "mage"], preferredRole: "marksman" }] },
  { id: "hero-p8", communityId: "comm-hero", name: "Hana", capabilities: [{ disciplineId: "mlbb", attributeRatings: { mechanics: 4, "game-sense": 3, "hero-pool": 3, teamwork: 3 }, eligibleRoles: ["marksman", "assassin"], preferredRole: "marksman" }] },
  { id: "hero-p9", communityId: "comm-hero", name: "Irfan", capabilities: [{ disciplineId: "mlbb", attributeRatings: { mechanics: 4, "game-sense": 4, "hero-pool": 3, teamwork: 5 }, eligibleRoles: ["fighter", "tank"], preferredRole: "fighter" }] },
  { id: "hero-p10", communityId: "comm-hero", name: "Joko", capabilities: [{ disciplineId: "mlbb", attributeRatings: { mechanics: 3, "game-sense": 4, "hero-pool": 3, teamwork: 3 }, eligibleRoles: ["fighter", "assassin"], preferredRole: "fighter" }] },
];

const discipline = MLBB_DISCIPLINE;
const poolPlayerIds = ROSTER.map((p) => p.id);
const result = freshSplit(poolPlayerIds, ROSTER, discipline, { teamCount: 2 });

const session: Session = {
  id: "hero-session",
  communityId: "comm-hero",
  disciplineId: "mlbb",
  createdAt: 1_700_000_000_000,
  poolPlayerIds,
  settings: { teamCount: 2 },
  result,
};

const noop = async () => {};

function BracketPreview() {
  return (
    <section className="landing-tournament" aria-label="Tournament preview">
      <p className="landing-tournament-head">
        Then run the tournament on the teams that are already fair.
      </p>
      <div className="landing-bracket">
        <div className="landing-bracket-column">
          <p className="landing-bracket-round">Round 1</p>
          <div className="landing-bracket-match">
            <span className="landing-bteam">
              <span><span className="landing-bteam-dot" style={{ background: "var(--bib-a)" }}></span><span className="landing-bteam-name">Eka</span></span>
              <span className="landing-bteam-check">✓</span>
            </span>
            <span className="landing-bteam">
              <span><span className="landing-bteam-dot" style={{ background: "var(--bib-c)" }}></span><span className="landing-bteam-name">Irfan</span></span>
            </span>
          </div>
          <div className="landing-bracket-match">
            <span className="landing-bteam">
              <span><span className="landing-bteam-dot" style={{ background: "var(--bib-b)" }}></span><span className="landing-bteam-name">Citra</span></span>
              <span className="landing-bteam-check">✓</span>
            </span>
            <span className="landing-bteam">
              <span><span className="landing-bteam-dot" style={{ background: "var(--bib-d)" }}></span><span className="landing-bteam-name">Gita</span></span>
            </span>
          </div>
        </div>
        <div className="landing-bracket-advancing" aria-hidden="true">→</div>
        <div className="landing-bracket-column">
          <p className="landing-bracket-round">Final</p>
          <div className="landing-bracket-match">
            <span className="landing-bteam">
              <span><span className="landing-bteam-dot" style={{ background: "var(--bib-a)" }}></span><span className="landing-bteam-name">Eka</span></span>
              <span className="landing-bteam-check">✓</span>
            </span>
            <span className="landing-bteam">
              <span><span className="landing-bteam-dot" style={{ background: "var(--bib-b)" }}></span><span className="landing-bteam-name">Citra</span></span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

const DISCIPLINES = [
  {
    name: "Futsal",
    desc: "Indoor football on a smaller pitch — fast, technical, and built around tight spaces.",
    roles: ["Goalkeeper", "Defender", "Winger", "Pivot"],
    attributes: ["Technical", "Fitness", "Game IQ"],
    teamSize: "5+ a side",
  },
  {
    name: "Mobile Legends",
    desc: "5v5 MOBA — roles define your lane, and the strength model accounts for every attribute.",
    roles: ["Tank", "Assassin", "Mage", "Marksman", "Fighter"],
    attributes: ["Mechanics", "Game Sense", "Hero Pool", "Teamwork"],
    teamSize: "5 a side",
  },
  {
    name: "Badminton",
    desc: "1v1 or doubles — the split still balances, whether it's singles or a pair.",
    roles: ["Singles", "Doubles"],
    attributes: ["Technical", "Fitness", "Game IQ"],
    teamSize: "1v1 or 2v2",
  },
];

function DisciplineSection() {
  return (
    <section className="landing-disciplines" aria-label="Disciplines">
      <p className="landing-disciplines-head">
        Every role and attribute is accounted for by the split.
      </p>
      <div className="landing-discipline-grid">
        {DISCIPLINES.map((d) => (
          <div key={d.name} className="landing-discipline-card">
            <h3 className="landing-discipline-name">{d.name}</h3>
            <p className="landing-discipline-desc">{d.desc}</p>
            <p className="landing-discipline-roles">{d.roles.join(" · ")}</p>
            <p className="landing-discipline-attrs">{d.attributes.join(" · ")}</p>
            <p className="landing-discipline-size">{d.teamSize}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Mount a React subtree into an element, if that element exists. */
function mount(id: string, node: React.ReactNode) {
  const container = document.getElementById(id);
  if (container) createRoot(container).render(node);
}

mount(
  "landing-deal",
  <SplitDeal roster={ROSTER} result={result} discipline={discipline} />,
);

mount(
  "landing-hero",
  <SplitScreen
    session={session}
    discipline={discipline}
    roster={ROSTER}
    onPersistResult={noop}
    source="ad-hoc"
    onBack={undefined}
  />,
);

mount("landing-play", <BracketPreview />);
mount("landing-disciplines", <DisciplineSection />);

/**
 * Scroll entry: one authored moment for the ledger rows. IntersectionObserver,
 * never a scroll listener; elements are visible by default and only hidden once
 * this module runs, so a failed load or no-JS leaves the page readable.
 */
const rows = document.querySelectorAll(".landing-ledger > .landing-row, .landing-close");

/**
 * One authored entry for the ledger rows. Resting state is visible, so a page
 * whose animation loop never advances (headless capture, throttled background
 * tab, print) still paints content; the observer only ever *removes* the
 * pending state. Elements already inside the first viewport are never hidden.
 */
if (rows.length > 0 && "IntersectionObserver" in window) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) {
    rows.forEach((row) => row.classList.add("is-visible"));
  } else {
    const viewportH = window.innerHeight;
    rows.forEach((row) => {
      if (row.getBoundingClientRect().top < viewportH * 0.85) return;
      row.classList.add("is-pending");
    });
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );
    rows.forEach((row) => observer.observe(row));
  }
} else {
  document.documentElement.classList.add("no-observer");
}

/**
 * The rail states only facts the solver produced. The markup ships readable
 * figures for no-JS clients; this overwrites them with the real ones so the
 * page cannot drift from the code it demonstrates.
 */
const railFacts: Array<[string, string]> = [
  ["[data-landing-players]", String(ROSTER.length)],
  ["[data-landing-teams]", String(result.teams.length)],
  ["[data-landing-gap]", result.gap.toFixed(2)],
];

for (const [selector, value] of railFacts) {
  const el = document.querySelector(selector);
  if (el) el.textContent = value;
}
