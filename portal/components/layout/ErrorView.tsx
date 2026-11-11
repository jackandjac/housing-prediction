"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { errorMessage } from "@/lib/errors";

/** Shared body for error.tsx boundaries. */
export function ErrorView({ error, retry, area }: { error: unknown; retry: () => void; area: string }) {
  useEffect(() => console.error(error), [error]);
  const message = errorMessage(error);
  return (
    <div role="alert" className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-16 text-center">
      <p className="text-lg font-semibold">{area} couldn’t load</p>
      <p className="text-sm text-muted">
        {message.includes("unreachable") || message.includes("unavailable")
          ? `${message} The rest of the portal still works.`
          : "An unexpected error occurred. Try again, and if it keeps happening check that the backend services are running."}
      </p>
      <Button onClick={retry}>Try again</Button>
    </div>
  );
}
