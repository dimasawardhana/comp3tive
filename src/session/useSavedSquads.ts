import { useCallback, useEffect, useState } from "react";
import type { Id, SavedSquad } from "../domain/types";
import type { SavedSquadStore } from "../storage/types";

/** Loads the community's saved squads (newest first) and persists changes. */
export function useSavedSquads(store: SavedSquadStore) {
  const [squads, setSquads] = useState<SavedSquad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await store.listSavedSquads();
      setSquads([...list].sort((a, b) => b.createdAt - a.createdAt));
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

  const saveSquad = useCallback(
    async (squad: SavedSquad) => {
      await store.saveSavedSquad(squad);
      setSquads((prev) => {
        const i = prev.findIndex((s) => s.id === squad.id);
        if (i === -1) return [squad, ...prev].sort((a, b) => b.createdAt - a.createdAt);
        const next = [...prev];
        next[i] = squad;
        return next;
      });
    },
    [store],
  );

  const deleteSquad = useCallback(
    async (id: Id) => {
      await store.deleteSavedSquad(id);
      setSquads((prev) => prev.filter((s) => s.id !== id));
    },
    [store],
  );

  return { squads, loading, error, refresh, saveSquad, deleteSquad };
}
