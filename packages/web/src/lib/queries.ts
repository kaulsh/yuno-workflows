import {
  useMutation,
  useQuery,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";
import type {
  CreateAgentInput,
  CreateSkillInput,
  CreateWorkflowInput,
  CloneWorkflowInput,
  RunWorkflowInput,
  UpdateAgentInput,
  UpdateSkillInput,
  UpdateWorkflowInput,
} from "@workspace/shared";
import { api } from "./api";

export const keys = {
  agents: ["agents"] as const,
  agent: (id: string) => ["agents", id] as const,
  skills: ["skills"] as const,
  workflows: ["workflows"] as const,
  workflow: (id: string) => ["workflows", id] as const,
  runs: (params?: Record<string, string>) => ["runs", params ?? {}] as const,
  run: (id: string) => ["runs", id] as const,
  tools: ["tools"] as const,
  models: ["models"] as const,
};

export function useAgents() {
  return useQuery({ queryKey: keys.agents, queryFn: api.agents.list });
}

export function useAgent(id: string) {
  return useQuery({
    queryKey: keys.agent(id),
    queryFn: () => api.agents.get(id),
    enabled: id !== "new",
  });
}

export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAgentInput) => api.agents.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.agents }),
  });
}

export function useUpdateAgent(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateAgentInput) => api.agents.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.agents });
      qc.invalidateQueries({ queryKey: keys.agent(id) });
    },
  });
}

export function useDeleteAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.agents.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.agents }),
  });
}

export function useSkills() {
  return useQuery({ queryKey: keys.skills, queryFn: api.skills.list });
}

export function useCreateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSkillInput) => api.skills.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.skills }),
  });
}

export function useUpdateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSkillInput }) =>
      api.skills.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.skills }),
  });
}

export function useDeleteSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.skills.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.skills }),
  });
}

export function useWorkflows() {
  return useQuery({ queryKey: keys.workflows, queryFn: api.workflows.list });
}

export function useWorkflow(id: string) {
  return useQuery({
    queryKey: keys.workflow(id),
    queryFn: () => api.workflows.get(id),
    enabled: id !== "new",
  });
}

export function useCreateWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateWorkflowInput) => api.workflows.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.workflows }),
  });
}

export function useUpdateWorkflow(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateWorkflowInput) => api.workflows.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.workflows });
      qc.invalidateQueries({ queryKey: keys.workflow(id) });
    },
  });
}

export function useDeleteWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.workflows.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.workflows }),
  });
}

export function useRunWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data?: RunWorkflowInput;
    }) => api.workflows.run(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["runs"] }),
  });
}

export function useCloneWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CloneWorkflowInput }) =>
      api.workflows.clone(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.workflows }),
  });
}

export function useRuns(params?: {
  workflowId?: string;
  status?: string;
  limit?: number;
}) {
  return useInfiniteQuery({
    queryKey: keys.runs(params as Record<string, string>),
    queryFn: ({ pageParam }) =>
      api.runs.list({
        ...params,
        cursor: pageParam as string | undefined,
      }),
    getNextPageParam: (last) => last.nextCursor,
    initialPageParam: undefined as string | undefined,
  });
}

export function useRun(id: string) {
  return useQuery({
    queryKey: keys.run(id),
    queryFn: () => api.runs.get(id),
  });
}

export function useTools() {
  return useQuery({ queryKey: keys.tools, queryFn: api.tools.list });
}

export function useModels() {
  return useQuery({ queryKey: keys.models, queryFn: api.models.list });
}
