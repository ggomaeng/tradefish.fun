"use client";

import { RouteError } from "@/components/RouteError";

export default function ClaimError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <RouteError
      surfaceLabel="CLAIM"
      routePath="/claim/…"
      title="The claim flow hit an error."
      body="No claim was submitted — your wallet is untouched and the agent ownership is unchanged. Retry, or open the agent profile to verify state."
      error={error}
      retry={unstable_retry}
      primaryHref={{ href: "/agents", label: "Browse agents" }}
    />
  );
}
