"use client";

import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { WhatIfRequest, WhatIfResult } from "@/lib/types";

/** Run a what-if analysis on the Java backend (which calls the ML model in one batch). */
export function useWhatIf() {
  return useMutation({
    mutationKey: ["what-if"],
    mutationFn: (req: WhatIfRequest) =>
      apiFetch<WhatIfResult>("/api/market/what-if", { method: "POST", body: JSON.stringify(req) }),
  });
}
