import { useEffect, useReducer } from "react";
import {
  RunEventSchema,
  RunSnapshotSchema,
  type RunEvent,
  type RunSnapshot,
  type StoredRunEvent,
  type WorkflowStep,
} from "@workspace/shared";

function storedEventKey(event: StoredRunEvent): string {
  return JSON.stringify(event);
}

/** Apply a live SSE event onto the current snapshot so step/run UI stays in sync. */
function applyEventToSnapshot(
  snapshot: RunSnapshot,
  event: StoredRunEvent,
): RunSnapshot {
  switch (event.type) {
    case "step.started": {
      const idx = snapshot.steps.findIndex((s) => s.id === event.stepId);
      const steps =
        idx >= 0
          ? snapshot.steps.map((s, i) =>
              i === idx ? { ...s, status: "running" as const } : s,
            )
          : [
              ...snapshot.steps,
              {
                id: event.stepId,
                runId: event.runId,
                stepIndex: snapshot.steps.length,
                nodeId: event.nodeId,
                nodeType: "agent" as const,
                agentId: event.agentId ?? null,
                status: "running" as const,
                startedAt: event.at,
              } satisfies WorkflowStep,
            ];
      const run =
        snapshot.run.status === "pending"
          ? { ...snapshot.run, status: "running" as const }
          : snapshot.run;
      return { ...snapshot, run, steps };
    }

    case "step.completed": {
      const steps = snapshot.steps.map((s) =>
        s.id === event.stepId
          ? {
              ...s,
              status: "completed" as const,
              output: event.output,
              completedAt: event.at,
            }
          : s,
      );
      return { ...snapshot, steps };
    }

    case "step.failed": {
      let steps = snapshot.steps;
      if (event.stepId) {
        steps = snapshot.steps.map((s) =>
          s.id === event.stepId
            ? {
                ...s,
                status: "failed" as const,
                error: event.error,
                completedAt: event.at,
              }
            : s,
        );
      }
      const run =
        event.stepId == null
          ? {
              ...snapshot.run,
              status: "failed" as const,
              error: event.error,
              completedAt: event.at,
            }
          : snapshot.run;
      return { ...snapshot, run, steps };
    }

    case "run.completed": {
      const run = {
        ...snapshot.run,
        status: "completed" as const,
        completedAt: event.at,
        totalCostUsd: event.totalCostUsd,
      };
      return { ...snapshot, run };
    }

    default:
      return snapshot;
  }
}

type StreamState = {
  snapshot: RunSnapshot | null;
  events: RunEvent[];
  activeNodeId: string | null;
  connected: boolean;
  error: string | null;
};

type Action =
  | { type: "SNAPSHOT"; payload: RunSnapshot }
  | { type: "EVENT"; payload: RunEvent }
  | { type: "CONNECTED" }
  | { type: "ERROR"; payload: string }
  | { type: "CLOSED" };

function reducer(state: StreamState, action: Action): StreamState {
  switch (action.type) {
    case "CONNECTED":
      return { ...state, connected: true, error: null };

    case "ERROR":
      return { ...state, error: action.payload, connected: false };

    case "CLOSED":
      return { ...state, connected: false };

    case "SNAPSHOT": {
      const payload = RunSnapshotSchema.parse(action.payload);
      const runningStep = payload.steps.find((s) => s.status === "running");

      return {
        ...state,
        snapshot: payload,
        events: payload.events,
        activeNodeId: runningStep?.nodeId ?? state.activeNodeId,
      };
    }

    case "EVENT": {
      const event = action.payload;
      if (event.type === "snapshot") return state;

      const key = storedEventKey(event);
      if (
        state.events.some(
          (e) => e.type !== "snapshot" && storedEventKey(e) === key,
        )
      ) {
        return state;
      }

      const newEvents = [...state.events, event];
      let activeNodeId = state.activeNodeId;

      if (event.type === "step.started") {
        activeNodeId = event.nodeId;
      } else if (
        event.type === "step.completed" ||
        event.type === "step.failed" ||
        event.type === "run.completed"
      ) {
        activeNodeId = null;
      }

      const snapshot = state.snapshot
        ? applyEventToSnapshot(state.snapshot, event)
        : state.snapshot;

      return { ...state, events: newEvents, activeNodeId, snapshot };
    }

    default:
      return state;
  }
}

const initialState: StreamState = {
  snapshot: null,
  events: [],
  activeNodeId: null,
  connected: false,
  error: null,
};

export function useRunStream(runId: string) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    if (!runId) return;

    const es = new EventSource(`/api/runs/${runId}/stream`);

    es.onopen = () => dispatch({ type: "CONNECTED" });

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as unknown;
        const event = RunEventSchema.parse(data);

        if (event.type === "snapshot") {
          dispatch({
            type: "SNAPSHOT",
            payload: RunSnapshotSchema.parse(event.payload),
          });
        } else {
          dispatch({ type: "EVENT", payload: event });
        }
      } catch {
        // ignore malformed frames
      }
    };

    es.onerror = () => {
      dispatch({ type: "ERROR", payload: "Stream disconnected" });
      es.close();
    };

    return () => {
      es.close();
      dispatch({ type: "CLOSED" });
    };
  }, [runId]);

  return state;
}
