import { snakeCase } from "change-case"
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  Handle,
  Position,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ArrowLeft,
  Save,
  Play,
  CheckSquare,
  Plus,
  Loader2,
  Bot,
  GitMerge,
  Square,
  Settings,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import {
  useWorkflow,
  useCreateWorkflow,
  useUpdateWorkflow,
  useRunWorkflow,
  useAgents,
} from "@/lib/queries";
import { validateWorkflowGraph, WorkflowGraphSchema } from "@workspace/shared";
import type {
  WorkflowNode,
  WorkflowEdge,
  TriggerType,
  TriggerConfig,
  ConditionOp,
} from "@workspace/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/workflows/$workflowId")({
  component: WorkflowBuilder,
});

function FieldHint({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs text-muted-foreground leading-relaxed">{children}</p>
  );
}

// ─── Custom Nodes ────────────────────────────────────────────────────────────

function AgentNode({
  data,
  selected,
}: {
  data: Record<string, unknown>;
  selected: boolean;
}) {
  return (
    <div
      className={cn(
        "bg-card border-2 rounded-lg px-4 py-3 min-w-36 shadow-sm transition-all",
        selected ? "border-primary shadow-md" : "border-border",
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-primary" />
      <div className="flex items-center gap-2">
        <Bot className="h-4 w-4 text-primary shrink-0" />
        <div>
          <p className="text-xs font-semibold leading-tight">
            {(data.agentName as string) || "Agent"}
          </p>
          {data.task ? (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 max-w-32">
              {data.task as string}
            </p>
          ) : null}
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-primary" />
    </div>
  );
}

function ConditionNode({
  data,
  selected,
}: {
  data: Record<string, unknown>;
  selected: boolean;
}) {
  return (
    <div
      className={cn(
        "bg-card border-2 rounded-lg px-4 py-3 min-w-36 shadow-sm transition-all",
        selected ? "border-amber-500 shadow-md" : "border-amber-300",
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-amber-500"
      />
      <div className="flex items-center gap-2">
        <GitMerge className="h-4 w-4 text-amber-600 shrink-0" />
        <div>
          <p className="text-xs font-semibold leading-tight">Condition</p>
          {data.field ? (
            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              {data.field as string} {data.op as string}
            </p>
          ) : null}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id="true"
        style={{ top: "30%" }}
        className="!bg-green-500"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="false"
        style={{ top: "70%" }}
        className="!bg-red-500"
      />
      <div className="absolute -right-12 flex flex-col gap-2 text-xs text-muted-foreground pointer-events-none top-1/2 -translate-y-1/2">
        <span className="text-green-600 font-medium">T</span>
        <span className="text-red-500 font-medium">F</span>
      </div>
    </div>
  );
}

function EndNode({ selected }: { selected: boolean }) {
  return (
    <div
      className={cn(
        "bg-card border-2 rounded-lg px-4 py-3 shadow-sm transition-all",
        selected ? "border-muted-foreground shadow-md" : "border-muted",
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-muted-foreground"
      />
      <div className="flex items-center gap-2">
        <Square className="h-4 w-4 text-muted-foreground shrink-0" />
        <p className="text-xs font-semibold">End</p>
      </div>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  agent: AgentNode as unknown as NodeTypes[string],
  condition: ConditionNode as unknown as NodeTypes[string],
  end: EndNode as unknown as NodeTypes[string],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function workflowNodesToFlow(
  nodes: WorkflowNode[],
  agentNameMap: Record<string, string>,
): Node[] {
  return nodes.map((n) => {
    const base = {
      id: n.id,
      position: n.position,
      type: n.type,
    };
    if (n.type === "agent") {
      return {
        ...base,
        data: {
          agentId: n.agentId,
          agentName: agentNameMap[n.agentId] ?? "Unknown",
          task: n.task,
          outputSchema: n.outputSchema,
        },
      };
    }
    if (n.type === "condition") {
      return {
        ...base,
        data: {
          field: n.expression.field,
          op: n.expression.op,
          value: n.expression.value,
        },
      };
    }
    return { ...base, data: {} };
  });
}

function workflowEdgesToFlow(edges: WorkflowEdge[]): Edge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.branch,
    label: e.branch ?? undefined,
    markerEnd: { type: MarkerType.ArrowClosed },
    style: {
      stroke:
        e.branch === "true"
          ? "#22c55e"
          : e.branch === "false"
            ? "#ef4444"
            : undefined,
    },
  }));
}

function flowNodesToWorkflow(nodes: Node[]): WorkflowNode[] {
  return nodes.map((n) => {
    if (n.type === "agent") {
      return {
        id: n.id,
        type: "agent" as const,
        agentId: (n.data.agentId as string) ?? "",
        task: (n.data.task as string) ?? "",
        outputSchema: n.data.outputSchema as
          | Record<string, unknown>
          | undefined,
        position: n.position,
      };
    }
    if (n.type === "condition") {
      return {
        id: n.id,
        type: "condition" as const,
        expression: {
          field: (n.data.field as string) ?? "",
          op: (n.data.op as ConditionOp) ?? "equals",
          value: (n.data.value as string) ?? "",
        },
        position: n.position,
      };
    }
    return { id: n.id, type: "end" as const, position: n.position };
  });
}

function flowEdgesToWorkflow(edges: Edge[]): WorkflowEdge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    branch:
      e.sourceHandle === "true"
        ? "true"
        : e.sourceHandle === "false"
          ? "false"
          : undefined,
  }));
}

