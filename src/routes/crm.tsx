import { createFileRoute } from "@tanstack/react-router";
import { Backdrop } from "@/components/wf/Backdrop";
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
    <main className="relative min-h-screen">
      <Backdrop intensity={0.3} />
      <CrmWorkspace />
    </main>
  );
}
