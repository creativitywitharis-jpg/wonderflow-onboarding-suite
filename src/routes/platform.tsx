import { createFileRoute } from "@tanstack/react-router";
import { PlatformWorkspace } from "@/components/wf/platform";

export const Route = createFileRoute("/platform")({
  head: () => ({ meta: [{ title: "Platform — WonderFlow OS" }] }),
  component: PlatformPage,
});

function PlatformPage() {
  return (
    <PlatformWorkspace />
  );
}
