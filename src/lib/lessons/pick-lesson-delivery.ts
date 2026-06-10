/** Pick the delivery row for a class; falls back to anchor session class then first row. */
export function pickLessonDeliveryForClass<T extends { classGroupId: unknown }>(
  deliveries: T[],
  sessionClassGroupId: unknown,
  requestedClassGroupId?: string | null,
): T | null {
  if (requestedClassGroupId) {
    const match = deliveries.find(
      (d) => String(d.classGroupId) === String(requestedClassGroupId),
    );
    if (match) return match;
  }
  return (
    deliveries.find((d) => String(d.classGroupId) === String(sessionClassGroupId)) ??
    deliveries[0] ??
    null
  );
}
