import { connection } from "next/server";
import { Suspense } from "react";
import { ServiceStatusGrid } from "@/components/layout/ServiceStatusGrid";
import { ActiveModelCard } from "@/components/models/ActiveModelCard";
import { AdminAccess } from "@/components/models/AdminAccess";
import { ModelTable } from "@/components/models/ModelTable";
import { ButtonLink } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Feedback";
import { PageHeader } from "@/components/ui/PageHeader";
import { errorMessage } from "@/lib/errors";
import { adminConfigured } from "@/lib/server/admin";
import { getModels } from "@/lib/server/ml";
import { getServiceStatus } from "@/lib/server/status";
import { settle } from "@/lib/settle";
import Loading from "./loading";

export default function ModelsOverview() {
  return (
    <>
      <PageHeader
        title="Models and services"
        description="The model serving predictions to both apps, every model trained so far, and the health of each backend."
        action={<ButtonLink href="/models/train">Train a model</ButtonLink>}
      />
      <Suspense fallback={<Loading />}>
        <Overview />
      </Suspense>
    </>
  );
}

async function Overview() {
  await connection(); // MODEL_ADMIN_TOKEN is read per request, not at build time
  const configured = adminConfigured();
  const [status, models] = await Promise.all([getServiceStatus(), settle(getModels())]);
  const active = models.ok ? (models.data.find((m) => m.is_active) ?? null) : null;

  return (
    <div className="space-y-6">
      <section aria-labelledby="services-heading">
        <h2 id="services-heading" className="text-sm font-semibold tracking-wide text-muted uppercase">
          Services
        </h2>
        <ServiceStatusGrid initial={status} />
      </section>

      <AdminAccess configured={configured} />

      {models.ok ? (
        <>
          <ActiveModelCard model={active} />
          <section aria-labelledby="models-heading" className="space-y-3">
            <h2 id="models-heading" className="text-base font-semibold">
              All models <span className="font-normal text-muted">({models.data.length})</span>
            </h2>
            <ModelTable initial={models.data} configured={configured} />
          </section>
        </>
      ) : (
        <Alert tone="warning" title="Models can’t be listed">
          {errorMessage(models.error)} Service health above keeps updating.
        </Alert>
      )}
    </div>
  );
}
