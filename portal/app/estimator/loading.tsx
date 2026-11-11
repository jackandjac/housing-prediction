import { Skeleton } from "@/components/ui/Feedback";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-4">
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-6 lg:grid-cols-[5fr_7fr]">
        <Skeleton className="h-[480px]" />
        <Skeleton className="h-[480px]" />
      </div>
    </div>
  );
}
