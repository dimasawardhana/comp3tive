import { useCallback, useEffect, useState } from "react";
import type { Discipline, Id } from "../domain/types";
import { hasSampleData, addSampleData } from "../data/sample-data";
import type { DisciplineStore } from "../storage/types";

/** Loads the discipline catalog (seeded on first open) and manages custom entries. */
export function useDisciplines(store: DisciplineStore) {
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      let list = await store.listDisciplines();
      if (list.length === 0) {
        // An empty catalog means a fresh (or rebuilt) database - restore the
        // built-in disciplines rather than leaving the app without any.
        for (const d of SEED_DISCIPLINES) await store.saveDiscipline(d);
        list = await store.listDisciplines();
      }
      setDisciplines(list);
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

  const saveDiscipline = useCallback(
    async (discipline: Discipline, sampleDataJson?: string) => {
      if (!discipline.builtIn && !hasSampleData(discipline.id)) {
        if (!sampleDataJson) {
          throw new Error(
            `Sample data is required for custom disciplines. Provide sample data for ${discipline.name} first.`,
          );
        }
        addSampleData(discipline.id, sampleDataJson);
      }
      await store.saveDiscipline(discipline);
      setDisciplines((prev) => {
        const i = prev.findIndex((d) => d.id === discipline.id);
        if (i === -1) return [...prev, discipline];
        const next = [...prev];
        next[i] = discipline;
        return next;
      });
    },
    [store],
  );
  const deleteDiscipline = useCallback(
    async (id: Id) => {
    },
    [store],
  );

  return { disciplines, loading, error, refresh, saveDiscipline, deleteDiscipline };
}
