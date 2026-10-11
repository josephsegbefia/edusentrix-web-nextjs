import mongoose from "mongoose";

/**
 * Shared helpers for approval decision routes.
 *
 * Decision routes must change state with one conditional write scoped to the
 * school and the eligible status, so that at most one concurrent decision wins.
 * Error bodies carry a stable `code` that mobile clients can rely on.
 */

/** Responses that follow these rules carry this version so clients can tell them apart from older ones. */
export const APPROVAL_CONTRACT_VERSION = 2;

export type DecisionErrorCode =
  | "invalid_id"
  | "not_found"
  | "stale_decision"
  | "maker_checker_required"
  | "not_a_leave_request"
  | "reason_required"
  | "invalid_body";

const STATUS_BY_CODE: Record<DecisionErrorCode, number> = {
  invalid_id: 400,
  not_found: 404,
  stale_decision: 409,
  maker_checker_required: 409,
  not_a_leave_request: 409,
  reason_required: 400,
  invalid_body: 400,
};

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

/** Accepts only a 24-character hex id, so a malformed id never reaches a query. */
export function parseObjectId(value: unknown): mongoose.Types.ObjectId | null {
  if (typeof value !== "string" || !OBJECT_ID_PATTERN.test(value)) {
    return null;
  }
  return new mongoose.Types.ObjectId(value);
}

export function toObjectId(value: unknown): mongoose.Types.ObjectId {
  if (value instanceof mongoose.Types.ObjectId) {
    return value;
  }
  return new mongoose.Types.ObjectId(String(value));
}

export function decisionError(
  code: DecisionErrorCode,
  error: string,
  extra?: Record<string, unknown>
): Response {
  return Response.json(
    { success: false, error, code, contractVersion: APPROVAL_CONTRACT_VERSION, ...extra },
    { status: STATUS_BY_CODE[code] }
  );
}

/** Reads a JSON object body. Returns `{}` for an empty body and null for anything that is not an object. */
export async function readJsonObject(req: Request): Promise<Record<string, unknown> | null> {
  let text: string;
  try {
    text = await req.text();
  } catch {
    return null;
  }
  if (!text.trim()) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Runs a handler and returns a thrown `Response` (from an auth guard) unchanged.
 * Any other error becomes a JSON 500 without internal details.
 */
export async function withDecisionErrors(
  handler: () => Promise<Response>,
  failureMessage: string
): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    console.error(failureMessage, error instanceof Error ? error.message : "unknown error");
    return Response.json({ success: false, error: failureMessage }, { status: 500 });
  }
}
