import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/wf/AppShell";
import { TeamWorkspace } from "@/components/wf/team";

export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [
      { title: "Team Operations — WonderFlow OS" },
      {
        name: "description",
        content:
          "WonderFlow Team Operations: manage employees, tasks, training and internal intelligence — team dashboard, employee profiles, AI task management, a staff assistant, scheduling intelligence, performance analytics, a training center, and internal communication.",
      },
      { property: "og:title", content: "Team Operations — WonderFlow OS" },
      {
        property: "og:description",
        content: "An intelligent assistant for every employee — tasks, scheduling, performance, training and communication.",
      },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  return (
    <AppShell>
      <TeamWorkspace />
    </AppShell>
  );
}
