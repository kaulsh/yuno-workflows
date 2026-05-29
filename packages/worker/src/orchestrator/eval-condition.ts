import { logger, type ConditionExpression, type ConditionOp } from "@workspace/shared";

/**
 * Safely resolves a dot-path field from a plain object.
 * Returns `undefined` if any segment is missing.
 * e.g. getField({ a: { b: 3 } }, "a.b") → 3
 */
export function getField(obj: unknown, path: string): unknown {
  if (path === "") return obj;
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

/**
 * Coerces a value to a number for numeric comparisons.
 * Returns NaN if coercion fails.
 */
function toNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseFloat(v);
  if (typeof v === "boolean") return v ? 1 : 0;
  return NaN;
}

/**
 * Evaluates a ConditionExpression against an output object.
 * Returns true when the condition is satisfied.
 *
 * All comparisons are evaluated at the *field* value from the predecessor output;
 * no eval() is used — tiny safe evaluator (§11).
 */
export function evalCondition(
  expression: ConditionExpression,
  predecessorOutput: Record<string, unknown>,
): boolean {
  const raw = getField(predecessorOutput, expression.field);
  const op: ConditionOp = expression.op;
  const val = expression.value;

  switch (op) {
    case "equals":
      return raw == val; // intentional loose equality for type coercion (string "7" == 7)

    case "not_equals":
      return raw != val;

    case "contains": {
      const str = String(raw ?? "");
      return str.includes(String(val));
    }

    case "gt":
      return toNum(raw) > toNum(val);

    case "gte":
      return toNum(raw) >= toNum(val);

    case "lt":
      return toNum(raw) < toNum(val);

    case "lte":
      return toNum(raw) <= toNum(val);

    case "between": {
      if (!Array.isArray(val) || val.length !== 2) return false;
      const n = toNum(raw);
      const [lo, hi] = val as [number, number];
      return n >= lo && n <= hi;
    }

    case "is_truthy":
      return Boolean(raw);

    case "matches": {
      try {
        const re = new RegExp(String(val));
        return re.test(String(raw ?? ""));
      } catch {
        return false;
      }
    }

    default: {
      // TypeScript exhaustiveness guard
      const _: never = op;
      logger.warn({ op: String(_) }, "[eval-condition] unknown op");
      return false;
    }
  }
}

/** Convenience alias — returns "true" | "false" branch string */
export function evalConditionBranch(
  expression: ConditionExpression,
  predecessorOutput: Record<string, unknown>,
): "true" | "false" {
  return evalCondition(expression, predecessorOutput) ? "true" : "false";
}
