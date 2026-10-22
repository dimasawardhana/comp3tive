import { describe, expect, it } from "vitest";
import { parseBackup, serializeBackup } from "./transfer";
import { SAMPLE_PLAYERS } from "./samplePlayers";
import { SEED_DISCIPLINES } from "../domain/seed";
import type { Community, Discipline, Player, SavedSquad, Session, Tournament } from "../domain/types";

const community = (id: string, name: string): Community => ({ id, name, createdAt: 1000 });
const tournament = (id: string): Tournament => ({
  id,
  communityId: "c1",
  disciplineId: "futsal",
  name: "Night cup",
  format: "single-elim",
  seriesLength: 3,
  teamCount: 4,
  thirdPlace: true,
  createdAt: 1000,
  status: "draft",
  teams: [],
  matches: [],
});
const player = (id: string, name: string): Player => ({ id, communityId: "c1", name, createdAt: 1000, capabilities: [] });
const session = (id: string): Session => ({
  id,
  communityId: "c1",
  disciplineId: "futsal",
  createdAt: 100,
  poolPlayerIds: ["1"],
  settings: { teamCount: 2 },
  result: { teams: [], gap: 0, flags: [], unassigned: [], solver: { optimal: true, nodesExplored: 0, elapsedMs: 0 } },
});
const savedSquad = (id: string, name: string): SavedSquad => ({
  id,
  communityId: "c1",
  name,
  disciplineId: "futsal",
  createdAt: 200,
  poolPlayerIds: ["1"],
  settings: { teamCount: 2 },
  result: { teams: [], gap: 0, flags: [], unassigned: [], solver: { optimal: true, nodesExplored: 0, elapsedMs: 0 } },
});

describe("MPL ID sample roster", () => {
  it("is a valid import file (serializes and parses cleanly)", () => {
    const parsed = parseBackup(
      serializeBackup(SAMPLE_PLAYERS, [], [community("community-default", "Default")], [], [], []),
    );
    expect(parsed.players).toHaveLength(25);
    expect(parsed.sessions).toEqual([]);
    expect(parsed.communities).toHaveLength(1);
    expect(parsed.tournaments).toEqual([]);
    expect(parsed.savedSquads).toEqual([]);
    // every player has a valid MLBB capability with a preferred role inside eligibility
    for (const p of parsed.players) {
      const cap = p.capabilities.find((c) => c.disciplineId === "mlbb");
      expect(cap).toBeDefined();
      expect(cap!.eligibleRoles).toContain(cap!.preferredRole);
    }
  });
});

describe("serializeBackup / parseBackup roundtrip", () => {
  it("roundtrips communities, players, sessions, tournaments and saved squads", () => {
    const communities = [community("c1", "Sunday futsal")];
    const players = [player("1", "Budi"), player("2", "Andi")];
    const sessions = [session("s1"), session("s2")];
    const tournaments = [tournament("tr1")];
    const squads = [savedSquad("q1", "Friday night")];
    const parsed = parseBackup(serializeBackup(players, sessions, communities, tournaments, squads, []));
    expect(parsed.version).toBe(5);
    expect(parsed.communities).toEqual(communities);
    expect(parsed.players).toEqual(players);
    expect(parsed.sessions).toEqual(sessions);
    expect(parsed.tournaments).toEqual(tournaments);
    expect(parsed.savedSquads).toEqual(squads);
  });
});

