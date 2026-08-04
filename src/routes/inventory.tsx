import { createFileRoute } from "@tanstack/react-router";
import { InventoryWorkspace } from "@/components/wf/inventory";

export const Route = createFileRoute("/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory Intelligence — WonderFlow OS" },
      {
        name: "description",
        content:
          "WonderFlow Inventory: a predictive inventory intelligence system — command center, health score, product intelligence, demand forecasting, smart reorder, stock movement, an AI assistant, and analytics.",
      },
      { property: "og:title", content: "Inventory Intelligence — WonderFlow OS" },
      {
        property: "og:description",
        content: "Predictive inventory — forecasting, smart reorder and analytics that know what you need before you run out.",
      },
    ],
  }),
  component: InventoryPage,
});

function InventoryPage() {
  return (
    <InventoryWorkspace />
  );
}
