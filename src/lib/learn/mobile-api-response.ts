import { NextResponse } from "next/server";

export type MobileApiSuccess<T> = {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
};

export type MobileApiFailure = {
  success: false;
  error: {
    code: string;
    message: string;
    friendlyMessage?: string;
    details?: unknown;
  };
};

export function mobileApiSuccess<T>(
  data: T,
  init?: ResponseInit,
  meta?: Record<string, unknown>
) {
  const body: MobileApiSuccess<T> = { success: true, data, ...(meta ? { meta } : {}) };
  return NextResponse.json(body, init);
}

export function mobileApiFailure(
  input: {
    code: string;
    message: string;
    friendlyMessage?: string;
    status?: number;
    details?: unknown;
  }
) {
  const body: MobileApiFailure = {
    success: false,
    error: {
      code: input.code,
      message: input.message,
      friendlyMessage: input.friendlyMessage,
      details: input.details,
    },
  };
  return NextResponse.json(body, { status: input.status ?? 400 });
}
