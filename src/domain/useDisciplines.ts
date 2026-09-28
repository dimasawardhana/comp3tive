import { useCallback, useEffect, useState } from "react";
import type { Discipline, Id } from "../domain/types";
import { hasSampleData, addSampleData, autoGenerateSampleData } from "../data/sample-registry";
import { SEED_DISCIPLINES } from "../domain/seed";
import type { DisciplineStore } from "../storage/types";

/**
 * Loads the discipline catalog (seeded on first open) and manages custom entries.
 *
 * The store hands the catalog over in display order — seeds in the order
 * `seed.ts` declares them, custom entries after — and this hook keeps that
 * order when it adds or removes a row. It is load-bearing: `App.tsx` and
 * `GamesScreen.tsx` both take `disciplines[0]` as the app's default discipline.
 */
export function useDisciplines(store: DisciplineStore) {
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [loading, setLoading] = useState(true);
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
    async (discipline: Discipline) => {
      await store.saveDiscipline(discipline);
      setDisciplines((prev) => {
        const i = prev.findIndex((d) => d.id === discipline.id);
        if (i === -1) return [...prev, discipline];
        const next = [...prev];
        next[i] = discipline;
        return next;
      });
      // Auto-generate sample data for new custom disciplines
      if (!discipline.builtIn && !hasSampleData(discipline.id)) {
        const sampleData = autoGenerateSampleData(discipline);
        addSampleData(discipline.id, sampleData);
      }
    },
    [store],
  );

  const deleteDiscipline = useCallback(
    async (id: Id) => {
      await store.deleteDiscipline(id);
      setDisciplines((prev) => prev.filter((d) => d.id !== id));
    },
    [store],
  );

  return { disciplines, loading, error, refresh, saveDiscipline, deleteDiscipline };
}
