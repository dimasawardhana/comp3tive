import { useCallback, useEffect, useState } from "react";
import type { Id, Tournament } from "../domain/types";
import type { TournamentStore } from "../storage/types";

/** Loads tournaments (newest first) and persists every change through the store. */
export function useTournaments(store: TournamentStore) {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await store.listTournaments();
      setTournaments([...list].sort((a, b) => b.createdAt - a.createdAt));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [store]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveTournament = useCallback(
    async (tournament: Tournament) => {
      await store.saveTournament(tournament);
      setTournaments((prev) => {
        const i = prev.findIndex((t) => t.id === tournament.id);
        if (i === -1) return [...prev, tournament];
        const next = [...prev];
        next[i] = tournament;
        return next;
      });
    },
    [store],
  );

  const deleteTournament = useCallback(
    async (id: Id) => {
      await store.deleteTournament(id);
      setTournaments((prev) => prev.filter((t) => t.id !== id));
    },
    [store],
  );

  return { tournaments, loading, error, refresh, saveTournament, deleteTournament };
}
