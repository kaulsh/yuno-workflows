import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import { ArrowLeft, Save, Loader2, Plus, X } from "lucide-react";
import {
  useAgent,
  useCreateAgent,
  useUpdateAgent,
  useTools,
  useSkills,
  useModels,
} from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import type {
  Agent,
  CreateAgentInput,
  Channel,
  MemoryConfig,
  GuardrailsConfig,
  ModelId,
} from "@workspace/shared";
import { withInternalChannel } from "@/lib/agent-channels";

export const Route = createFileRoute("/agents/$agentId")({
  component: AgentForm,
});

/** Local form state: model is unset until the user picks one (or loads from server). */
type AgentFormState = Omit<CreateAgentInput, "model"> & {
  model: ModelId | null;
};

/** Managed by Memory / Channels settings — not shown in the Tools picker. */
const MEMORY_TOOLS = ["memory_recall", "memory_write"] as const;
const TELEGRAM_TOOL = "message_send_to_telegram";
const LOAD_SKILL_TOOL = "load_skill";
const DERIVED_TOOLS = new Set<string>([
  ...MEMORY_TOOLS,
  TELEGRAM_TOOL,
  LOAD_SKILL_TOOL,
]);

function stripDerivedTools(tools: string[]): string[] {
  return tools.filter((t) => !DERIVED_TOOLS.has(t));
}

function buildAgentTools(
  manualTools: string[],
  memory: MemoryConfig,
  channels: Channel[],
): string[] {
  const tools = new Set(stripDerivedTools(manualTools));
  if (memory.enabled) {
    for (const t of MEMORY_TOOLS) tools.add(t);
  }
  if (channels.includes("telegram")) {
    tools.add(TELEGRAM_TOOL);
  }
  return [...tools];
}

function FieldHint({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs text-muted-foreground leading-relaxed">{children}</p>
  );
}

const DEFAULT_FORM: AgentFormState = {
  name: "",
  role: "",
  systemPrompt: "",
  model: null,
  temperature: 0.7,
  maxOutputTokens: 2048,
  tools: [],
  skillIds: [],
  memory: {
    enabled: false,
    scope: "private",
    strategy: "recency",
    k: 5,
  },
  guardrails: {
    inputDenylist: [],
    outputDenylist: [],
    piiRedaction: false,
  },
  channels: ["internal"],
};

function agentToFormState(agent: Agent): AgentFormState {
  return {
    name: agent.name,
    role: agent.role,
    systemPrompt: agent.systemPrompt,
    model: agent.model,
    temperature: agent.temperature,
    maxOutputTokens: agent.maxOutputTokens,
    tools: stripDerivedTools(agent.tools),
    skillIds: agent.skillIds,
    memory: agent.memory,
    guardrails: agent.guardrails,
    channels: agent.channels,
  };
}