describe("v5: the backup carries the discipline catalog", () => {
  const custom = (over: Partial<Discipline> = {}): Discipline => ({
    id: "volleyball",
    name: "Volleyball",
    shortName: "VB",
    roles: [
      { id: "setter", name: "Setter" },
      { id: "spiker", name: "Spiker" },
    ],
    attributes: [{ id: "serve", name: "Serve", min: 1, max: 5 }],
    strengthModel: { kind: "mean" },
    team: { minTeamSize: 6, maxTeamSize: 6, rolesRequired: true },
    ...over,
  });
  /** A v5 file written the way `serializeBackup` writes one. */
  const v5 = (disciplines: unknown[]) =>
    JSON.stringify({
      version: 5,
      exportedAt: "",
      communities: [community("c1", "Sunday futsal")],
      players: [],
      sessions: [],
      tournaments: [],
      savedSquads: [],
      disciplines,
    });

  it("carries the catalog through a round trip, custom entry included, byte for byte", () => {
    // The catalog a real device exports is the seeds plus whatever the Organizer
    // defined, so that is what the round trip is given. Deep equality *is* the
    // byte-for-byte claim, and it covers every field of the custom entry: its
    // roles, attributes, strength model and team.
    const volleyball = custom();
    const catalog = [...SEED_DISCIPLINES, volleyball];
    const text = serializeBackup([], [], [community("c1", "Crew")], [], [], catalog);
    const back = parseBackup(text, SEED_DISCIPLINES);
    expect(back.version).toBe(5);
    expect(back.disciplines).toEqual(catalog);
  });

  it("carries a 1-10 attribute with partial labels through a round trip", () => {
    const fps = custom({
      attributes: [
        {
          id: "aim",
          name: "Aim",
          min: 1,
          max: 10,
          labels: { 1: "Novice", 7: "Sharp", 10: "Legend" },
        },
      ],
    });
    const text = serializeBackup([], [], [community("c1", "Crew")], [], [], [fps]);
    const back = parseBackup(text, SEED_DISCIPLINES);
    const attr = back.disciplines.find((d) => d.id === "volleyball")?.attributes[0];
    expect(attr?.min).toBe(1);
    expect(attr?.max).toBe(10);
    expect(attr?.labels).toEqual({ 1: "Novice", 7: "Sharp", 10: "Legend" });
  });

  it("migrates a v4 file with no disciplines key to the built-in catalog", () => {
    const v4 = JSON.stringify({
      version: 4,
      exportedAt: "",
      communities: [community("c1", "Crew")],
      players: [],
      sessions: [],
      tournaments: [],
      savedSquads: [],
    });
    const back = parseBackup(v4, SEED_DISCIPLINES);
    expect(back.version).toBe(5);
    // No `disciplines` key in the file: the code's catalog is what a v4 device
    // gets, because the catalog is code-authoritative and the file has none.
    expect(back.disciplines.map((d) => d.id)).toEqual(SEED_DISCIPLINES.map((d) => d.id));
  });

  it("yields the code's built-ins even with no catalog parameter", () => {
    // The parameter is for player validation, not for seeding the result: the
    // built-ins come from `SEED_DISCIPLINES` either way, so omitting it cannot
    // produce a catalog with no futsal in it.
    const v4 = JSON.stringify({ version: 4, communities: [community("c1", "Crew")], players: [], sessions: [] });
    expect(parseBackup(v4).disciplines.map((d) => d.id)).toEqual(SEED_DISCIPLINES.map((d) => d.id));
  });

  it("takes the file's definition of a built-in — the exporting device's edits win", () => {
    const futsal = SEED_DISCIPLINES.find((d) => d.id === "futsal")!;
    const edited = {
      ...futsal,
      attributes: [{ id: "aim", name: "Aim", min: 1, max: 10, labels: { 10: "Elite" } }],
    };
    const back = parseBackup(v5([edited]), SEED_DISCIPLINES);
    const restored = back.disciplines.find((d) => d.id === "futsal");
    // The file's attributes, not the seeds': built-ins are editable on a device
    // (only the delete is refused), so a file from that device carries the edit
    // and a round trip must be lossless. Shape is still enforced by
    // isDiscipline, so the file cannot smuggle in a malformed definition.
    expect(restored?.attributes).toEqual(edited.attributes);
    expect(restored?.roles).toEqual(futsal.roles);
  });

  it("still rejects a malformed element that claims a built-in's id", () => {
    // The file wins, but only over well-formed entries: `isDiscipline` runs
    // before the merge, so a hand-edited file cannot poison futsal.
    expect(() => parseBackup(v5([{ id: "futsal", name: "Futsal" }]))).toThrow(/malformed discipline/);
  });

  it("cannot drop a built-in by omitting it from the file", () => {
    // Merge against `SEED_DISCIPLINES` as the floor, not a filter over the
    // file: a file omitting a built-in (a v4 import, or one authored before an
    // edit) yields the seed rather than a deletion. The custom entry still
    // arrives - this is a merge, not a substitution in either direction.
    const ids = parseBackup(v5([custom()])).disciplines.map((d) => d.id);
    for (const seed of SEED_DISCIPLINES) expect(ids).toContain(seed.id);
    expect(ids).toContain("volleyball");
  });

  it("treats a disciplines value that is not a list as an absent catalog", () => {
    // The same lenient default the sibling lists take: `tournaments` and
    // `savedSquads` read through `Array.isArray` and fall back rather than
    // failing the import, and a corrupt key should not be the one thing that
    // rejects a file. Nothing is lost either way, because the built-ins are the
    // code's. A malformed *element* is a different matter and throws, below.
    expect(parseBackup(v5({ id: "futsal" } as unknown as unknown[])).disciplines.map((d) => d.id)).toEqual(
      SEED_DISCIPLINES.map((d) => d.id),
    );
  });

  it("rejects a discipline with no id or no name", () => {
    expect(() => parseBackup(v5([{ name: "No id" }]))).toThrow(/malformed discipline/);
    expect(() => parseBackup(v5([{ id: "no-name" }]))).toThrow(/malformed discipline/);
  });
});

