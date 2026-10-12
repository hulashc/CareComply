// Errors that map straight to an HTTP response. Pure (no framework imports) so the planner can
// throw them too.

export class RosterError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
    /** Extra fields merged into the JSON response, e.g. { issues: [...] }. */
    readonly body: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "RosterError";
  }
}

// Database errors raised by migration 023 look like 'ROSTER_<CODE>: message'.
const STATUS_BY_CODE: Record<string, number> = {
  NOT_FOUND: 404,
  CAPACITY: 409,
  NOT_STAFFED: 409,
  NOT_DELETABLE: 409,
  ORG_MISMATCH: 400,
  BAD_REQUEST: 400,
};

/** Translate a Postgres / PostgREST error into a client-safe RosterError. */
export function fromDbError(err: { message?: string; code?: string }): RosterError {
  const message = err.message ?? "";
  const m = /^ROSTER_([A-Z_]+):\s*([\s\S]*)$/.exec(message);
  if (m) return new RosterError(m[2] || "Request rejected", STATUS_BY_CODE[m[1]] ?? 400);
  switch (err.code) {
    case "23505":
      return new RosterError("That conflicts with an existing record", 409);
    case "23503":
      return new RosterError("A referenced record does not exist", 400);
    case "23514":
      return new RosterError("The values violate a rule of the roster", 400);
  }
  // Anything else is unexpected: keep the detail in the server log, not in the response.
  console.error("[roster] database error:", message, err.code ?? "");
  return new RosterError("Database error", 500);
}
