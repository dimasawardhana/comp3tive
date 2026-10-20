import { useMemo, useState } from "react";
import type { Community, Discipline, Id, Player } from "../domain/types";
import { validatePlayer } from "../domain/validation";
import { getSession } from "../account/session";
import { useJoinRegistrations, type JoinCodeInfo } from "../account/useJoinRegistrations";

/**
 * The join panel (TASK-125): the Organizer's half of public player
 * registration, on the Settings screen. Signed-in only, and every network
 * action is a button press — the panel renders nothing that fetches on mount.
 *
 * The flow is deliberately pull-shaped. A public visitor never writes the
 * community document (its compare-and-swap belongs to the Organizer alone);
 * they write a pending row. The Organizer pulls rows here, each becomes a
 * local `savePlayer` through the normal markDirty -> push path, and the
 * acknowledged rows are deleted server-side. Unwanted registrations are
 * "pulled then deleted from the roster", which is why the panel offers one
 * pull button and no per-row accept/reject: moderation rides on the roster's
 * own delete, the cheapest screen the app already has.
 */

interface Props {
  community: Community | null;
  communities: Community[];
  disciplines: Discipline[];
  savePlayer: (player: Player) => Promise<void>;
  notify: (text: string, type?: "success" | "error" | "info") => void;
}

/** The join link for a code, rooted at this page's own origin. */
function joinLink(code: string): string {
  return `${location.origin}/join/${code}`;
}

export function JoinPanel({ community, communities, disciplines, savePlayer, notify }: Props) {
  // A Guest sees the panel's sign-in prompt rather than the controls: the
  // feature is an Account feature, and `apiFetch` would refuse the requests
  // anyway. Read once at render of the signed-in state the Account panel
  // already keeps; the panel re-mounts on Settings navigation, which is the
  // only moment this can change for this screen.
  const [signedIn] = useState(() => getSession() !== null);
  const join = useJoinRegistrations(notify);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [codesForCommunity, setCodesForCommunity] = useState(false);

  const codes: JoinCodeInfo[] = useMemo(() => {
    const list = join.codes ?? [];
    if (!community) return list;
    return list.filter((c) => c.communityId === community.id);
  }, [join.codes, community]);

  if (!signedIn) {
    return (
      <section className="settings-section" aria-label="Invite players">
        <div className="settings-label">Invite players</div>
        <p className="account-status">Sign in to create a public registration link for a community.</p>
      </section>
    );
  }

  if (!community) {
    return (
      <section className="settings-section" aria-label="Invite players">
        <div className="settings-label">Invite players</div>
        <p className="account-status">Pick a community to invite players into.</p>
      </section>
    );
  }

  const onMint = () => void join.mintCode(community.id);
  const onLoadCodes = async () => {
    await join.loadCodes();
    setCodesForCommunity(true);
  };
  const onCopy = (code: string) => {
    void navigator.clipboard
      .writeText(joinLink(code))
      .then(() => notify("Join link copied.", "success"))
      .catch(() => notify("The link could not be copied. Select it and copy by hand.", "error"));
  };

  /** Pull pending registrations and merge each into the roster. */
  const onPull = async (code: string) => {
    const pending = await join.pullRegistrations(code);
    if (!pending) return;
    if (pending.length === 0) {
      notify("No pending registrations for that code.", "info");
      return;
    }
    let imported = 0;
    const skipped: string[] = [];
    const handled: string[] = [];
    for (const registration of pending) {
      handled.push(registration.id);
      const player = registrationToPlayer(registration, community.id, disciplines);
      if (!player) {
        skipped.push(`"${registration.payload.name}": the community no longer offers "${registration.payload.disciplineName}".`);
        continue;
      }
      const problems = validatePlayer(player, disciplines);
      if (problems.length > 0) {
        skipped.push(`"${registration.payload.name}": ${problems[0].message}`);
        continue;
      }
      await savePlayer(player);
      imported++;
    }
    await join.acknowledge(handled);
    if (imported > 0)
      notify(`Pulled ${imported} player${imported === 1 ? "" : "s"} into ${community.name}.`, "success");
    else notify("No players were pulled.", "error");
    for (const reason of skipped.slice(0, 2)) notify(reason, "error");
  };

  return (
    <section className="settings-section" aria-label="Invite players">
      <div className="settings-label">Invite players</div>
      <p className="account-status">
        Create a link anyone can use to register as a player of {community.name}. Registrations wait for you to pull them into the roster.
      </p>
      <div className="account-actions">
        <button type="button" className="btn btn-primary" onClick={onMint} disabled={join.busy}>
          Create a join link
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => void onLoadCodes()} disabled={join.busy || codesForCommunity}>
          Show existing links
        </button>
      </div>
      {codes.length > 0 && (
        <ul className="join-codes">
          {codes.map((c) => (
            <li key={c.code} className="join-code-row">
              <div className="join-code-link">{joinLink(c.code)}</div>
              <button type="button" className="btn btn-ghost" onClick={() => onCopy(c.code)}>
                Copy
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setSelectedCode(c.code);
                  void onPull(c.code);
                }}
                disabled={join.busy || selectedCode === c.code}
              >
                Pull registrations
              </button>
            </li>
          ))}
        </ul>
      )}
      {communities.length > 1 && (
        <p className="account-status">The link registers players into {community.name}, the community you are in now.</p>
      )}
    </section>
  );
}

/** Map a registration's form answers onto a Player: names to ids, ratings to
 * attribute ids, anything missing to the middle rating. Exported for tests
 * of the pull-import contract. */
export function registrationToPlayer(
  registration: {
    payload: {
      name: string;
      disciplineName: string;
      roleName: string | null;
      ratings: Record<string, number> | null;
      notes: string | null;
    };
  },
  communityId: Id,
  disciplines: Discipline[],
): Player | null {
  const discipline = disciplines.find((d) => d.name === registration.payload.disciplineName);
  if (!discipline) return null;
  const roleId = registration.payload.roleName
    ? (discipline.roles.find((r) => r.name === registration.payload.roleName)?.id ?? null)
    : null;
  const eligible = roleId ? [roleId] : discipline.roles.map((r) => r.id);
  // A discipline with no roles produces a player eligible for nothing, which
  // `validatePlayer` rejects; the CSV import skips those rows and so does this.
  if (eligible.length === 0) return null;
  const submitted = registration.payload.ratings ?? {};
  return {
    id: crypto.randomUUID(),
    communityId,
    name: registration.payload.name,
    notes: registration.payload.notes ?? undefined,
    createdAt: Date.now(),
    capabilities: [
      {
        disciplineId: discipline.id,
        // Self-assessed where the visitor rated themselves; the middle
        // rating where they did not (or where the row predates the rating
        // form). The Organizer reviews strengths either way.
        attributeRatings: Object.fromEntries(
          discipline.attributes.map((a) => [a.id, submitted[a.name] ?? 3]),
        ),
        eligibleRoles: eligible,
        preferredRole: roleId,
      },
    ],
  };
}
