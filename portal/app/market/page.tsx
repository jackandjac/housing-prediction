import { Suspense } from "react";
import { CorrelationChart, HistogramChart, ModelFitChart } from "@/components/charts/MarketCharts";
import { FilterBar } from "@/components/market/FilterBar";
import { KpiTiles } from "@/components/market/KpiTiles";
import { SegmentPanel } from "@/components/market/SegmentPanel";
import { Card } from "@/components/ui/Card";
import { Alert, Skeleton, Stat } from "@/components/ui/Feedback";
import { PageHeader } from "@/components/ui/PageHeader";
import { errorMessage } from "@/lib/errors";
import { money } from "@/lib/format";
import { filterParams, parseFilters, toSearchParams } from "@/lib/market-filters";
import { settle } from "@/lib/settle";
import { getCacheStats, getCorrelations, getDistribution, getMeta, getModelFit, getSegments, getSummary } from "@/lib/server/market";
import Loading from "./loading";

export default function MarketDashboard({ searchParams }: PageProps<"/market">) {
  return (
    <>
      <PageHeader
        title="Market dashboard"
        description="Statistics for the housing dataset, computed and cached by the Java backend. Filters apply to every panel and live in the URL, so you can share a filtered view."
      />
      <Suspense fallback={<Loading />}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </>
  );
}

/** Initial data loads on the server, all requests in parallel. */
async function Dashboard({ searchParams }: { searchParams: PageProps<"/market">["searchParams"] }) {
  const sp = toSearchParams(await searchParams);
  const filters = filterParams(parseFilters(sp));
  const groupBy = sp.get("groupBy") ?? "bedrooms";
  const [meta, summary, segments, distribution, correlations] = await Promise.all([
    getMeta(),
    getSummary(filters),
    getSegments(filters, groupBy),
    getDistribution(filters, "price", 8),
    getCorrelations(filters),
  ]);

  return (
    <div className="space-y-6">
      <Suspense fallback={<Skeleton className="h-12 w-full" />}>
        <FilterBar meta={meta} />
      </Suspense>
      <KpiTiles summary={summary} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Prices by segment" description="Median price in each group.">
          <SegmentPanel segments={segments} options={meta.groupBy} />
        </Card>
        <div className="space-y-6">
          <Card title="Price distribution" description="Number of properties in each price band.">
            {distribution.bins.length ? <HistogramChart distribution={distribution} /> : <p className="text-sm text-muted">No data.</p>}
          </Card>
          <Card title="What moves price" description="Correlation of each feature with price (1 = rises together).">
            {correlations.length ? (
              <CorrelationChart correlations={correlations} />
            ) : (
              <p className="text-sm text-muted">Not enough properties for correlations.</p>
            )}
          </Card>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Suspense fallback={<Skeleton className="h-96" />}>
          <ModelFitPanel />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-96" />}>
          <CachePanel />
        </Suspense>
      </div>
    </div>
  );
}

/** Uses the ML model through the Java backend; failures stay inside this panel. */
async function ModelFitPanel() {
  const result = await settle(getModelFit());
  if (!result.ok) {
    return (
      <Card title="Model fit">
        <Alert tone="warning" title="Model comparison unavailable">
          {errorMessage(result.error)} The statistics above don’t depend on the model and are still current.
        </Alert>
      </Card>
    );
  }
  const fit = result.data;
  return (
    <Card title="Model fit" description="Model prediction vs recorded price for every property. Points on the dashed line are exact.">
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Stat label="Average error" value={money(fit.mae)} />
        <Stat label="RMS error" value={money(fit.rmse)} sub={<span className="font-mono">{fit.modelId}</span>} />
      </div>
      <ModelFitChart fit={fit} />
    </Card>
  );
}

async function CachePanel() {
  const stats = await getCacheStats().catch(() => []);
  const shown = stats.filter((s) => s.hits + s.misses > 0);
  return (
    <Card title="Backend cache" description="Caffeine caches in the Java service. Reload or change filters to watch hits grow.">
      {shown.length === 0 ? (
        <p className="text-sm text-muted">No cache activity yet.</p>
      ) : (
        <table className="w-full text-sm">
          <caption className="sr-only">Cache hit statistics</caption>
          <thead className="text-left text-xs text-muted uppercase">
            <tr>
              <th scope="col" className="py-1.5 font-medium">Cache</th>
              <th scope="col" className="py-1.5 text-right font-medium">Hits</th>
              <th scope="col" className="py-1.5 text-right font-medium">Misses</th>
              <th scope="col" className="py-1.5 text-right font-medium">Hit rate</th>
            </tr>
          </thead>
          <tbody className="tabular">
            {shown.map((s) => (
              <tr key={s.name} className="border-t border-line">
                <th scope="row" className="py-1.5 text-left font-mono text-xs font-normal">{s.name}</th>
                <td className="py-1.5 text-right">{s.hits}</td>
                <td className="py-1.5 text-right">{s.misses}</td>
                <td className="py-1.5 text-right">{Math.round(s.hitRate * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
