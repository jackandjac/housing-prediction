import { Skeleton } from "@/components/ui/Feedback";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[76px]" />
        ))}
      </div>
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}
