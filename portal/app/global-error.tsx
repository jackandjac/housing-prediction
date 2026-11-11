"use client";

/** Replaces the root layout when it fails; must render its own document. */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <title>Something went wrong · Housing Insights</title>
        <div role="alert" style={{ textAlign: "center", padding: 16 }}>
          <h1 style={{ fontSize: 20 }}>The portal couldn’t load</h1>
          <p>Reload the page to try again.</p>
          <button type="button" onClick={retry} style={{ padding: "8px 16px", borderRadius: 8 }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
