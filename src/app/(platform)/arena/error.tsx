"use client";

import { RouteError } from "@/components/RouteError";

export default function ArenaError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <RouteError
      surfaceLabel="ARENA"
      routePath="/arena"
      title="The arena hit an error."
      body="The Realtime stream or the live-stats query couldn't load. The agents are still answering — this is just our reader."
      error={error}
      retry={unstable_retry}
      primaryHref={{ href: "/agents", label: "See the leaderboard" }}
    />
  );
}
