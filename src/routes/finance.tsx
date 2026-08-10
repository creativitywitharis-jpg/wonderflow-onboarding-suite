import { createFileRoute } from "@tanstack/react-router";
import { FinanceWorkspace } from "@/components/wf/finance";

export const Route = createFileRoute("/finance")({
  head: () => ({
    meta: [
      { title: "Finance — WonderFlow OS" },
      {
        name: "description",
        content:
          "WonderFlow Finance: invoicing, expenses, accounts receivable and payable, and a real profit & loss — all from your live business data.",
      },
      { property: "og:title", content: "Finance — WonderFlow OS" },
      { property: "og:description", content: "Invoices, expenses and a real P&L for your business." },
    ],
  }),
  component: FinancePage,
});

function FinancePage() {
  return <FinanceWorkspace />;
}
