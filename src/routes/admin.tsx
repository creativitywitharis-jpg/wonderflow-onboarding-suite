import { createFileRoute } from "@tanstack/react-router";
import { Backdrop } from "@/components/wf/Backdrop";
import { AdminWorkspace } from "@/components/wf/admin";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Platform Administration — WonderFlow OS" },
      {
        name: "description",
        content:
          "WonderFlow Platform Administration: business settings, users, roles, permissions, AI configuration, integrations, security, audit logs, and system monitoring — complete control of your AI business operating system.",
      },
      { property: "og:title", content: "Platform Administration — WonderFlow OS" },
      {
        property: "og:description",
        content: "Complete control — users, roles, permissions, AI config, security, audit logs and system monitoring.",
      },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  return (
    <main className="relative min-h-screen">
      <Backdrop intensity={0.3} />
      <AdminWorkspace />
    </main>
  );
}
