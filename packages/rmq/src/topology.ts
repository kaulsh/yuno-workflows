/**
 * Named exchange constants used across publishers, subscribers, and the SSE
 * handler. Queue names, DLX exchange names, and DLX queue names are derived
 * automatically via the helpers in events.ts — no static topology declaration
 * function is needed.
 *
 * Topology is brought up lazily:
 *   - Durable queues: asserted by executeEventSubscriber on worker startup.
 *   - run.events: asserted by assertRunEventsExchange (publish + SSE).
 *   - Publisher exchanges: asserted inline wherever a publish channel is
 *     created (see api/src/main.ts).
 */
export const EX_WORKFLOW_START = "workflow.start";
export const EX_WORKFLOW_STEPS = "workflow.steps";
export const EX_RUN_EVENTS = "run.events";
