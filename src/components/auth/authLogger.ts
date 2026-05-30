/**
 * Lightweight client-side logging for failed authentication attempts.
 * Captures stable error codes/status without leaking raw backend copy to users.
 */
export interface AuthErrorLog {
  event: string;
  code?: string;
  status?: number;
  name?: string;
  message?: string;
  field?: string | null;
  timestamp: string;
}

function extractCode(error: unknown): Pick<AuthErrorLog, "code" | "status" | "name" | "message"> {
  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;
    return {
      code: typeof e.code === "string" ? e.code : undefined,
      status: typeof e.status === "number" ? e.status : undefined,
      name: typeof e.name === "string" ? e.name : undefined,
      message: typeof e.message === "string" ? e.message : undefined,
    };
  }
  return { message: typeof error === "string" ? error : undefined };
}

/** Log a failed auth attempt (e.g. signup) with its error code for debugging. */
export function logAuthError(
  event: string,
  error: unknown,
  field?: string | null,
): AuthErrorLog {
  const entry: AuthErrorLog = {
    event,
    ...extractCode(error),
    field: field ?? null,
    timestamp: new Date().toISOString(),
  };
  console.error("[auth]", event, entry);
  return entry;
}
