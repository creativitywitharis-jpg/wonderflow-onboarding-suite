import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/wf/AppShell";
import { CrmWorkspace } from "@/components/wf/crm";

export const Route = createFileRoute("/crm")({
  head: () => ({
    meta: [
      { title: "Customer Intelligence — WonderFlow OS" },
      {
        name: "description",
        content:
          "WonderFlow CRM: a customer intelligence engine with AI profiles, a segmentation engine, journey visualization, a unified communication center, and loyalty — so the business understands every customer.",
      },
      { property: "og:title", content: "Customer Intelligence — WonderFlow OS" },
      {
        property: "og:description",
        content: "An AI customer intelligence engine — profiles, segments, journeys, comms and loyalty.",
      },
    ],
  }),
  component: CrmPage,
});

function CrmPage() {
  return (
    <AppShell>
      <CrmWorkspace />
    </AppShell>
  );
}
