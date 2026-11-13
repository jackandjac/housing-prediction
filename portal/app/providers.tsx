"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { AdminTokenHydrator } from "@/hooks/useAdminToken";
import { CompareSelectionHydrator } from "@/hooks/useCompareSelection";
import { ApiError } from "@/lib/errors";

/** Client-side server-state cache (TanStack Query), shared by both apps. */
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            // Don't retry client errors (4xx); retry transient failures once.
            retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 1,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <CompareSelectionHydrator />
      <AdminTokenHydrator />
      {children}
    </QueryClientProvider>
  );
}
