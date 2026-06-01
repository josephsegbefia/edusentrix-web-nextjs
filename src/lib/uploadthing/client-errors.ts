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
        : null;

  if (error.message === "Failed to run middleware" && cause) {
    return cause;
  }

  return error.message || "Upload failed";
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
