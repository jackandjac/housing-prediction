"use client";

import { ErrorView } from "@/components/layout/ErrorView";

export default function MarketError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorView error={error} retry={retry} area="Market analysis" />;
}
