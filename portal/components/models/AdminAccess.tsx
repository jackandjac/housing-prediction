"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert, Badge } from "@/components/ui/Feedback";
import { useAdminToken } from "@/hooks/useAdminToken";
import { apiFetch } from "@/lib/api-client";
import { errorMessage } from "@/lib/errors";

/** True when write actions can be attempted from this browser. */
export function useCanWrite(configured: boolean) {
  const token = useAdminToken((s) => s.token);
  return configured && token !== null;
}

/**
 * Unlocks training and model switching. The token is checked by the portal server
 * (never sent to ml-api) and kept in sessionStorage for this tab.
 */
export function AdminAccess({ configured }: { configured: boolean }) {
  const { token, setToken } = useAdminToken();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  if (!configured) {
    return (
      <Alert tone="warning" title="View only">
        Training and model changes are turned off on this server. Set <code className="font-mono">MODEL_ADMIN_TOKEN</code> for
        the portal to enable them.
      </Alert>
    );
  }

  if (token) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-accent-soft px-4 py-3 text-sm">
        <span className="flex items-center gap-2">
          <Badge tone="positive">Unlocked</Badge> You can train and activate models in this tab.
        </span>
        <Button variant="ghost" size="sm" onClick={() => setToken(null)}>
          Lock
        </Button>
      </div>
    );
  }

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    setChecking(true);
    setError(null);
    try {
      await apiFetch<void>("/api/ml-admin", { method: "POST", headers: { "x-admin-token": value } });
      setToken(value.trim());
      setValue("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setChecking(false);
    }
  }

  return (
    <form onSubmit={unlock} className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <label htmlFor="admin-token" className="text-sm font-medium">
          Admin token
        </label>
        <input
          id="admin-token"
          type="password"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "admin-token-error" : "admin-token-hint"}
          className="h-10 w-full min-w-48 rounded-lg border border-line bg-surface px-3 text-sm hover:border-muted"
        />
        {error ? (
          <p id="admin-token-error" className="text-xs font-medium text-negative">
            {error}
          </p>
        ) : (
          <p id="admin-token-hint" className="text-xs text-muted">
            Needed to train or activate models. Viewing works without it.
          </p>
        )}
      </div>
      <Button type="submit" disabled={!value.trim() || checking} className="mb-[22px]">
        {checking ? "Checking…" : "Unlock"}
      </Button>
    </form>
  );
}
