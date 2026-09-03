import { describe, expect, it } from "vitest";
import { parseBackup, serializeBackup } from "./transfer";
import { SAMPLE_PLAYERS } from "./samplePlayers";
import type { Community, Player, Session, Tournament } from "../domain/types";

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
const player = (id: string, name: string): Player => ({ id, communityId: "c1", name, capabilities: [] });
const session = (id: string): Session => ({
  id,
  communityId: "c1",
  disciplineId: "futsal",
  createdAt: 100,
  poolPlayerIds: ["1"],
  settings: { teamCount: 2 },
  result: { teams: [], gap: 0, flags: [], unassigned: [], solver: { optimal: true, nodesExplored: 0, elapsedMs: 0 } },
});

describe("MPL ID sample roster", () => {
  it("is a valid import file (serializes and parses cleanly)", () => {
    const parsed = parseBackup(
      serializeBackup(SAMPLE_PLAYERS, [], [community("community-default", "Default")], []),
    );
    expect(parsed.players).toHaveLength(25);
    expect(parsed.sessions).toEqual([]);
    expect(parsed.communities).toHaveLength(1);
    expect(parsed.tournaments).toEqual([]);
    // every player has a valid MLBB capability with a preferred role inside eligibility
    for (const p of parsed.players) {
      const cap = p.capabilities.find((c) => c.disciplineId === "mlbb");
      expect(cap).toBeDefined();
      expect(cap!.eligibleRoles).toContain(cap!.preferredRole);
    }
  });
});

describe("serializeBackup / parseBackup roundtrip", () => {
  it("roundtrips communities, players, sessions and tournaments", () => {
    const communities = [community("c1", "Sunday futsal")];
    const players = [player("1", "Budi"), player("2", "Andi")];
    const sessions = [session("s1"), session("s2")];
    const tournaments = [tournament("tr1")];
    const parsed = parseBackup(serializeBackup(players, sessions, communities, tournaments));
    expect(parsed.version).toBe(3);
    expect(parsed.communities).toEqual(communities);
    expect(parsed.players).toEqual(players);
    expect(parsed.sessions).toEqual(sessions);
    expect(parsed.tournaments).toEqual(tournaments);
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
    expect(parsed.version).toBe(3);
    expect(parsed.communities).toHaveLength(1);
    expect(parsed.communities[0].name).toBe("Default");
    expect(parsed.players[0].communityId).toBe(parsed.communities[0].id);
    expect(parsed.sessions[0].communityId).toBe(parsed.communities[0].id);
    expect(parsed.tournaments).toEqual([]);
  });

  it("adopts records whose communityId references a missing community", () => {
    const text = JSON.stringify({
      version: 2,
      communities: [{ id: "c1", name: "Sunday futsal", createdAt: 1000 }],
      players: [{ id: "1", communityId: "ghost", name: "Budi", capabilities: [] }],
      sessions: [],
    });
    const parsed = parseBackup(text);
    expect(parsed.version).toBe(3);
    expect(parsed.players[0].communityId).toBe("c1");
    expect(parsed.tournaments).toEqual([]);
  });
});

describe("parseBackup validation", () => {
  it("rejects invalid JSON with a clear error", () => {
    expect(() => parseBackup("not json {")).toThrow(/not valid JSON/);
  });

  it("rejects a non-backup object", () => {
    expect(() => parseBackup(JSON.stringify({ hello: "world" }))).toThrow(/not a Team Builder backup|players list|sessions list/);
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
});
