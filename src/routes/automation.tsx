import { createFileRoute } from "@tanstack/react-router";
import { Backdrop } from "@/components/wf/Backdrop";
import { AutomationWorkspace } from "@/components/wf/automation";

export const Route = createFileRoute("/automation")({
  head: () => ({
    meta: [
      { title: "Automation Center — WonderFlow OS" },
      {
        name: "description",
        content:
          "WonderFlow Automation Center: the intelligent nervous system of your business — an automation dashboard, AI workflow creator, visual workflow builder, templates, triggers, AI decision & action blocks, an approval center, execution history, and automation analytics.",
      },
      { property: "og:title", content: "Automation Center — WonderFlow OS" },
      {
        property: "og:description",
        content: "Build intelligent workflows — AI creator, visual builder, approvals and analytics — so your business runs without constant manual work.",
      },
    ],
  }),
  component: AutomationPage,
});

function AutomationPage() {
  return (
    <main className="relative min-h-screen">
      <Backdrop intensity={0.3} />
      <AutomationWorkspace />
    </main>
  );
}
