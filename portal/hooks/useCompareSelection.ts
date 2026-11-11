"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const MAX_COMPARE = 4;

type CompareState = {
  ids: string[];
  toggle: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
};

/**
 * Which estimates are picked for side-by-side comparison. Client state that outlives
 * navigation and reloads (localStorage), but belongs to this browser only.
 */
export const useCompareSelection = create<CompareState>()(
  persist(
    (set) => ({
      ids: [],
      toggle: (id) =>
        set((s) =>
          s.ids.includes(id)
            ? { ids: s.ids.filter((x) => x !== id) }
            : s.ids.length >= MAX_COMPARE
              ? s
              : { ids: [...s.ids, id] },
        ),
      remove: (id) => set((s) => ({ ids: s.ids.filter((x) => x !== id) })),
      clear: () => set({ ids: [] }),
    }),
    {
      name: "estimator-compare",
      // window.localStorage throws on the server, so nothing is read there.
      storage: createJSONStorage(() => window.localStorage),
      // Rehydrate after mount (see CompareSelectionHydrator) so the first client render matches the server HTML.
      skipHydration: true,
    },
  ),
);

/** Loads the saved selection once the app has mounted. Rendered once in Providers. */
export function CompareSelectionHydrator() {
  useEffect(() => {
    void useCompareSelection.persist.rehydrate();
  }, []);
  return null;
}
