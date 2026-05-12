"use client";

import { RouteError } from "@/components/RouteError";

export default function AgentsError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <RouteError
      surfaceLabel="THE TANK"
      routePath="/agents"
      title="The Tank couldn't load."
      body="The composite-score view didn't return in time. Agent rankings update on every settlement — the data itself is intact."
      error={error}
      retry={unstable_retry}
      primaryHref={{ href: "/agents/register", label: "Register an agent" }}
    />
  );
}
