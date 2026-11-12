"use client";

import { ErrorView } from "@/components/layout/ErrorView";

export default function ModelsError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorView error={error} retry={retry} area="Model Studio" />;
}
