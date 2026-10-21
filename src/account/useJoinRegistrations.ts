import { useCallback, useState } from "react";
import { apiFetch } from "./session";

/**
 * The Organizer's half of public player registration (TASK-125): mint a join
 * code for a community, list what it holds, pull pending registrations into
 * the roster, and acknowledge what was pulled.
 *
 * Every request goes through `apiFetch`, which returns null without opening a
 * connection when there is no session — the Guest invariant ("a Guest's app
 * never opens a connection") holds because the UI that calls these shows only
 * when a session exists, and a null answer reads as "offline/signed out"
 * rather than an error.
 *
 * Nothing here runs at render: mint and pull are button actions, like Sync
 * now, because the no-screen-awaits-a-fetch-on-mount invariant is the app's
 * and this hook's callers respect it.
 */

/** A join code the Account has minted, as the server reports it.
 *
 * `disciplineId` is the link's binding: registrations through the link are
 * for that discipline and its public form shows no discipline picker. Null
 * on links minted before bindings existed — those keep the catalog form. */
export interface JoinCodeInfo {
  code: string;
  communityId: string;
  disciplineId: string | null;
  createdAt: number;
}

/** One pending registration, as the public form submitted it.
 *
 * `ratings` is keyed by attribute name; null on rows older than the rating
 * form (and on rows whose discipline offered no attributes).
 */
export interface PendingRegistration {
  id: string;
  payload: {
    name: string;
    disciplineName: string;
    roleName: string | null;
    /** Every role the visitor ticked, preferred one included; null on
     * rows older than the multi-role form or when nothing was ticked. */
    roles: string[] | null;
    ratings: Record<string, number> | null;
    notes: string | null;
  };
  createdAt: number;
}

export interface JoinRegistrationApi {
  /** Minting is in flight. */
  busy: boolean;
  /** The Account's codes, or null until the first load button press. */
  codes: JoinCodeInfo[] | null;
  /** Registration rows for the selected code, or null until a pull. */
  pending: PendingRegistration[] | null;
  mintCode: (communityId: string, disciplineId?: string) => Promise<void>;
  loadCodes: () => Promise<void>;
  pullRegistrations: (code: string) => Promise<PendingRegistration[] | null>;
  acknowledge: (ids: string[]) => Promise<void>;
}

interface ServerJoinCode {
  code: string;
  communityId: string;
  disciplineId?: string | null;
  createdAt: number;
}
interface ServerRegistration {
  id: string;
  payload: string;
  created_at: number;
}

/** Parse a registration row's payload, tolerating a malformed one. */
function parseRegistration(row: ServerRegistration): PendingRegistration | null {
  try {
    const payload = JSON.parse(row.payload) as PendingRegistration["payload"];
    if (typeof payload?.name !== "string" || typeof payload?.disciplineName !== "string") return null;
    return {
      id: row.id,
      payload: {
        name: payload.name,
        disciplineName: payload.disciplineName,
        roleName: typeof payload.roleName === "string" ? payload.roleName : null,
        roles: Array.isArray(payload.roles)
          ? payload.roles.filter((r): r is string => typeof r === "string")
          : null,
        ratings:
          payload.ratings && typeof payload.ratings === "object"
            ? Object.fromEntries(
                Object.entries(payload.ratings).filter(
                  (entry): entry is [string, number] => typeof entry[1] === "number",
                ),
              )
            : null,
        notes: typeof payload.notes === "string" ? payload.notes : null,
      },
      createdAt: row.created_at,
    };
  } catch {
    return null;
  }
}

export function useJoinRegistrations(notify: (message: string, type?: "info" | "success" | "error") => void): JoinRegistrationApi {
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState<JoinCodeInfo[] | null>(null);
  const [pending, setPending] = useState<PendingRegistration[] | null>(null);

  const mintCode = useCallback(
    async (communityId: string, disciplineId?: string) => {
      setBusy(true);
      try {
        const response = await apiFetch("/api/join/codes", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(disciplineId ? { communityId, disciplineId } : { communityId }),
        });
        if (!response || !response.ok) {
          notify("That join code could not be created.", "error");
          return;
        }
        const minted = (await response.json()) as ServerJoinCode;
        setCodes((prev) => [
          { code: minted.code, communityId: minted.communityId, disciplineId: minted.disciplineId ?? null, createdAt: minted.createdAt },
          ...(prev ?? []),
        ]);
        notify("Join code created. Share the link below.", "success");
      } finally {
        setBusy(false);
      }
    },
    [notify],
  );

  const loadCodes = useCallback(async () => {
    setBusy(true);
    try {
      const response = await apiFetch("/api/join/codes");
      if (!response || !response.ok) {
        notify("Your join codes could not be loaded.", "error");
        return;
      }
      const body = (await response.json()) as { codes: ServerJoinCode[] };
      setCodes(
        body.codes.map((c) => ({
          code: c.code,
          communityId: c.communityId,
          disciplineId: c.disciplineId ?? null,
          createdAt: c.createdAt,
        })),
      );
    } finally {
      setBusy(false);
    }
  }, [notify]);

  const pullRegistrations = useCallback(
    async (code: string) => {
      setBusy(true);
      try {
        const response = await apiFetch("/api/join/registrations", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code }),
        });
        if (!response || !response.ok) {
          notify("Registrations could not be pulled.", "error");
          return null;
        }
        const body = (await response.json()) as { registrations: ServerRegistration[] };
        const parsed = body.registrations.map(parseRegistration).filter((r): r is PendingRegistration => r !== null);
        setPending(parsed);
        return parsed;
      } finally {
        setBusy(false);
      }
    },
    [notify],
  );

  const acknowledge = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    // Fire and forget by design: an unacknowledged row comes back at the next
    // pull and the Organizer deletes a duplicate, which is a cheaper failure
    // than losing a registration the ack lost on the way home.
    await apiFetch("/api/join/registrations/ack", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    setPending(null);
  }, []);

  return { busy, codes, pending, mintCode, loadCodes, pullRegistrations, acknowledge };
}