describe("v1 backup migration", () => {
  it("adopts v1 players and sessions into a single Default community", () => {
    const text = JSON.stringify({
      version: 1,
      players: [{ id: "1", name: "Budi", capabilities: [] }],
      sessions: [
        {
          id: "s1",
          disciplineId: "futsal",
          createdAt: 100,
          poolPlayerIds: ["1"],
          settings: { teamCount: 2 },
          result: { teams: [], gap: 0, flags: [], unassigned: [], solver: { optimal: true, nodesExplored: 0, elapsedMs: 0 } },
        },
      ],
    });
    const parsed = parseBackup(text);
    // Parsed output is always the current format, whatever the file said.
    expect(parsed.version).toBe(5);
    expect(parsed.communities).toHaveLength(1);
    expect(parsed.communities[0].name).toBe("Default");
    expect(parsed.players[0].communityId).toBe(parsed.communities[0].id);
    expect(parsed.sessions[0].communityId).toBe(parsed.communities[0].id);
    expect(parsed.tournaments).toEqual([]);
    expect(parsed.savedSquads).toEqual([]);
  });

  it("adopts records whose communityId references a missing community", () => {
    const text = JSON.stringify({
      version: 2,
      communities: [{ id: "c1", name: "Sunday futsal", createdAt: 1000 }],
      players: [{ id: "1", communityId: "ghost", name: "Budi", capabilities: [] }],
      sessions: [],
    });
    const parsed = parseBackup(text);
    expect(parsed.version).toBe(5);
    expect(parsed.players[0].communityId).toBe("c1");
    expect(parsed.tournaments).toEqual([]);
    expect(parsed.savedSquads).toEqual([]);
  });

  it("migrates a v3 backup with tournaments and no saved squads", () => {
    const text = JSON.stringify({
      version: 3,
      exportedAt: "",
      communities: [{ id: "c1", name: "Sunday futsal", createdAt: 1000 }],
      players: [],
      sessions: [],
      tournaments: [tournament("tr1")],
    });
    const parsed = parseBackup(text);
    expect(parsed.version).toBe(5);
    expect(parsed.tournaments).toHaveLength(1);
    expect(parsed.savedSquads).toEqual([]);
  });
});

describe("parseBackup validation", () => {
  it("rejects invalid JSON with a clear error", () => {
    expect(() => parseBackup("not json {")).toThrow(/not valid JSON/);
  });

  it("rejects a non-backup object", () => {
    expect(() => parseBackup(JSON.stringify({ hello: "world" }))).toThrow(/not a comp3tive backup|players list|sessions list/);
  });

  it("rejects an unsupported version", () => {
    const text = JSON.stringify({ version: 99, players: [], sessions: [] });
    expect(() => parseBackup(text)).toThrow(/Unsupported backup version: 99/);
  });

  it("rejects a malformed player", () => {
    const text = JSON.stringify({ version: 2, communities: [], players: [{ id: 7 }], sessions: [] });
    expect(() => parseBackup(text)).toThrow(/malformed player/);
  });

  it("rejects a malformed session", () => {
    const text = JSON.stringify({ version: 2, communities: [], players: [], sessions: [{ id: "x" }] });
    expect(() => parseBackup(text)).toThrow(/malformed session/);
  });

  it("rejects a malformed saved squad", () => {
    const text = JSON.stringify({
      version: 4,
      communities: [],
      players: [],
      sessions: [],
      savedSquads: [{ id: "q1" }],
    });
    expect(() => parseBackup(text)).toThrow(/malformed saved squad/);
  });
});

