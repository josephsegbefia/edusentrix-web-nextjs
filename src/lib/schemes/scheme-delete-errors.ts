export const SCHEME_LINKED_LESSON_NOTES_CODE = "SCHEME_LINKED_LESSON_NOTES" as const;

export type SchemeDeleteApiError = Error & {
  code?: string;
  linkedLessonNoteCount?: number;
};

export function isSchemeLinkedLessonNotesError(
  error: unknown,
): error is SchemeDeleteApiError {
  return (
    error instanceof Error &&
    (error as SchemeDeleteApiError).code === SCHEME_LINKED_LESSON_NOTES_CODE
  );
}

export function parseSchemeDeleteResponse(json: unknown, fallbackMessage: string): SchemeDeleteApiError {
  const payload = json as {
    error?: string;
    code?: string;
    linkedLessonNoteCount?: number;
  } | null;
  const err = new Error(payload?.error || fallbackMessage) as SchemeDeleteApiError;
  err.code = payload?.code;
  err.linkedLessonNoteCount = payload?.linkedLessonNoteCount;
  return err;
}
