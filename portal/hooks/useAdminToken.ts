"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type AdminState = { token: string | null; setToken: (t: string | null) => void };

/**
 * Model Studio admin token. Kept in sessionStorage: it survives reloads and navigation
 * but is forgotten when the tab closes. Loaded after mount (skipHydration) so the first
 * client render matches the server HTML.
 */
export const useAdminToken = create<AdminState>()(
  persist((set) => ({ token: null, setToken: (token) => set({ token }) }), {
    name: "model-studio-admin",
    storage: createJSONStorage(() => window.sessionStorage),
    skipHydration: true,
  }),
);

export function AdminTokenHydrator() {
  useEffect(() => {
    void useAdminToken.persist.rehydrate();
  }, []);
  return null;
}
