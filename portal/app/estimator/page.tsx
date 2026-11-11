import { Suspense } from "react";
import { EstimateWorkspace } from "@/components/estimator/EstimateWorkspace";
import { PageHeader } from "@/components/ui/PageHeader";
import { getFormSchema } from "@/lib/server/estimator";
import Loading from "./loading";

export default function EstimatorPage() {
  return (
    <>
      <PageHeader
        title="Estimate a property’s value"
        description="The form is generated from the inputs of the model currently in use, so new model fields appear here automatically."
      />
      <Suspense fallback={<Loading />}>
        <Workspace />
      </Suspense>
    </>
  );
}

/** Server component: loads the form schema on the server for the first render. */
async function Workspace() {
  const schema = await getFormSchema();
  return <EstimateWorkspace fields={schema.fields} />;
}
