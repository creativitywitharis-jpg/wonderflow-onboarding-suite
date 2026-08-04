import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/wf/AppShell";
import { OrdersWorkspace } from "@/components/wf/orders";

export const Route = createFileRoute("/orders")({
  head: () => ({
    meta: [
      { title: "Order Command Center — WonderFlow OS" },
      {
        name: "description",
        content:
          "WonderFlow Orders: an AI-powered order management system — command center, live pipeline, order intelligence, an AI order assistant, fulfillment, delivery tracking, and analytics.",
      },
      { property: "og:title", content: "Order Command Center — WonderFlow OS" },
      {
        property: "og:description",
        content: "An intelligent operations manager — pipeline, fulfillment, delivery and analytics.",
      },
    ],
  }),
  component: OrdersPage,
});

function OrdersPage() {
  return (
    <AppShell>
      <OrdersWorkspace />
    </AppShell>
  );
}
