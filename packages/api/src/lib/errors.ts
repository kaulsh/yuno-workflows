import { logger } from "@workspace/shared";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import z, { ZodError } from "zod";

export function apiError(
  code: string,
  message: string,
  status: ContentfulStatusCode,
  details?: unknown,
): never {
  throw new HTTPException(status, {
    message,
    res: Response.json(
      {
        error: { code, message, ...(details !== undefined ? { details } : {}) },
      },
      { status },
    ),
  });
}

export function notFound(resource: string): never {
  apiError("not_found", `${resource} not found`, 404);
}

export function conflict(message: string): never {
  apiError("conflict", message, 409);
}

export function badRequest(message: string, details?: unknown): never {
  apiError("validation_error", message, 400, details);
}

export function handleRouteError(c: Context, err: unknown): Response {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  if (err instanceof ZodError) {
    return c.json(
      {
        error: {
          code: "validation_error",
          message: "Request validation failed",
          details: z.treeifyError(err)
        },
      },
      400,
    );
  }
  const code =
    err && typeof err === "object" && "code" in err ? String(err.code) : "";
  if (code === "P2025") {
    return c.json(
      { error: { code: "not_found", message: "Resource not found" } },
      404,
    );
  }
  if (code === "P2002") {
    return c.json(
      { error: { code: "conflict", message: "Unique constraint violated" } },
      409,
    );
  }
  logger.error(err, "[api] unhandled error");
  return c.json(
    { error: { code: "internal_error", message: "Internal server error" } },
    500,
  );
}
