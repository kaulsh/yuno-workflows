import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, type ReactNode } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ChevronDown,
  ChevronRight,
  Activity,
  DollarSign,
  Play,
  Wrench,
  Send,
  Flag,
  AlertCircle,
} from "lucide-react";
import { useAgents, useRun } from "@/lib/queries";
import { useRunStream } from "@/lib/use-run-stream";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  RunStatus,
  StepStatus,
  WorkflowRun,
  WorkflowStep,
  AgentTrace,
  RunEvent,
} from "@workspace/shared";

export const Route = createFileRoute("/runs/$runId")({
  component: RunDetail,
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtCost(usd: number) {
  if (usd === 0) return "$0.000";
  return `$${usd.toFixed(4)}`;
}

function fmtTokens(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function statusBadgeVariant(
  s: RunStatus | StepStatus,
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

function statusIcon(status: RunStatus | StepStatus) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />;
    case "failed":
      return <XCircle className="h-3.5 w-3.5 text-destructive" />;
    case "running":
      return <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />;
    case "pending":
      return <Clock className="h-3.5 w-3.5 text-amber-500" />;
    default:
      return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// ─── Step Timeline ─────────────────────────────────────────────────────────────

function stepNodeLabel(
  step: WorkflowStep,
  agentNames: Record<string, string>,
): string {
  if (step.nodeType === "condition") return "Condition";
  if (step.nodeType === "end") return "End";
  if (step.agentId && agentNames[step.agentId]) {
    return agentNames[step.agentId];
  }
  return step.nodeId;
}

function StepItem({
  step,
  agentNames,
}: {
  step: WorkflowStep;
  agentNames: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const label = stepNodeLabel(step, agentNames);
  const showNodeId =
    step.nodeType === "agent" &&
    step.agentId &&
    agentNames[step.agentId] !== undefined;

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        {statusIcon(step.status)}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium shrink-0">
              Step {step.stepIndex + 1}
            </span>
            <span className="text-sm truncate">{label}</span>
          </div>
          {showNodeId ? (
            <p className="text-xs text-muted-foreground font-mono truncate">
              {step.nodeId}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground mt-0.5">
            {fmtTime(step.startedAt)}
            {step.completedAt && ` → ${fmtTime(step.completedAt)}`}
          </p>
        </div>
        <Badge variant={statusBadgeVariant(step.status)} className="text-xs">
          {step.status}
        </Badge>
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 bg-muted/30 border-t">
          {step.inputMessage && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mt-3 mb-1">
                INPUT
              </p>
              <pre className="text-xs bg-card rounded p-2 overflow-x-auto whitespace-pre-wrap break-words">
                {step.inputMessage}
              </pre>
            </div>
          )}
          {step.output !== undefined && step.output !== null && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">
                OUTPUT
              </p>
              <pre className="text-xs bg-card rounded p-2 overflow-x-auto whitespace-pre-wrap break-words">
                {typeof step.output === "string"
                  ? step.output
                  : JSON.stringify(step.output, null, 2)}
              </pre>
            </div>
          )}
          {step.error && (
            <div>
              <p className="text-xs font-semibold text-destructive mb-1">
                ERROR
              </p>
              <pre className="text-xs text-destructive bg-destructive/10 rounded p-2 whitespace-pre-wrap">
                {step.error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Right Panel Tabs ─────────────────────────────────────────────────────────

type LogEventMeta = {
  icon: ReactNode;
  iconClass: string;
  title: string;
  detail?: string;
};

function resolveStepLabel(
  stepId: string | null | undefined,
  stepLabels: Record<string, string>,
): string | null {
  if (!stepId) return null;
  return stepLabels[stepId] ?? null;
}

function resolveNodeLabel(
  nodeId: string | null | undefined,
  nodeLabels: Record<string, string>,
): string {
  if (!nodeId) return "Step";
  return nodeLabels[nodeId] ?? nodeId;
}

function describeLogEvent(
  event: RunEvent,
  nodeLabels: Record<string, string>,
  stepLabels: Record<string, string>,
  agentNames: Record<string, string>,
): LogEventMeta | null {
  switch (event.type) {
    case "snapshot":
      return null;

    case "step.started": {
      const name = resolveNodeLabel(event.nodeId, nodeLabels);
      return {
        icon: <Play className="h-3 w-3" />,
        iconClass: "bg-blue-500/15 text-blue-600",
        title: name,
        detail: "Step started",
      };
    }

    case "step.completed": {
      const name = resolveNodeLabel(event.nodeId, nodeLabels);
      const tokens =
        event.tokens.promptTokens + event.tokens.completionTokens;
      const parts = ["Step completed"];
      if (tokens > 0) parts.push(`${fmtTokens(tokens)} tokens`);
      if (event.costUsd > 0) parts.push(fmtCost(event.costUsd));
      return {
        icon: <CheckCircle2 className="h-3 w-3" />,
        iconClass: "bg-green-500/15 text-green-600",
        title: name,
        detail: parts.join(" · "),
      };
    }

    case "step.failed": {
      const name = resolveNodeLabel(event.nodeId, nodeLabels);
      return {
        icon: <AlertCircle className="h-3 w-3" />,
        iconClass: "bg-destructive/15 text-destructive",
        title: name,
        detail: event.error,
      };
    }

    case "tool.called": {
      const step = resolveStepLabel(event.stepId, stepLabels);
      return {
        icon: <Wrench className="h-3 w-3" />,
        iconClass: "bg-amber-500/15 text-amber-600",
        title: event.toolName,
        detail: step ? `Called by ${step}` : "Tool called",
      };
    }

    case "tool.result": {
      const step = resolveStepLabel(event.stepId, stepLabels);
      return {
        icon: <Wrench className="h-3 w-3" />,
        iconClass: "bg-amber-500/10 text-amber-700",
        title: event.toolName,
        detail: step ? `${JSON.stringify(event.output).slice(0, 40)}...` : "Success",
      };
    }

    case "message.sent": {
      const from = agentNames[event.fromAgentId] ?? event.fromAgentId.slice(0, 8);
      const to = event.toAgentId
        ? (agentNames[event.toAgentId] ?? event.toAgentId.slice(0, 8))
        : null;
      return {
        icon: <Send className="h-3 w-3" />,
        iconClass: "bg-violet-500/15 text-violet-600",
        title: from,
        detail: to ? `To ${to}` : `Forward message`,
      };
    }

    case "run.completed": {
      const durationSec = Math.round(event.durationMs / 1000);
      return {
        icon: <Flag className="h-3 w-3" />,
        iconClass: "bg-primary/15 text-primary",
        title: "Run completed",
        detail: `${durationSec}s · ${fmtTokens(event.totalTokens)} tokens · ${fmtCost(event.totalCostUsd)}`,
      };
    }

    default:
      return null;
  }
}

function LogEventRow({
  event,
  meta,
  isLast,
}: {
  event: RunEvent & { at?: string };
  meta: LogEventMeta;
  isLast: boolean;
}) {
  const time = "at" in event && event.at ? fmtTime(event.at) : null;

  return (
    <div className="relative flex gap-3 pb-4 last:pb-0">
      {!isLast && (
        <span
          className="absolute left-[13px] top-7 bottom-0 w-px bg-border"
          aria-hidden
        />
      )}
      <div
        className={`relative z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${meta.iconClass}`}
      >
        {meta.icon}
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-tight truncate">
            {meta.title}
          </p>
          {time && (
            <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
              {time}
            </span>
          )}
        </div>
        {meta.detail && (
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2 break-words">
            {meta.detail}
          </p>
        )}
      </div>
    </div>
  );
}

function LogsTab({
  events,
  nodeLabels,
  stepLabels,
  agentNames,
}: {
  events: RunEvent[];
  nodeLabels: Record<string, string>;
  stepLabels: Record<string, string>;
  agentNames: Record<string, string>;
}) {
  const logEvents = useMemo(
    () =>
      events
        .map((event, index) => {
          const meta = describeLogEvent(
            event,
            nodeLabels,
            stepLabels,
            agentNames,
          );
          return meta ? { event, meta, index } : null;
        })
        .filter((item): item is NonNullable<typeof item> => item !== null),
    [events, nodeLabels, stepLabels, agentNames],
  );

  if (logEvents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No events yet
      </p>
    );
  }

  return (
    <div className="p-4">
      {logEvents.map(({ event, meta, index }, i) => (
        <LogEventRow
          key={`${event.type}-${"at" in event ? event.at : index}-${index}`}
          event={event}
          meta={meta}
          isLast={i === logEvents.length - 1}
        />
      ))}
    </div>
  );
}

function CostTab({ run, traces }: { run: WorkflowRun; traces: AgentTrace[] }) {
  const byModel = useMemo(() => {
    const map: Record<string, { tokens: number; cost: number }> = {};
    for (const t of traces) {
      if (!map[t.model]) map[t.model] = { tokens: 0, cost: 0 };
      map[t.model]!.tokens += t.promptTokens + t.completionTokens;
      map[t.model]!.cost += t.costUsd;
    }
    return Object.entries(map);
  }, [traces]);

  return (
    <div className="p-3 space-y-4">
      <div className="bg-muted/50 rounded-lg px-4 py-3">
        <p className="text-xs text-muted-foreground">Total Cost</p>
        <p className="text-2xl font-bold mt-1">{fmtCost(run.totalCostUsd)}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {fmtTokens(run.totalPromptTokens + run.totalCompletionTokens)} tokens
        </p>
      </div>
      {byModel.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">
            By Model
          </p>
          {byModel.map(([model, { tokens, cost }]) => (
            <div
              key={model}
              className="flex items-center justify-between text-xs"
            >
              <span className="font-mono text-muted-foreground truncate max-w-32">
                {model}
              </span>
              <span className="text-muted-foreground">
                {fmtTokens(tokens)} tok
              </span>
              <span className="font-medium">{fmtCost(cost)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

function RunDetail() {
  const { runId } = Route.useParams();
  const snapshotQuery = useRun(runId);
  const agentsQuery = useAgents();
  const stream = useRunStream(runId);

  const snapshot = stream.snapshot ?? snapshotQuery.data ?? null;
  const events =
    stream.events.length > 0 ? stream.events : (snapshot?.events ?? []);

  const run = snapshot?.run;
  const steps = snapshot?.steps ?? [];

  const traces = snapshot?.traces ?? [];

  const agentNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const agent of agentsQuery.data ?? []) {
      map[agent.id] = agent.name;
    }
    return map;
  }, [agentsQuery.data]);

  const nodeLabels = useMemo(() => {
    const map: Record<string, string> = {};
    for (const step of steps) {
      map[step.nodeId] = stepNodeLabel(step, agentNames);
    }
    return map;
  }, [steps, agentNames]);

  const stepLabels = useMemo(() => {
    const map: Record<string, string> = {};
    for (const step of steps) {
      map[step.id] = stepNodeLabel(step, agentNames);
    }
    return map;
  }, [steps, agentNames]);

  if (snapshotQuery.isLoading) {
    return (
      <div className="flex-1 p-6 space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-2 gap-4 h-96">
          <Skeleton className="h-full" />
          <Skeleton className="h-full" />
        </div>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="flex-1 p-6">
        <p className="text-muted-foreground">Run not found.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b bg-card px-4 py-3 flex items-center gap-3 shrink-0">
        <Link
          to="/runs"
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 flex items-center gap-3">
          <span className="font-mono text-sm text-muted-foreground">
            #{run.id.slice(0, 8)}
          </span>
          <Badge variant={statusBadgeVariant(run.status)} className="text-xs">
            {statusIcon(run.status)}
            <span className="ml-1">{run.status}</span>
          </Badge>
          {run.totalCostUsd > 0 && (
            <span className="text-sm font-medium">
              {fmtCost(run.totalCostUsd)}
            </span>
          )}
          {stream.connected && (
            <Badge variant="secondary" className="text-xs gap-1">
              <span className="h-1.5 w-1.5 bg-green-500 rounded-full animate-pulse" />
              Live
            </Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {run.stepCount} step{run.stepCount !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Step timeline */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="border-b px-4 py-2 shrink-0">
            <p className="text-sm font-semibold">
              Steps{" "}
              <span className="text-muted-foreground font-normal">
                ({steps.length})
              </span>
            </p>
          </div>
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-4 space-y-2">
              {steps.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {run.status === "pending"
                    ? "Waiting for execution to start…"
                    : "No steps recorded."}
                </p>
              ) : (
                [...steps]
                  .sort((a, b) => a.stepIndex - b.stepIndex)
                  .map((step) => (
                    <StepItem
                      key={step.id}
                      step={step}
                      agentNames={agentNames}
                    />
                  ))
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="w-80 shrink-0 border-l flex flex-col min-h-0 overflow-hidden">
          <Tabs
            defaultValue="logs"
            className="flex-1 flex flex-col overflow-hidden"
          >
            <TabsList className="w-full rounded-none border-b shrink-0">
              <TabsTrigger value="logs" className="flex-1 text-xs gap-1">
                <Activity className="h-3.5 w-3.5" />
                Logs
              </TabsTrigger>

              <TabsTrigger value="cost" className="flex-1 text-xs gap-1">
                <DollarSign className="h-3.5 w-3.5" />
                Cost
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="logs"
              className="flex-1 overflow-hidden mt-0"
            >
              <ScrollArea className="h-full">
                <LogsTab
                  events={events}
                  nodeLabels={nodeLabels}
                  stepLabels={stepLabels}
                  agentNames={agentNames}
                />
              </ScrollArea>
            </TabsContent>

            <TabsContent value="cost" className="flex-1 overflow-hidden mt-0">
              <ScrollArea className="h-full">
                <CostTab run={run} traces={traces} />
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
