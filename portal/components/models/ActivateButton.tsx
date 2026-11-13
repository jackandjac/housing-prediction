"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Feedback";
import { useActivateModel } from "@/hooks/useMl";
import { errorMessage } from "@/lib/errors";
import { useCanWrite } from "./AdminAccess";

/** Makes a model the one that serves predictions; reports success or the server's reason for refusing. */
export function ActivateButton({ modelId, configured, size = "sm" }: { modelId: string; configured: boolean; size?: "sm" | "md" }) {
  const canWrite = useCanWrite(configured);
  const activate = useActivateModel();
  const router = useRouter();

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        size={size}
        variant="secondary"
        disabled={!canWrite || activate.isPending}
        title={canWrite ? undefined : "Unlock with the admin token to activate models"}
        onClick={() => activate.mutate(modelId, { onSuccess: () => router.refresh() })}
      >
        {activate.isPending ? "Activating…" : "Make active"}
      </Button>
      {activate.isError && (
        <Alert title="Couldn’t activate this model">{errorMessage(activate.error)}</Alert>
      )}
    </div>
  );
}

/** Shown after a switch: the other apps cache the active model briefly. */
export const SWITCH_NOTE =
  "The estimator and market apps pick up the new model within about 30 seconds, because they cache the active model briefly.";
