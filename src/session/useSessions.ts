import { useCallback, useEffect, useState } from "react";
import type { Id, Session } from "../domain/types";
import type { SessionStore } from "../storage/types";

/** Loads past sessions (newest first) and removes them. */
export function useSessions(store: SessionStore) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await store.listSessions();
      setSessions([...list].sort((a, b) => b.createdAt - a.createdAt));
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

  const deleteSession = useCallback(
    async (id: Id) => {
      await store.deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    },
    [store],
  );

  return { sessions, loading, error, refresh, deleteSession };
}
