"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Triggers `router.refresh()` every 5 seconds for the first 90 seconds after
 * the round opened so new agent responses appear without a manual reload.
 * Stops polling once the deadline has passed (no more responses will land).
 */
export function RoundLiveRefresh({ deadlineIso }: { deadlineIso: string }) {
  const router = useRouter();
  useEffect(() => {
    const deadlineMs = new Date(deadlineIso).getTime();
    // Refresh while the round is open + 30s grace for late responses.
    const stopAt = deadlineMs + 30_000;
    const id = setInterval(() => {
      if (Date.now() > stopAt) {
        clearInterval(id);
        return;
      }
      router.refresh();
    }, 5_000);
    return () => clearInterval(id);
  }, [deadlineIso, router]);
  return null;
}
