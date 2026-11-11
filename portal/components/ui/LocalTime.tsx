"use client";

import { useSyncExternalStore } from "react";

const utc = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
const local = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });
const noopSubscribe = () => () => {};

/** False during server rendering and hydration, true afterwards. */
function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/**
 * A timestamp in the viewer's own time zone. The server (which may run in UTC, e.g. in a Codespace)
 * and the hydrating client both render UTC, so the HTML matches; local time replaces it right after.
 */
export function LocalTime({ iso }: { iso: string }) {
  const hydrated = useHydrated();
  const date = new Date(iso);
  return <time dateTime={iso}>{hydrated ? local.format(date) : `${utc.format(date)} UTC`}</time>;
}
