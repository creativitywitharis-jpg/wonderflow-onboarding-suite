import { createFileRoute } from "@tanstack/react-router";
import { SuppliersWorkspace } from "@/components/wf/suppliers";

export const Route = createFileRoute("/suppliers")({
  head: () => ({
    meta: [
      { title: "Supplier Intelligence — WonderFlow OS" },
      {
        name: "description",
        content:
          "WonderFlow Suppliers: an AI procurement platform — supplier command center, database, AI profiles, a comparison engine, purchase orders, price intelligence, risk analysis, and an AI procurement assistant.",
      },
      { property: "og:title", content: "Supplier Intelligence — WonderFlow OS" },
      {
        property: "og:description",
        content: "An AI procurement manager — compare suppliers, manage POs, track prices and analyze risk.",
      },
    ],
  }),
  component: SuppliersPage,
});

function SuppliersPage() {
  return (
    <SuppliersWorkspace />
  );
}
