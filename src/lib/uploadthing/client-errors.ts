type UploadThingClientError = {
  message?: string;
  cause?: unknown;
};

/**
 * UploadThing wraps file-router middleware failures as "Failed to run middleware"
 * and puts the real message on error.cause.
 */
export function getUploadThingErrorMessage(error: UploadThingClientError): string {
  const cause =
    error.cause instanceof Error
      ? error.cause.message
      : typeof error.cause === "string"
        ? error.cause
        : error.cause &&
            typeof error.cause === "object" &&
            "message" in error.cause &&
            typeof (error.cause as { message?: unknown }).message === "string"
          ? String((error.cause as { message: string }).message)
          : null;

  if (cause) {
    return cause;
  }

  if (error.message && error.message !== "Failed to run middleware") {
    return error.message;
  }

  return "Upload failed";
}

export function logUploadThingClientError(
  context: string,
  error: UploadThingClientError
): void {
  const message = getUploadThingErrorMessage(error);
  console.error(`[uploadthing] ${context}:`, {
    message,
    rawMessage: error.message,
    cause: error.cause,
  });
}
