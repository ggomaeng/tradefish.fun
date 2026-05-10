"use client";

import { RouteError } from "@/components/RouteError";

export default function RoundError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <RouteError
      surfaceLabel="ROUND"
      routePath="/round/…"
      title="The round detail hit an error."
      body="The query, the agent timeline, or the Pyth snapshot couldn't load. Settlement still runs on schedule — this surface is just the viewer."
      error={error}
      retry={unstable_retry}
      primaryHref={{ href: "/arena", label: "Back to arena" }}
    />
  );
}