describe("parseBackup: player validation", () => {
  const validCap = {
    disciplineId: "mlbb",
    attributeRatings: { mechanics: 4, "game-sense": 4, "hero-pool": 4, teamwork: 4 },
    eligibleRoles: ["roam", "jungle", "mid-lane", "gold-lane", "exp-lane"],
    preferredRole: "roam",
  };
  const backup = (players: unknown[]) =>
    JSON.stringify({
      version: 4,
      exportedAt: "",
      communities: [community("c1", "Sunday futsal")],
      players,
      sessions: [],
      tournaments: [],
      savedSquads: [],
    });

  it("rejects a capability missing an attribute rating, naming the player and the attribute", () => {
    const text = backup([
      {
        id: "p3",
        communityId: "c1",
        name: "Player 3",
        capabilities: [{ ...validCap, attributeRatings: { mechanics: 4 } }],
      },
    ]);
    expect(() => parseBackup(text, SEED_DISCIPLINES)).toThrow(
      /^Backup player "Player 3" is invalid: Missing rating for attribute "Game Sense"\.$/,
    );
  });

  it("rejects a rating outside the attribute scale", () => {
    const text = backup([
      {
        id: "p1",
        communityId: "c1",
        name: "Player 1",
        capabilities: [{ ...validCap, attributeRatings: { ...validCap.attributeRatings, mechanics: 9 } }],
      },
    ]);
    expect(() => parseBackup(text, SEED_DISCIPLINES)).toThrow(/Rating for "Mechanics" must be 1-5, got 9\./);
  });

  it("rejects an unknown role", () => {
    const text = backup([
      {
        id: "p1",
        communityId: "c1",
        name: "Player 1",
        capabilities: [{ ...validCap, eligibleRoles: ["mid-lane", "wizard"], preferredRole: null }],
      },
    ]);
    expect(() => parseBackup(text, SEED_DISCIPLINES)).toThrow(/Role "wizard" is not part of "Mobile Legends"\./);
  });

  it("rejects an empty eligibility list", () => {
    const text = backup([
      {
        id: "p1",
        communityId: "c1",
        name: "Player 1",
        capabilities: [{ ...validCap, eligibleRoles: [], preferredRole: null }],
      },
    ]);
    expect(() => parseBackup(text, SEED_DISCIPLINES)).toThrow(/At least one eligible role is required for "Mobile Legends"\./);
  });

  it("rejects a duplicate capability for one discipline", () => {
    const text = backup([
      { id: "p1", communityId: "c1", name: "Player 1", capabilities: [validCap, validCap] },
    ]);
    expect(() => parseBackup(text, SEED_DISCIPLINES)).toThrow(/At most one capability per discipline/);
  });

  it("parses a valid file, with and without the catalog", () => {
    const text = backup([
      { id: "p1", communityId: "c1", name: "Player 1", capabilities: [validCap] },
    ]);
    expect(parseBackup(text, SEED_DISCIPLINES).players).toHaveLength(1);
    // The parameter is optional: the shape-only path is unchanged.
    expect(parseBackup(text).players).toHaveLength(1);
  });

  it("still adopts a v1 players-only file with zero capabilities", () => {
    const text = JSON.stringify({
      version: 1,
      players: [{ id: "1", name: "Budi", capabilities: [] }],
      sessions: [],
    });
    expect(parseBackup(text, SEED_DISCIPLINES).players).toHaveLength(1);
  });

  it("restores a capability whose discipline the supplied catalog does not know", () => {
    // A backup carries no catalog, so a discipline created on another device is
    // legitimately absent here - and the discipline-delete copy promises those
    // ratings survive ("Players with capabilities in it will still have those
    // ratings"). Refusing the whole file would break a legitimate restore.
    const text = backup([
      {
        id: "p1",
        communityId: "c1",
        name: "Player 1",
        capabilities: [{ ...validCap, disciplineId: "padel" }],
      },
    ]);
    expect(parseBackup(text, SEED_DISCIPLINES).players).toHaveLength(1);
  });

  it("narrows only the unknown-discipline rule, keeping the rest for those capabilities", () => {
    const unknownCap = { ...validCap, disciplineId: "padel" };
    const text = backup([
      { id: "p1", communityId: "c1", name: "Player 1", capabilities: [unknownCap, unknownCap] },
    ]);
    expect(() => parseBackup(text, SEED_DISCIPLINES)).toThrow(/At most one capability per discipline/);
  });

  it("rejects a capability element that is not an object", () => {
    const text = backup([{ id: "p1", communityId: "c1", name: "Player 1", capabilities: [null] }]);
    expect(() => parseBackup(text, SEED_DISCIPLINES)).toThrow(/malformed player/);
  });

  it("rejects a capability missing its ratings and eligibility lists", () => {
    const text = backup([
      { id: "p1", communityId: "c1", name: "Player 1", capabilities: [{ disciplineId: "mlbb" }] },
    ]);
    expect(() => parseBackup(text, SEED_DISCIPLINES)).toThrow(/malformed player/);
  });
});

