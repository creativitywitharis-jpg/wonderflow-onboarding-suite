import { createFileRoute } from "@tanstack/react-router";
import { AnalyticsWorkspace } from "@/components/wf/analytics";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics Intelligence — WonderFlow OS" },
      {
        name: "description",
        content:
          "WonderFlow Analytics: an AI business intelligence platform — executive, sales, customer, product, inventory, supplier, marketing and financial analytics, an AI report generator, and a custom analytics builder.",
      },
      { property: "og:title", content: "Analytics Intelligence — WonderFlow OS" },
      {
        property: "og:description",
        content: "Business intelligence across every department, with an AI report generator and a custom analytics builder.",
      },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  return (
    <AnalyticsWorkspace />
  );
}
