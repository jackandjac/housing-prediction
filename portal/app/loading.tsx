import { Skeleton } from "@/components/ui/Feedback";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="mx-auto w-full max-w-6xl space-y-4 px-4 py-8 sm:px-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
