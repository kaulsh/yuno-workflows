import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  DollarSign,
  Play,
  GitBranch,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
} from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { RunStatus } from "@workspace/shared";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function statusIcon(status: RunStatus) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />;
    case "failed":
      return <XCircle className="h-3.5 w-3.5 text-destructive" />;
    case "running":
      return <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />;
    case "pending":
      return <Clock className="h-3.5 w-3.5 text-amber-500" />;
    case "cancelled":
      return <XCircle className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

function statusVariant(
  status: RunStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "completed":
      return "default";
    case "failed":
      return "destructive";
    case "running":
      return "secondary";
    default:
      return "outline";
  }
}

function fmtCost(usd: number) {
  if (usd === 0) return "$0.000";
  if (usd < 0.001) return `$${usd.toFixed(6)}`;
  return `$${usd.toFixed(4)}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Dashboard() {
  const runsQuery = useQuery({
    queryKey: ["runs", { limit: 10 }],
    queryFn: () => api.runs.list({ limit: 10 }),
  });

  const workflowsQuery = useQuery({
    queryKey: ["workflows"],
    queryFn: api.workflows.list,
  });

  const runs = runsQuery.data?.runs ?? [];
  const workflows = (workflowsQuery.data ?? []).slice(0, 6);

  const totalCostToday = runs
    .filter((r) => {
      const d = new Date(r.startedAt);
      const now = new Date();
      return d.toDateString() === now.toDateString();
    })
    .reduce((sum, r) => sum + r.totalCostUsd, 0);

  const completedToday = runs.filter((r) => {
    const d = new Date(r.startedAt);
    const now = new Date();
    return d.toDateString() === now.toDateString() && r.status === "completed";
  }).length;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Overview of your agent workflow platform
        </p>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Runs</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {runsQuery.isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-3xl font-bold">{runs.length}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Last {runs.length} fetched
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cost Today</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {runsQuery.isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-3xl font-bold">
                {fmtCost(totalCostToday)}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Across all models
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Completed Today
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {runsQuery.isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-3xl font-bold">{completedToday}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Successful runs
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Recent Runs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Runs</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/runs">
                View all <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {runsQuery.isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : runs.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                No runs yet.{" "}
                <Link
                  to="/workflows"
                  className="text-primary underline underline-offset-4"
                >
                  Start a workflow
                </Link>
              </div>
            ) : (
              <ul className="divide-y">
                {runs.slice(0, 10).map((run) => (
                  <li key={run.id}>
                    <Link
                      to="/runs/$runId"
                      params={{ runId: run.id }}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors"
                    >
                      {statusIcon(run.status)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate font-mono text-xs">
                          #{run.id.slice(0, 8)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {fmtDate(run.startedAt)}
                        </p>
                      </div>
                      <Badge
                        variant={statusVariant(run.status)}
                        className="text-xs"
                      >
                        {run.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {fmtCost(run.totalCostUsd)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Workflows</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/workflows">
                Browse all <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {workflowsQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : workflows.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-6">
                No workflows yet.{" "}
                <Link
                  to="/workflows"
                  className="text-primary underline underline-offset-4"
                >
                  Create a workflow
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {workflows.map((wf) => (
                  <div
                    key={wf.id}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors group"
                  >
                    <GitBranch className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{wf.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {wf.description || "No description"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100"
                      asChild
                    >
                      <Link
                        to="/workflows/$workflowId"
                        params={{ workflowId: wf.id }}
                      >
                        <Play className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
