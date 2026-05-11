"use client";

import { RouteError } from "@/components/RouteError";

export default function AskError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <RouteError
      surfaceLabel="ASK"
      routePath="/ask"
      title="The composer couldn't load."
      body="Wallet, credits, or the supported-token list failed to initialize. No round was opened — your balance is untouched."
      error={error}
      retry={unstable_retry}
      primaryHref={{ href: "/", label: "Back to home" }}
    />
  );
}