describe("parseBackup: a two-community round trip keeps every record's own community", () => {
  it("preserves communityId per record and references no missing community", () => {
    const communities = [community("c1", "Alpha Crew"), community("c2", "Beta Guild")];
    const players = [
      { ...player("a1", "Alpha One"), communityId: "c1" },
      { ...player("b1", "Beta One"), communityId: "c2" },
    ];
    const sessions = [{ ...session("s-beta"), communityId: "c2" }];
    const tournaments = [{ ...tournament("tr-alpha"), communityId: "c1" }];
    const squads = [{ ...savedSquad("q-beta", "Beta Squad"), communityId: "c2" }];

    const parsed = parseBackup(serializeBackup(players, sessions, communities, tournaments, squads, []));

    expect(parsed.players.map((p) => p.communityId)).toEqual(["c1", "c2"]);
    expect(parsed.sessions[0].communityId).toBe("c2");
    expect(parsed.tournaments[0].communityId).toBe("c1");
    expect(parsed.savedSquads[0].communityId).toBe("c2");

    const known = new Set(parsed.communities.map((c) => c.id));
    const referenced = [
      ...parsed.players,
      ...parsed.sessions,
      ...parsed.tournaments,
      ...parsed.savedSquads,
    ].map((r) => r.communityId);
    expect(referenced.every((id) => known.has(id))).toBe(true);
  });
});
describe("Player.createdAt survives a backup, and is filled in when absent", () => {
  const withCreatedAt = (id: string, createdAt: number): Player => ({
    id,
    communityId: "c1",
    name: `Player ${id}`,
    createdAt,
    capabilities: [],
  });

  it("round-trips the file's own timestamps", () => {
    const roster = [withCreatedAt("a", 111), withCreatedAt("b", 222)];
    const parsed = parseBackup(
      serializeBackup(roster, [], [community("c1", "Crew")], [], [], []),
    );
    expect(parsed.players.map((p) => p.createdAt)).toEqual([111, 222]);
  });

  it("stamps a v4 file whose players carry no timestamp, rather than leaving it undefined", () => {
    // The Dashboard's "recently added" ranks by this field, so an `undefined`
    // arrives as a `NaN` comparison and an order nobody chose. A pre-v5 file
    // has no timestamps to read, so the import order stands in for the order
    // nothing recorded.
    const text = JSON.stringify({
      version: 4,
      exportedAt: "",
      communities: [community("c1", "Crew")],
      players: [
        { id: "a", communityId: "c1", name: "First", capabilities: [] },
        { id: "b", communityId: "c1", name: "Second", capabilities: [] },
      ],
      sessions: [],
    });
    const parsed = parseBackup(text);
    for (const p of parsed.players) {
      expect(Number.isFinite(p.createdAt)).toBe(true);
    }
    // Distinct, and in the file's order: a shared stamp would leave the ranking
    // to the id tie-break, which for imported ids is a random uuid.
    expect(parsed.players[0].createdAt).toBeLessThan(parsed.players[1].createdAt);
  });

  it("keeps a timestamp the file does carry, even when it is 0", () => {
    // `Number.isFinite` rather than a truthiness check: epoch 0 is a real
    // timestamp, and `if (p.createdAt)` would silently replace it.
    const text = JSON.stringify({
      version: 5,
      exportedAt: "",
      communities: [community("c1", "Crew")],
      players: [{ id: "a", communityId: "c1", name: "Epoch", createdAt: 0, capabilities: [] }],
      sessions: [],
      disciplines: [],
    });
    expect(parseBackup(text).players[0].createdAt).toBe(0);
  });
});

