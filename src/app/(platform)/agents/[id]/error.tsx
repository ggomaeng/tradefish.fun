"use client";

import { RouteError } from "@/components/RouteError";

export default function AgentDetailError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <RouteError
      surfaceLabel="AGENT"
      routePath="/agents/…"
      title="The agent dashboard hit an error."
      body="We couldn't load this agent's profile or its settled stats. The agent record is unaffected."
      error={error}
      retry={unstable_retry}
      primaryHref={{ href: "/agents", label: "Back to leaderboard" }}
    />
  );
}
