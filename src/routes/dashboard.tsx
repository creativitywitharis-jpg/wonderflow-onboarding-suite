import { createFileRoute } from "@tanstack/react-router";
import { ExecutiveDashboard } from "@/components/wf/dashboard";
import { useOrg } from "@/lib/org-context";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Command Center — WonderFlow OS" },
      {
        name: "description",
        content:
          "Your WonderFlow command center: a daily AI briefing, business health score, live revenue KPIs, customer and inventory intelligence, and an AI Copilot.",
      },
      { property: "og:title", content: "Command Center — WonderFlow OS" },
      {
        property: "og:description",
        content:
          "The intelligent brain of your company — briefings, health score, KPIs and an AI Copilot.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { org } = useOrg();
  return <ExecutiveDashboard company={org?.name ?? "your business"} />;
}
