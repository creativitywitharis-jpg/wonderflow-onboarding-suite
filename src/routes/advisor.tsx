import { createFileRoute } from "@tanstack/react-router";
import { AdvisorWorkspace } from "@/components/wf/advisor";

export const Route = createFileRoute("/advisor")({
  head: () => ({
    meta: [
      { title: "AI Business Advisor — WonderFlow OS" },
      {
        name: "description",
        content:
          "WonderFlow AI Business Advisor: a digital CEO brain — CEO dashboard, business health score, daily briefing, an AI chat consultant, predictions, a strategy room, opportunity finder, risk monitoring, decision history, and an AI memory system.",
      },
      { property: "og:title", content: "WonderFlow AI Business Advisor — Your 24/7 CEO consultant" },
      {
        property: "og:description",
        content: "A digital CEO brain — chat, predictions, strategy, opportunities, risk and an AI memory of your business.",
      },
    ],
  }),
  component: AdvisorPage,
});

function AdvisorPage() {
  return (
    <AdvisorWorkspace />
  );
}
