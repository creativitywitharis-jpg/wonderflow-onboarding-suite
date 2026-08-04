import { createFileRoute } from "@tanstack/react-router";
import { Backdrop } from "@/components/wf/Backdrop";
import { GrowthWorkspace } from "@/components/wf/growth";

export const Route = createFileRoute("/growth")({
  head: () => ({
    meta: [
      { title: "WonderGrowth — WonderFlow OS" },
      {
        name: "description",
        content:
          "WonderGrowth: an AI growth operating system that acts as your Growth Director — growth score, AI advisor, segmentation, campaign studio, content studio, loyalty, revenue intelligence, and growth analytics.",
      },
      { property: "og:title", content: "WonderGrowth — Your AI Growth Director" },
      {
        property: "og:description",
        content: "An AI marketing & growth team — advisor, campaigns, content, loyalty and revenue intelligence.",
      },
    ],
  }),
  component: GrowthPage,
});

function GrowthPage() {
  return (
    <main className="relative min-h-screen">
      <Backdrop intensity={0.3} />
      <GrowthWorkspace />
    </main>
  );
}
