import { Prisma } from "../../generated/prisma/client.js";

export function parsePgArray(value: string | null): string[] {
  if (value === null) return [];
  const inner = value.replace(/^\{|\}$/g, "");
  if (inner === "") return [];
  return inner.split(",");
}

export function parseJson(value: string | null): Prisma.InputJsonValue {
  if (value === null) {
    throw new Error("parseJson: unexpected null (use optionalJson instead)");
  }
  return JSON.parse(value) as Prisma.InputJsonValue;
}

export function optionalJson(
  value: string | null,
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (value === null) return Prisma.DbNull;
  return JSON.parse(value) as Prisma.InputJsonValue;
}

export function parseDecimal(value: string | null): Prisma.Decimal {
  if (value === null) return new Prisma.Decimal(0);
  return new Prisma.Decimal(value);
}

export function parseDate(value: string | null): Date {
  if (value === null) throw new Error("Expected non-null timestamp");
  const normalized = value.includes("T")
    ? value
    : value.replace(" ", "T") + "Z";
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid timestamp: ${value}`);
  }
  return d;
}

export function parseOptionalDate(value: string | null): Date | null {
  if (value === null) return null;
  return parseDate(value);
}

export function parseString(value: string | null): string {
  if (value === null) throw new Error("Expected non-null string");
  return value;
}

export function parseOptionalString(value: string | null): string | null {
  return value;
}

export function parseIntField(value: string | null): number {
  if (value === null) throw new Error("Expected non-null integer");
  return Number.parseInt(value, 10);
}

export function parseBool(value: string | null): boolean {
  if (value === "t" || value === "true") return true;
  if (value === "f" || value === "false") return false;
  throw new Error(`Invalid boolean: ${value}`);
}
