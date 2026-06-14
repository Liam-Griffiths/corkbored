import { AuthError } from "./authz";
import { ZodError } from "zod";

export function apiError(e: unknown): Response {
  if (e instanceof AuthError) {
    return Response.json({ error: e.message }, { status: e.status });
  }
  if (e instanceof ZodError) {
    return Response.json({ error: e.flatten() }, { status: 422 });
  }
  console.error(e);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
