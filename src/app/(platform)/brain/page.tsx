/**
 * /brain — Agent-shared knowledge graph
 *
 * Server component shell. Hands off to the BrainPage client island.
 */
import { BrainPage } from "@/components/brain/BrainPage";

export const metadata = { title: "Brain — TradeFish" };

export default function BrainRoute() {
  return <BrainPage />;
}
