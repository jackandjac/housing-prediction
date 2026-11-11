"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/Feedback";
import type { Estimate, FormField } from "@/lib/types";
import { EstimateForm } from "./EstimateForm";
import { EstimateResult } from "./EstimateResult";

export function EstimateWorkspace({ fields }: { fields: FormField[] }) {
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <Card title="Property details">
        <EstimateForm fields={fields} onEstimate={setEstimate} />
      </Card>
      <Card title="Estimate" description={estimate ? undefined : "Your result appears here."}>
        {estimate ? (
          <EstimateResult estimate={estimate} />
        ) : (
          <EmptyState title="No estimate yet">
            Fill in the property details and choose <strong>Get estimate</strong>. You’ll see the price, how each
            feature affects it, and how the property compares with the market average.
          </EmptyState>
        )}
      </Card>
    </div>
  );
}
