export function serializeCommunication(doc: any) {
  return {
    id: String(doc._id),
    schoolId: String(doc.schoolId),
    type: doc.type,
    status: doc.status,
    priority: doc.priority,
    title: doc.title,
    bodyHtml: doc.bodyHtml,
    bodyText: doc.bodyText,
    channels: doc.channels,
    audience: doc.audience,
    createdByUserId: doc.createdByUserId ? String(doc.createdByUserId) : null,
    scheduledFor: doc.scheduledFor ? new Date(doc.scheduledFor).toISOString() : null,
    sentAt: doc.sentAt ? new Date(doc.sentAt).toISOString() : null,
    allowReplies: Boolean(doc.allowReplies),
    actionUrl: doc.actionUrl ?? null,
    stats: doc.stats ?? null,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
  };
}
