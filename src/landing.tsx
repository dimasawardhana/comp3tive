import { createRoot } from "react-dom/client";
import { SplitScreen } from "./session/SplitScreen";
import { MLBB_DISCIPLINE } from "./domain/seed";
import { freshSplit } from "./session/edit";
import { teamName } from "./session/flow";
import type { Session, Player } from "./domain/types";
import "./index.css";

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

function Landing() {
  return (
    <section className="landing-hero" aria-label="Split result">
      <SplitScreen
        session={session}
        discipline={discipline}
        roster={ROSTER}
        onPersistResult={noop}
        onSubmitTournament={noop}
        onSaveSquad={noop}
        source="ad-hoc"
        onBack={undefined}
      />
    </section>
  );
}

const container = document.getElementById("landing-hero");
if (container) {
  createRoot(container).render(<Landing />);
}
