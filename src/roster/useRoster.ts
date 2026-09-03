import { useCallback, useEffect, useState } from "react";
import type { Id, Player } from "../domain/types";
import type { RosterStore } from "../storage/types";

/** Loads the roster and writes every change through the store (ADR-0001). */
export function useRoster(store: RosterStore) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await store.listPlayers();
      setPlayers(list);
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

  const savePlayer = useCallback(
    async (player: Player) => {
      await store.savePlayer(player);
      setPlayers((prev) => {
        const i = prev.findIndex((p) => p.id === player.id);
        if (i === -1) return [...prev, player];
        const next = [...prev];
        next[i] = player;
        return next;
      });
    },
    [store],
  );

  const deletePlayer = useCallback(
    async (id: Id) => {
      await store.deletePlayer(id);
      setPlayers((prev) => prev.filter((p) => p.id !== id));
    },
    [store],
  );

  const clearPlayers = useCallback(
    async () => {
      await store.replaceAllPlayers([]);
      setPlayers([]);
    },
    [store],
  );

  return { players, loading, error, refresh, savePlayer, deletePlayer, clearPlayers };
}
