import { describe, expect, it } from "vitest";

import {
  evalCondition,
  evalConditionBranch,
  getField,
} from "./eval-condition.js";

const output = {
  score: 7,
  label: "hire",
  nested: { conviction: 8, note: "strong fit" },
  empty: "",
  zero: 0,
  flags: ["a", "b"],
};

describe("getField", () => {
  it("returns the root object for an empty path", () => {
    expect(getField(output, "")).toBe(output);
  });

  it("reads top-level and dot-path fields", () => {
    expect(getField(output, "score")).toBe(7);
    expect(getField(output, "nested.conviction")).toBe(8);
  });

  it("returns undefined for missing segments", () => {
    expect(getField(output, "missing")).toBeUndefined();
    expect(getField(output, "nested.missing")).toBeUndefined();
    expect(getField(output, "nested.conviction.extra")).toBeUndefined();
  });

  it("returns undefined when traversal hits null or a non-object", () => {
    expect(getField({ a: null }, "a.b")).toBeUndefined();
    expect(getField({ a: 1 }, "a.b")).toBeUndefined();
  });
});

describe("evalCondition", () => {
  it("equals uses loose equality for coercion", () => {
    expect(
      evalCondition({ field: "score", op: "equals", value: 7 }, output),
    ).toBe(true);
    expect(
      evalCondition({ field: "score", op: "equals", value: "7" }, output),
    ).toBe(true);
    expect(
      evalCondition({ field: "score", op: "equals", value: 8 }, output),
    ).toBe(false);
  });

  it("not_equals inverts loose equality", () => {
    expect(
      evalCondition({ field: "score", op: "not_equals", value: 8 }, output),
    ).toBe(true);
    expect(
      evalCondition({ field: "score", op: "not_equals", value: "7" }, output),
    ).toBe(false);
  });

  it("contains matches substrings on stringified values", () => {
    expect(
      evalCondition({ field: "label", op: "contains", value: "hi" }, output),
    ).toBe(true);
    expect(
      evalCondition({ field: "label", op: "contains", value: "fire" }, output),
    ).toBe(false);
    expect(
      evalCondition({ field: "missing", op: "contains", value: "x" }, output),
    ).toBe(false);
  });

  it("numeric comparisons coerce strings and booleans", () => {
    expect(
      evalCondition({ field: "score", op: "gt", value: 6 }, output),
    ).toBe(true);
    expect(
      evalCondition({ field: "score", op: "gte", value: 7 }, output),
    ).toBe(true);
    expect(
      evalCondition({ field: "score", op: "lt", value: 8 }, output),
    ).toBe(true);
    expect(
      evalCondition({ field: "score", op: "lte", value: 7 }, output),
    ).toBe(true);
    expect(
      evalCondition(
        { field: "nested.conviction", op: "gt", value: "7" },
        output,
      ),
    ).toBe(true);
  });

  it("numeric comparisons return false when coercion fails", () => {
    expect(
      evalCondition({ field: "label", op: "gt", value: 1 }, output),
    ).toBe(false);
  });

  it("between is inclusive on numeric bounds", () => {
    expect(
      evalCondition(
        { field: "nested.conviction", op: "between", value: [7, 9] },
        output,
      ),
    ).toBe(true);
    expect(
      evalCondition(
        { field: "nested.conviction", op: "between", value: [9, 10] },
        output,
      ),
    ).toBe(false);
    expect(
      evalCondition({ field: "score", op: "between", value: [1] }, output),
    ).toBe(false);
    expect(
      evalCondition({ field: "score", op: "between", value: "bad" }, output),
    ).toBe(false);
  });

  it("is_truthy treats falsy values correctly", () => {
    expect(
      evalCondition({ field: "score", op: "is_truthy", value: true }, output),
    ).toBe(true);
    expect(
      evalCondition({ field: "zero", op: "is_truthy", value: true }, output),
    ).toBe(false);
    expect(
      evalCondition({ field: "empty", op: "is_truthy", value: true }, output),
    ).toBe(false);
    expect(
      evalCondition({ field: "missing", op: "is_truthy", value: true }, output),
    ).toBe(false);
  });

  it("matches applies regex to stringified field values", () => {
    expect(
      evalCondition({ field: "label", op: "matches", value: "^hi" }, output),
    ).toBe(true);
    expect(
      evalCondition({ field: "label", op: "matches", value: "[" }, output),
    ).toBe(false);
  });
});

describe("evalConditionBranch", () => {
  it('returns "true" or "false" branch strings', () => {
    expect(
      evalConditionBranch(
        { field: "score", op: "gte", value: 7 },
        output,
      ),
    ).toBe("true");
    expect(
      evalConditionBranch(
        { field: "score", op: "lt", value: 5 },
        output,
      ),
    ).toBe("false");
  });
});