let nodeCounter = 1;
function genId() {
  return `node-${Date.now()}-${nodeCounter++}`;
}

// ─── Node Config Panel ────────────────────────────────────────────────────────

function isValidOutputSchemaJson(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

function OutputSchemaField({
  nodeId,
  nodeData,
  onUpdate,
}: {
  nodeId: string;
  nodeData: Record<string, unknown>;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
}) {
  const outputSchema = nodeData.outputSchema;
  const [text, setText] = useState(() =>
    outputSchema ? JSON.stringify(outputSchema, null, 2) : "",
  );

  useEffect(() => {
    setText(outputSchema ? JSON.stringify(outputSchema, null, 2) : "");
  }, [nodeId, outputSchema]);

  const hasInvalidJson = text.trim() !== "" && !isValidOutputSchemaJson(text);

  return (
    <div className="space-y-1.5">
      <Textarea
        value={text}
        onChange={(e) => {
          const value = e.target.value;
          setText(value);
          if (!value.trim()) {
            onUpdate(nodeId, { ...nodeData, outputSchema: undefined });
            return;
          }
          if (isValidOutputSchemaJson(value)) {
            onUpdate(nodeId, {
              ...nodeData,
              outputSchema: JSON.parse(value) as unknown,
            });
          }
        }}
        placeholder='{"type": "object", "properties": {...}}'
        rows={4}
        className={cn(
          "font-mono text-xs",
          hasInvalidJson &&
            "border-amber-500 focus-visible:ring-amber-500 dark:border-amber-500",
        )}
        aria-invalid={hasInvalidJson}
      />
      {hasInvalidJson ? (
        <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-500">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>
            Invalid JSON — this schema will not be saved until it parses
            correctly.
          </span>
        </p>
      ) : null}
    </div>
  );
}

function NodeConfigPanel({
  node,
  agents,
  onUpdate,
}: {
  node: Node | null;
  agents: { id: string; name: string }[];
  onUpdate: (id: string, data: Record<string, unknown>) => void;
}) {
  if (!node) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-6 py-12">
        <Settings className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          Select a node to configure it
        </p>
      </div>
    );
  }

  if (node.type === "agent") {
    return (
      <div className="p-4 space-y-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Agent Node
        </p>
        <div className="space-y-1.5">
          <Label>Agent</Label>
          <Select
            value={(node.data.agentId as string) ?? ""}
            onValueChange={(v) => {
              const agent = agents.find((a) => a.id === v);
              onUpdate(node.id, {
                ...node.data,
                agentId: v,
                agentName: agent?.name ?? "Unknown",
              });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Pick an agent..." />
            </SelectTrigger>
            <SelectContent>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Task</Label>
          <Textarea
            value={(node.data.task as string) ?? ""}
            onChange={(e) =>
              onUpdate(node.id, { ...node.data, task: e.target.value })
            }
            placeholder="Describe what this agent should do..."
            rows={4}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Output Schema (JSON)</Label>
          <OutputSchemaField
            nodeId={node.id}
            nodeData={node.data}
            onUpdate={onUpdate}
          />
        </div>
      </div>
    );
  }

  if (node.type === "condition") {
    const ops: ConditionOp[] = [
      "equals",
      "not_equals",
      "contains",
      "gt",
      "gte",
      "lt",
      "lte",
      "between",
      "is_truthy",
      "matches",
    ];
    return (
      <div className="p-4 space-y-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Condition Node
        </p>
        <div className="space-y-1.5">
          <Label>Field</Label>
          <Input
            value={(node.data.field as string) ?? ""}
            onChange={(e) =>
              onUpdate(node.id, { ...node.data, field: e.target.value })
            }
            placeholder="result.score"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Operator</Label>
          <Select
            value={(node.data.op as string) ?? "equals"}
            onValueChange={(v) => onUpdate(node.id, { ...node.data, op: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ops.map((op) => (
                <SelectItem key={op} value={op}>
                  {op}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Value</Label>
          <Input
            value={String(node.data.value ?? "")}
            onChange={(e) =>
              onUpdate(node.id, { ...node.data, value: e.target.value })
            }
            placeholder="0.8"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          True branch → green handle | False branch → red handle
        </p>
      </div>
    );
  }

  if (node.type === "end") {
    return (
      <div className="p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          End Node
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          This node terminates the workflow.
        </p>
      </div>
    );
  }

  return null;
}

const DEFAULT_SCHEDULE_CRON = "0 9 * * MON-FRI";

function defaultTriggerConfig(
  type: TriggerType,
  workflowName: string,
): TriggerConfig {
  if (type === "manual") return { source: "manual" };
  if (type === "telegram_message") {
    return {
      source: "telegram",
      command: `/${snakeCase(workflowName)}`,
      helpText: `Run ${workflowName}`,
    };
  }
  return { source: "schedule", cron: DEFAULT_SCHEDULE_CRON };
}

// ─── Main Builder ─────────────────────────────────────────────────────────────

function WorkflowBuilder() {
  const { workflowId } = Route.useParams();
  const navigate = useNavigate();
  const isNew = workflowId === "new";

  const workflowQuery = useWorkflow(workflowId);
  const agentsQuery = useAgents();
  const createMutation = useCreateWorkflow();
  const updateMutation = useUpdateWorkflow(workflowId);
  const runMutation = useRunWorkflow();

  const [name, setName] = useState("Untitled Workflow");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState<TriggerType>("manual");
  const [triggerConfig, setTriggerConfig] = useState<TriggerConfig>({
    source: "manual",
  });
  const [maxSteps, setMaxSteps] = useState(25);
  const [isTemplate, setIsTemplate] = useState(false);

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node>([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const agentNameMap = useRef<Record<string, string>>({});

  const isBusy = createMutation.isPending || updateMutation.isPending;

  // Populate from existing workflow
  useEffect(() => {
    if (!isNew && workflowQuery.data && agentsQuery.data) {
      const wf = workflowQuery.data;
      setName(wf.name);
      setDescription(wf.description);
      setTriggerType(wf.triggerType);
      setTriggerConfig(wf.triggerConfig);
      setMaxSteps(wf.maxSteps);
      setIsTemplate(wf.isTemplate);

      const nameMap: Record<string, string> = {};
      for (const a of agentsQuery.data) nameMap[a.id] = a.name;
      agentNameMap.current = nameMap;

      setRfNodes(workflowNodesToFlow(wf.nodes, nameMap));
      setRfEdges(workflowEdgesToFlow(wf.edges));
    }
  }, [workflowQuery.data, agentsQuery.data, isNew]);

  // Keep agent name map updated
  useEffect(() => {
    if (agentsQuery.data) {
      const map: Record<string, string> = {};
      for (const a of agentsQuery.data) map[a.id] = a.name;
      agentNameMap.current = map;
    }
  }, [agentsQuery.data]);

  const onConnect = useCallback(
    (params: Connection) => {
      const edge: Edge = {
        ...params,
        id: `e-${params.source}-${params.target}-${params.sourceHandle ?? ""}`,
        markerEnd: { type: MarkerType.ArrowClosed },
        label: params.sourceHandle ?? undefined,
        style: {
          stroke:
            params.sourceHandle === "true"
              ? "#22c55e"
              : params.sourceHandle === "false"
                ? "#ef4444"
                : undefined,
        },
      };
      setRfEdges((eds) => addEdge(edge, eds));
    },
    [setRfEdges],
  );

  function addNode(type: "agent" | "condition" | "end") {
    const id = genId();
    const position = { x: 100 + rfNodes.length * 160, y: 150 };
    let newNode: Node;

    if (type === "agent") {
      newNode = {
        id,
        type,
        position,
        data: {
          agentId: "",
          agentName: "Agent",
          task: "",
          outputSchema: undefined,
        },
      };
    } else if (type === "condition") {
      newNode = {
        id,
        type,
        position,
        data: { field: "", op: "equals", value: "" },
      };
    } else {
      newNode = { id, type, position, data: {} };
    }
    setRfNodes((ns) => [...ns, newNode]);
  }

  function updateNodeData(id: string, data: Record<string, unknown>) {
    setRfNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data } : n)));
    setSelectedNode((prev) => (prev?.id === id ? { ...prev, data } : prev));
  }

  function handleTriggerTypeChange(type: TriggerType) {
    setTriggerType(type);
    setTriggerConfig(defaultTriggerConfig(type, name));
  }

  function validate(): string[] {
    const wfNodes = flowNodesToWorkflow(rfNodes);
    const wfEdges = flowEdgesToWorkflow(rfEdges);
    const issues: string[] = [];

    if (!name.trim()) issues.push("Workflow name is required");

    const result = WorkflowGraphSchema.superRefine(
      validateWorkflowGraph,
    ).safeParse({
      nodes: wfNodes,
      edges: wfEdges,
      entryNodeId: wfNodes[0]?.id,
      maxSteps,
    });

    if (!result.success) {
      issues.push(...result.error.issues.map((i) => i.message));
    }

    return issues;
  }

  async function handleSave() {
    const errors = validate();
    if (errors.length) {
      errors.forEach((e) => toast.error(e));
      return;
    }

    const wfNodes = flowNodesToWorkflow(rfNodes);
    const wfEdges = flowEdgesToWorkflow(rfEdges);
    const entryNodeId = wfNodes[0]!.id;
    const payload = {
      name: name.trim(),
      description,
      triggerType,
      triggerConfig,
      nodes: wfNodes,
      edges: wfEdges,
      entryNodeId,
      maxSteps,
      isTemplate,
    };

    if (isNew) {
      createMutation.mutate(payload, {
        onSuccess: (wf) => {
          toast.success("Workflow created");
          navigate({
            to: "/workflows/$workflowId",
            params: { workflowId: wf.id },
          });
        },
        onError: (err) => toast.error(err.message),
      });
    } else {
      updateMutation.mutate(payload, {
        onSuccess: () => toast.success("Workflow saved"),
        onError: (err) => toast.error(err.message),
      });
    }
  }

  function handleRun() {
    if (isNew) {
      toast.error("Save the workflow first");
      return;
    }
    runMutation.mutate(
      { id: workflowId },
      {
        onSuccess: (run) => {
          toast.success("Run started");
          navigate({ to: "/runs/$runId", params: { runId: run.id } });
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  const agents = (agentsQuery.data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
  }));

  if (!isNew && (workflowQuery.isLoading || agentsQuery.isLoading)) {
    return (
      <div className="flex-1 p-6 space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex min-h-0 flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="border-b bg-card px-4 py-2 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate({ to: "/workflows" })}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-8 w-52 font-semibold"
        />
        <Separator orientation="vertical" className="h-6" />
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={() => addNode("agent")}>
            <Bot className="h-3.5 w-3.5 mr-1" />+ Agent
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => addNode("condition")}
          >
            <GitMerge className="h-3.5 w-3.5 mr-1" />+ Cond
          </Button>
          <Button variant="outline" size="sm" onClick={() => addNode("end")}>
            <Square className="h-3.5 w-3.5 mr-1" />+ End
          </Button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {rfNodes.length} nodes
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const errors = validate();
              if (errors.length) errors.forEach((e) => toast.error(e));
              else toast.success("Graph is valid");
            }}
          >
            <CheckSquare className="h-3.5 w-3.5 mr-1.5" />
            Validate
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRun}
            disabled={isNew || runMutation.isPending}
          >
            <Play className="h-3.5 w-3.5 mr-1.5" />
            Run
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isBusy}>
            {isBusy ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-1.5" />
            )}
            Save
          </Button>
        </div>
      </div>

      {/* Canvas + Panel */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1">
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onNodeClick={(_, node) => setSelectedNode(node)}
            onPaneClick={() => setSelectedNode(null)}
            fitView
            deleteKeyCode="Delete"
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>

        {/* Right panel */}
        <div className="w-72 shrink-0 border-l bg-card flex flex-col min-h-0 overflow-hidden">
          <ScrollArea className="flex-1 min-h-0 h-full">
            <NodeConfigPanel
              node={selectedNode}
              agents={agents}
              onUpdate={updateNodeData}
            />
            {!selectedNode ? (
              <div className="p-4 space-y-4 border-t">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Workflow
                </p>
                <div className="space-y-1.5">
                  <Label className="text-xs">Description</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What does this workflow do?"
                    rows={2}
                    className="text-xs"
                  />
                  <FieldHint>
                    A short summary of what this workflow is for. It appears in
                    your workflow list so you can tell runs apart at a glance.
                  </FieldHint>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Trigger</Label>
                  <Select
                    value={triggerType}
                    onValueChange={(v) =>
                      handleTriggerTypeChange(v as TriggerType)
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="telegram_message">Telegram</SelectItem>
                      <SelectItem value="schedule">Schedule</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldHint>
                    How this workflow is started. Manual runs only from the Run
                    button or API. Telegram and Schedule start runs
                    automatically when configured.
                  </FieldHint>
                </div>
                {triggerType === "schedule" &&
                triggerConfig.source === "schedule" ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Cron expression</Label>
                    <Input
                      value={triggerConfig.cron}
                      onChange={(e) =>
                        setTriggerConfig({
                          source: "schedule",
                          cron: e.target.value,
                        })
                      }
                      className="h-8 font-mono text-xs"
                      placeholder={DEFAULT_SCHEDULE_CRON}
                    />
                    <FieldHint>
                      Standard cron syntax (minute, hour, day, month, weekday).
                      The worker checks about once a minute and starts this
                      workflow when the expression matches.
                    </FieldHint>
                  </div>
                ) : null}
                {triggerType === "telegram_message" &&
                triggerConfig.source === "telegram" ? (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Command</Label>
                      <Input
                        value={triggerConfig.command}
                        onChange={(e) =>
                          setTriggerConfig({
                            ...triggerConfig,
                            command: e.target.value,
                          })
                        }
                        className="h-8 font-mono text-xs"
                        placeholder="/my_workflow"
                      />
                      <FieldHint>
                        The slash command users type in Telegram (for example
                        /thesis). Must start with / and match what the worker
                        registers on startup.
                      </FieldHint>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Help text</Label>
                      <Input
                        value={triggerConfig.helpText}
                        onChange={(e) =>
                          setTriggerConfig({
                            ...triggerConfig,
                            helpText: e.target.value,
                          })
                        }
                        className="h-8 text-xs"
                        placeholder="Run my workflow"
                      />
                      <FieldHint>
                        Short description shown in Telegram’s command menu when
                        users tap / to see available commands.
                      </FieldHint>
                    </div>
                  </>
                ) : null}
                <div className="space-y-1.5">
                  <Label className="text-xs">Max Steps</Label>
                  <Input
                    type="number"
                    min={1}
                    max={200}
                    value={maxSteps}
                    onChange={(e) =>
                      setMaxSteps(parseInt(e.target.value) || 25)
                    }
                    className="h-7 text-xs"
                  />
                  <FieldHint>
                    The most node visits allowed in one run. Each time the
                    workflow moves to another step counts toward this limit,
                    which stops loops from running forever. Raise it for longer
                    paths or workflows that revisit earlier steps.
                  </FieldHint>
                </div>
              </div>
            ) : null}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
