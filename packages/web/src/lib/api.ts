import type {
  Agent,
  AvailableModel,
  CloneWorkflowInput,
  CreateAgentInput,
  CreateSkillInput,
  CreateWorkflowInput,
  RunSnapshot,
  RunWorkflowInput,
  Skill,
  ToolInfo,
  UpdateAgentInput,
  UpdateSkillInput,
  UpdateWorkflowInput,
  Workflow,
  WorkflowRun,
} from "@workspace/shared";

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = body?.error?.message ?? res.statusText;
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  agents: {
    list: (): Promise<Agent[]> => request("/agents"),
    get: (id: string): Promise<Agent> => request(`/agents/${id}`),
    create: (data: CreateAgentInput): Promise<Agent> =>
      request("/agents", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: UpdateAgentInput): Promise<Agent> =>
      request(`/agents/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: string): Promise<void> =>
      request(`/agents/${id}`, { method: "DELETE" }),
  },

  skills: {
    list: (): Promise<Skill[]> => request("/skills"),
    create: (data: CreateSkillInput): Promise<Skill> =>
      request("/skills", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: UpdateSkillInput): Promise<Skill> =>
      request(`/skills/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: string): Promise<void> =>
      request(`/skills/${id}`, { method: "DELETE" }),
  },

  workflows: {
    list: (): Promise<Workflow[]> => request("/workflows"),
    get: (id: string): Promise<Workflow> => request(`/workflows/${id}`),
    create: (data: CreateWorkflowInput): Promise<Workflow> =>
      request("/workflows", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: UpdateWorkflowInput): Promise<Workflow> =>
      request(`/workflows/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: string): Promise<void> =>
      request(`/workflows/${id}`, { method: "DELETE" }),
    run: (id: string, data?: RunWorkflowInput): Promise<WorkflowRun> =>
      request(`/workflows/${id}/run`, {
        method: "POST",
        body: JSON.stringify(data ?? {}),
      }),
    clone: (id: string, data: CloneWorkflowInput): Promise<Workflow> =>
      request(`/workflows/${id}/clone`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  runs: {
    list: (params?: {
      workflowId?: string;
      status?: string;
      cursor?: string;
      limit?: number;
    }): Promise<{ runs: WorkflowRun[]; nextCursor?: string }> => {
      const search = new URLSearchParams();
      if (params?.workflowId) search.set("workflowId", params.workflowId);
      if (params?.status) search.set("status", params.status);
      if (params?.cursor) search.set("cursor", params.cursor);
      if (params?.limit) search.set("limit", String(params.limit));
      const qs = search.toString();
      return request(`/runs${qs ? `?${qs}` : ""}`);
    },
    get: (id: string): Promise<RunSnapshot> => request(`/runs/${id}`),
  },

  tools: {
    list: (): Promise<{ tools: ToolInfo[] }> => request("/tools"),
  },

  models: {
    list: (): Promise<{ models: AvailableModel[] }> => request("/models"),
  },
};
