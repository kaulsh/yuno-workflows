import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Play,
  ChevronDown,
} from "lucide-react";
import { useRuns, useWorkflows } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RunStatus } from "@workspace/shared";

export const Route = createFileRoute("/runs/")({
  component: RunsList,
});

function statusIcon(status: RunStatus) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-destructive" />;
    case "running":
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    case "pending":
      return <Clock className="h-4 w-4 text-amber-500" />;
    case "cancelled":
      return <XCircle className="h-4 w-4 text-muted-foreground" />;
  }
}

function statusVariant(
  s: RunStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (s) {
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
  return `$${usd.toFixed(4)}`;
}

function fmtDuration(startedAt: string, completedAt: string | null) {
  if (!completedAt) return "—";
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function RunsList() {
  const { data: workflowsData } = useWorkflows();
  const [workflowFilter, setWorkflowFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useRuns({
      workflowId: workflowFilter === "all" ? undefined : workflowFilter,
      status: statusFilter === "all" ? undefined : statusFilter,
      limit: 20,
    });

  const allRuns = data?.pages.flatMap((p) => p.runs) ?? [];
  const workflows = workflowsData ?? [];

  const workflowMap = Object.fromEntries(workflows.map((w) => [w.id, w.name]));

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Runs</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Workflow execution history
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={workflowFilter} onValueChange={setWorkflowFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All Workflows" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Workflows</SelectItem>
              {workflows.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : allRuns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Play className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No runs found</h3>
          <p className="text-muted-foreground text-sm mt-1">
            {workflowFilter !== "all" || statusFilter !== "all"
              ? "Try clearing your filters."
              : "Run a workflow to see results here."}
          </p>
        </div>
      ) : (
        <>
          <div className="border rounded-lg divide-y overflow-hidden">
            {allRuns.map((run) => (
              <Link
                key={run.id}
                to="/runs/$runId"
                params={{ runId: run.id }}
                className="flex items-center gap-4 px-4 py-3 hover:bg-accent transition-colors"
              >
                {statusIcon(run.status)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      #{run.id.slice(0, 8)}
                    </span>
                    {workflowMap[run.workflowId] && (
                      <span className="text-sm font-medium truncate">
                        {workflowMap[run.workflowId]}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {fmtDate(run.startedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-muted-foreground">
                    {run.stepCount} step{run.stepCount !== 1 ? "s" : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {fmtDuration(run.startedAt, run.completedAt)}
                  </span>
                  <span className="text-xs font-medium">
                    {fmtCost(run.totalCostUsd)}
                  </span>
                  <Badge variant={statusVariant(run.status)} className="text-xs">
                    {run.status}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
          {hasNextPage && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ChevronDown className="h-4 w-4 mr-2" />
                )}
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
