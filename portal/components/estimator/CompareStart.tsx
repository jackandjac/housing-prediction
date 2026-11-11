"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { useCompareSelection } from "@/hooks/useCompareSelection";

/** Shown at /estimator/compare without ids: continue with the saved selection, or explain how to pick. */
export function CompareStart() {
  const ids = useCompareSelection((s) => s.ids);
  const router = useRouter();
  useEffect(() => {
    if (ids.length >= 2) router.replace(`/estimator/compare?ids=${ids.join(",")}`);
  }, [ids, router]);
  return (
    <EmptyState title="Pick properties to compare" action={<ButtonLink href="/estimator/history">Go to history</ButtonLink>}>
      Select between 2 and 4 estimates in your history (or use <strong>Add to comparison</strong> on a result) to see
      them side by side.
    </EmptyState>
  );
}
