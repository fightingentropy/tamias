import type { StatementAnalytics } from "@tamias/app-data/queries/reports";
import { StatementAnalyticsView } from "../../../dashboard/src/components/metrics/statement-analytics-view";
import { useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { SelfAssessmentFiling } from "../../../dashboard/src/components/compliance/self-assessment-filing";
import { SelfAssessmentProfileForm } from "../../../dashboard/src/components/compliance/self-assessment-profile";
import type {
  TaxReport,
  TaxRequest,
} from "../../../dashboard/src/components/compliance/self-assessment-types";
import "@tamias/ui/globals.css";

function App() {
  const [teamId, setTeamId] = useState("fixture-a");
  const client = useQueryClient();
  const request: TaxRequest = useCallback(
    async (path, body, method = body ? "PUT" : "GET") => {
      const response = await fetch(`/fixture-api${path}`, {
        method,
        headers: { "Content-Type": "application/json", "X-Tamias-Team-Id": teamId },
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Request failed");
      return result;
    },
    [teamId],
  );
  const report = useQuery({
    queryKey: ["fixture-report", teamId],
    queryFn: () => request<TaxReport>("/report"),
  });
  const refresh = () => client.invalidateQueries({ queryKey: ["fixture-report", teamId] });
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-5 sm:p-10">
      <nav className="flex gap-4 text-sm">
        <button onClick={() => setTeamId(teamId === "fixture-a" ? "fixture-b" : "fixture-a")}>
          Switch workspace
        </button>
        <button onClick={() => void refresh()}>Refresh records</button>
      </nav>
      <h1 className="font-serif text-3xl">{report.data?.label} Self Assessment</h1>
      {report.data && (
        <div key={teamId} className="space-y-6">
          <SelfAssessmentProfileForm
            key={JSON.stringify(report.data.profile)}
            report={report.data}
            request={request}
            onSaved={refresh}
          />
          <SelfAssessmentFiling report={report.data} request={request} teamId={teamId} />
        </div>
      )}
    </main>
  );
}

function StatementApp() {
  const query = useQuery({
    queryKey: ["statement-fixture"],
    queryFn: async () =>
      (await fetch("/fixture-api/statement")).json() as Promise<StatementAnalytics>,
  });
  return (
    <main className="mx-auto max-w-5xl p-5">
      {query.data && <StatementAnalyticsView data={query.data} accountId="example-account" />}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {window.location.pathname === "/statement" ? <StatementApp /> : <App />}
  </QueryClientProvider>,
);
