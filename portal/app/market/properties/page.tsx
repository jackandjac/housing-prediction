import type { Metadata } from "next";
import { Suspense } from "react";
import { ExportButtons } from "@/components/market/ExportButtons";
import { FilterBar } from "@/components/market/FilterBar";
import { PropertiesTable } from "@/components/market/PropertiesTable";
import { Skeleton } from "@/components/ui/Feedback";
import { PageHeader } from "@/components/ui/PageHeader";
import { filterParams, parseFilters, toSearchParams } from "@/lib/market-filters";
import { getMeta, getProperties } from "@/lib/server/market";

export const metadata: Metadata = { title: "Properties" };

const PAGE_SIZE = 15;

export default function PropertiesPage({ searchParams }: PageProps<"/market/properties">) {
  return (
    <>
      <PageHeader
        title="Properties"
        description="Every property in the dataset. Select a column heading to sort; exports include the current filters and sort order."
        action={
          <Suspense>
            <ExportButtons />
          </Suspense>
        }
      />
      <Suspense fallback={<Skeleton className="h-[560px] w-full" />}>
        <Properties searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Properties({ searchParams }: { searchParams: PageProps<"/market/properties">["searchParams"] }) {
  const sp = toSearchParams(await searchParams);
  const q = filterParams(parseFilters(sp));
  q.set("sort", sp.get("sort") ?? "price");
  q.set("dir", sp.get("dir") === "asc" ? "asc" : "desc");
  q.set("page", String(Math.max(0, Number(sp.get("page")) || 0)));
  q.set("size", String(PAGE_SIZE));
  const [meta, page] = await Promise.all([getMeta(), getProperties(q)]);
  return (
    <div className="space-y-4">
      <FilterBar meta={meta} />
      <PropertiesTable page={page} features={meta.features} />
    </div>
  );
}