function AgentForm() {
  const { agentId } = Route.useParams();
  const navigate = useNavigate();
  const isNew = agentId === "new";

  const agentQuery = useAgent(agentId);
  const toolsQuery = useTools();
  const skillsQuery = useSkills();
  const modelsQuery = useModels();

  const createMutation = useCreateAgent();
  const updateMutation = useUpdateAgent(agentId);

  const [form, setForm] = useState<AgentFormState>(DEFAULT_FORM);
  const [denyInput, setDenyInput] = useState("");
  const [denyOutput, setDenyOutput] = useState("");
  /** Agent id whose data is currently loaded into `form` (edit mode). */
  const [hydratedAgentId, setHydratedAgentId] = useState<string | null>(null);

  useEffect(() => {
    setHydratedAgentId(null);
  }, [agentId]);

  useEffect(() => {
    if (isNew) {
      setForm(DEFAULT_FORM);
      setHydratedAgentId("new");
      return;
    }
    if (agentQuery.data) {
      setForm(agentToFormState(agentQuery.data));
      setHydratedAgentId(agentId);
    }
  }, [agentId, isNew, agentQuery.data]);

  const isBusy = createMutation.isPending || updateMutation.isPending;

  const availableModels = modelsQuery.data?.models ?? [];
  const hasAvailableModels = availableModels.length > 0;
  const availableModelIds = new Set(availableModels.map((m) => m.id));
  const modelInCatalog =
    form.model !== null && availableModelIds.has(form.model);
  const savedModelUnavailable =
    form.model !== null && hasAvailableModels && !modelInCatalog;
  /** Value bound to the model Select (must match a SelectItem). */
  const modelSelectValue = modelInCatalog ? form.model! : undefined;

  function patch(updates: Partial<AgentFormState>) {
    setForm((f) => ({ ...f, ...updates }));
  }

  function patchMemory(updates: Partial<MemoryConfig>) {
    setForm((f) => ({ ...f, memory: { ...f.memory, ...updates } }));
  }

  function patchGuardrails(updates: Partial<GuardrailsConfig>) {
    setForm((f) => ({ ...f, guardrails: { ...f.guardrails, ...updates } }));
  }

  function toggleSkill(id: string) {
    setForm((f) => ({
      ...f,
      skillIds: f.skillIds.includes(id)
        ? f.skillIds.filter((s) => s !== id)
        : [...f.skillIds, id],
    }));
  }

  function setTelegramChannel(enabled: boolean) {
    setForm((f) => ({
      ...f,
      channels: enabled
        ? withInternalChannel([...f.channels, "telegram"])
        : withInternalChannel(f.channels.filter((c) => c !== "telegram")),
    }));
  }

  function addDenyword(list: "inputDenylist" | "outputDenylist", word: string) {
    if (!word.trim()) return;
    patchGuardrails({
      [list]: [...form.guardrails[list], word.trim()],
    });
  }

  function removeDenyword(
    list: "inputDenylist" | "outputDenylist",
    idx: number,
  ) {
    patchGuardrails({
      [list]: form.guardrails[list].filter((_, i) => i !== idx),
    });
  }

  async function handleSubmit(e: React.SubmitEvent) {
    e.preventDefault();
    if (!modelSelectValue) {
      toast.error(
        availableModels.length === 0
          ? "No models are available. Set OPENAI_API_KEY and restart the API."
          : savedModelUnavailable
            ? "The saved model is no longer available. Select a configured model."
            : "Select a model before saving.",
      );
      return;
    }

    const channels = withInternalChannel(form.channels);
    const payload: CreateAgentInput = {
      ...form,
      model: modelSelectValue,
      channels,
      tools: buildAgentTools(form.tools, form.memory, channels),
    };

    if (isNew) {
      createMutation.mutate(payload, {
        onSuccess: (agent) => {
          toast.success("Agent created");
          navigate({ to: "/agents/$agentId", params: { agentId: agent.id } });
        },
        onError: (err) => toast.error(err.message),
      });
    } else {
      updateMutation.mutate(payload, {
        onSuccess: () => toast.success("Agent saved"),
        onError: (err) => toast.error(err.message),
      });
    }
  }

  const isFormHydrated = isNew
    ? hydratedAgentId === "new"
    : hydratedAgentId === agentId && !!agentQuery.data;

  if (
    !isNew &&
    (agentQuery.isLoading || !isFormHydrated || modelsQuery.isLoading)
  ) {
    return (
      <div className="flex-1 p-6 space-y-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 h-full">
      <form onSubmit={handleSubmit} className="p-6 space-y-6 max-w-3xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => navigate({ to: "/agents" })}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">
              {isNew ? "New Agent" : "Edit Agent"}
            </h1>
            {!isNew && (
              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                {agentId}
              </p>
            )}
          </div>
          <Button type="submit" disabled={isBusy || !modelSelectValue}>
            {isBusy ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1.5" />
            )}
            {isNew ? "Create" : "Save"}
          </Button>
        </div>

        {/* Identity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Identity</CardTitle>
            <CardDescription>
              Who this agent is and how it should behave on every workflow step.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="Research Analyst"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role">Role</Label>
              <Input
                id="role"
                value={form.role}
                onChange={(e) => patch({ role: e.target.value })}
                placeholder="Analyze market data and produce reports"
                required
              />
              <FieldHint>
                A short job title added to the agent's instructions so other
                steps know what it is responsible for.
              </FieldHint>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="systemPrompt">System Prompt</Label>
              <Textarea
                id="systemPrompt"
                value={form.systemPrompt}
                onChange={(e) => patch({ systemPrompt: e.target.value })}
                placeholder="You are a skilled research analyst..."
                rows={5}
              />
              <FieldHint>
                The main personality and rules this agent follows whenever it
                runs a task in a workflow.
              </FieldHint>
            </div>
          </CardContent>
        </Card>

        {/* Model */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Model</CardTitle>
            <CardDescription>
              The language model and generation settings used when this agent
              thinks and writes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              {modelsQuery.isLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : !hasAvailableModels ? (
                <div className="rounded-lg border border-dashed bg-muted/40 px-4 py-3 space-y-2">
                  <p className="text-sm font-medium">No models available</p>
                  <FieldHint>
                    Your server has not exposed any language models yet. An
                    administrator needs to add at least one provider API key
                    (OpenAI, Anthropic, or Google) and restart the API before
                    you can save this agent.
                  </FieldHint>
                  {form.model && savedModelUnavailable && (
                    <FieldHint>
                      This agent was saved with a model that is not available
                      right now. Pick a different model once providers are
                      configured.
                    </FieldHint>
                  )}
                </div>
              ) : (
                <>
                  <Label>Model</Label>
                  <div className="space-y-2">
                    {savedModelUnavailable && form.model && (
                      <p className="text-sm text-amber-700 dark:text-amber-500">
                        The model previously saved for this agent is no longer
                        available. Choose one from the list below.
                      </p>
                    )}
                    <Select
                      key={`${agentId}-${modelSelectValue ?? "empty"}`}
                      value={modelSelectValue}
                      onValueChange={(v) => patch({ model: v as ModelId })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a model…" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableModels.map((m) => (
                          <SelectItem
                            key={m.id}
                            value={m.id}
                            textValue={`${m.id} (${m.provider})`}
                          >
                            <span className="font-mono text-xs">{m.id}</span>
                            <span className="ml-2 text-muted-foreground text-xs">
                              ({m.provider})
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
            {hasAvailableModels && modelInCatalog && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Temperature</Label>
                    <span className="text-sm text-muted-foreground">
                      {form.temperature.toFixed(1)}
                    </span>
                  </div>
                  <Slider
                    min={0}
                    max={2}
                    step={0.1}
                    value={[form.temperature]}
                    onValueChange={([v]) => patch({ temperature: v })}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Precise</span>
                    <span>Creative</span>
                  </div>
                  <FieldHint>
                    Lower values favor consistent, focused answers; higher
                    values allow more varied and creative wording.
                  </FieldHint>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="maxOutputTokens">Max Output Tokens</Label>
                  <Input
                    id="maxOutputTokens"
                    type="number"
                    min={1}
                    max={128000}
                    value={form.maxOutputTokens}
                    onChange={(e) =>
                      patch({
                        maxOutputTokens: parseInt(e.target.value) || 2048,
                      })
                    }
                  />
                  <FieldHint>
                    Limits how long each reply can be and caps cost per step.
                    The agent cannot exceed this length in a single turn.
                  </FieldHint>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Tools */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Tools</CardTitle>
            <CardDescription>
              Optional actions the agent can take during a run, such as reading
              files or fetching web pages. Memory and Telegram abilities are
              turned on in their own sections below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {toolsQuery.isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              (() => {
                const selectableTools = (toolsQuery.data?.tools ?? []).filter(
                  (tool) => !DERIVED_TOOLS.has(tool.name),
                );
                return selectableTools.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No manually selectable tools. Memory and Telegram tools are
                    configured in their sections below.
                  </p>
                ) : (
                  <div className="divide-y rounded-lg border">
                    {selectableTools.map((tool) => {
                      const enabled = form.tools.includes(tool.name);
                      return (
                        <div
                          key={tool.name}
                          className="flex items-start justify-between gap-4 p-4"
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <Label
                              htmlFor={`tool-${tool.name}`}
                              className="text-sm font-medium leading-none"
                            >
                              {tool.name}
                            </Label>
                            <FieldHint>{tool.description}</FieldHint>
                          </div>
                          <Switch
                            id={`tool-${tool.name}`}
                            checked={enabled}
                            onCheckedChange={(checked) => {
                              setForm((f) => ({
                                ...f,
                                tools: checked
                                  ? [...f.tools, tool.name]
                                  : f.tools.filter((t) => t !== tool.name),
                              }));
                            }}
                            className="mt-0.5 shrink-0"
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            )}
          </CardContent>
        </Card>

        {/* Skills */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Skills</CardTitle>
            <CardDescription>
              Reusable playbooks whose instructions are added to this
              agent&apos;s prompt. Any tools a skill needs are included
              automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {skillsQuery.isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (skillsQuery.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No skills available. Create skills first.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(skillsQuery.data ?? []).map((skill) => {
                  const selected = form.skillIds.includes(skill.id);
                  return (
                    <Badge
                      key={skill.id}
                      variant={selected ? "default" : "outline"}
                      className="cursor-pointer select-none"
                      onClick={() => toggleSkill(skill.id)}
                    >
                      {skill.name}
                    </Badge>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Memory */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Memory</CardTitle>
            <CardDescription>
              Let this agent remember facts across runs and look them up when
              working on a task.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="memoryEnabled">Enable Memory</Label>
                <Switch
                  id="memoryEnabled"
                  checked={form.memory.enabled}
                  onCheckedChange={(v) => patchMemory({ enabled: v })}
                />
              </div>
              <FieldHint>
                {form.memory.enabled
                  ? "This agent can save and search memories on its own. Recall and write abilities are enabled automatically."
                  : "When turned on, the agent can store useful facts and surface relevant past notes at the start of each step."}
              </FieldHint>
            </div>
            {form.memory.enabled && (
              <>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Scope</Label>
                    <Select
                      value={form.memory.scope}
                      onValueChange={(v) =>
                        patchMemory({ scope: v as MemoryConfig["scope"] })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="private">Private</SelectItem>
                        <SelectItem value="shared">Shared</SelectItem>
                      </SelectContent>
                    </Select>
                    <FieldHint>
                      Private memories stay with this agent across all its runs.
                      Shared memories are visible to every agent in the same
                      workflow run.
                    </FieldHint>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Strategy</Label>
                    <Select
                      value={form.memory.strategy}
                      onValueChange={(v) =>
                        patchMemory({
                          strategy: v as MemoryConfig["strategy"],
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="recency">Recency</SelectItem>
                        <SelectItem value="semantic">Semantic</SelectItem>
                      </SelectContent>
                    </Select>
                    <FieldHint>
                      Semantic finds memories that match the meaning of the
                      current task. Recency uses the most recently saved
                      memories first.
                    </FieldHint>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="memoryK">Recall count (k)</Label>
                  <Input
                    id="memoryK"
                    type="number"
                    min={1}
                    max={50}
                    value={form.memory.k}
                    onChange={(e) =>
                      patchMemory({ k: parseInt(e.target.value) || 5 })
                    }
                  />
                  <FieldHint>
                    How many memories to pull in at the beginning of each step
                    and when the agent searches its memory during a run.
                  </FieldHint>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Guardrails */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Guardrails</CardTitle>
            <CardDescription>
              Safety checks applied before and after each model call for this
              agent.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="piiRedaction">PII Redaction</Label>
                <Switch
                  id="piiRedaction"
                  checked={form.guardrails.piiRedaction}
                  onCheckedChange={(v) => patchGuardrails({ piiRedaction: v })}
                />
              </div>
              <FieldHint>
                When enabled, emails, phone numbers, and similar personal
                details are masked in the agent&apos;s final reply before it is
                stored or passed on.
              </FieldHint>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Input Denylist</Label>
              <FieldHint>
                If the incoming message contains any of these words or phrases,
                the agent stops and returns a refusal instead of calling the
                model. Plain text or /regex/ patterns are supported.
              </FieldHint>
              <div className="flex gap-2">
                <Input
                  placeholder="Add word or phrase..."
                  value={denyInput}
                  onChange={(e) => setDenyInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addDenyword("inputDenylist", denyInput);
                      setDenyInput("");
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    addDenyword("inputDenylist", denyInput);
                    setDenyInput("");
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {form.guardrails.inputDenylist.map((w, i) => (
                  <Badge key={i} variant="secondary" className="gap-1">
                    {w}
                    <button
                      type="button"
                      onClick={() => removeDenyword("inputDenylist", i)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Output Denylist</Label>
              <FieldHint>
                If the agent&apos;s final answer contains any of these terms,
                that text is replaced with a refusal before the step completes.
              </FieldHint>
              <div className="flex gap-2">
                <Input
                  placeholder="Add word or phrase..."
                  value={denyOutput}
                  onChange={(e) => setDenyOutput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addDenyword("outputDenylist", denyOutput);
                      setDenyOutput("");
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    addDenyword("outputDenylist", denyOutput);
                    setDenyOutput("");
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {form.guardrails.outputDenylist.map((w, i) => (
                  <Badge key={i} variant="secondary" className="gap-1">
                    {w}
                    <button
                      type="button"
                      onClick={() => removeDenyword("outputDenylist", i)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Channels */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Channels</CardTitle>
            <CardDescription>
              Optional channels for reaching users outside workflow steps.
              Workflow agents always communicate with each other internally.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Switch
                  id="channel-telegram"
                  checked={form.channels.includes("telegram")}
                  onCheckedChange={setTelegramChannel}
                />
                <Label htmlFor="channel-telegram" className="capitalize">
                  Telegram
                </Label>
              </div>
              <FieldHint>
                {form.channels.includes("telegram")
                  ? "This agent can reply to the user in the Telegram chat that started the workflow. Sending to Telegram is enabled automatically."
                  : "When turned on, the agent can send updates back to the user's Telegram chat for workflows triggered from Telegram."}
              </FieldHint>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end pb-6">
          <Button
            type="submit"
            disabled={isBusy || !modelSelectValue}
            size="lg"
          >
            {isBusy ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1.5" />
            )}
            {isNew ? "Create Agent" : "Save Changes"}
          </Button>
        </div>
      </form>
    </ScrollArea>
  );
}
