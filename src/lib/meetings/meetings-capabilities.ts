/** Serialized on `GET /api/admin/meetings` for permission-aware UI (client-safe). */
export type MeetingsCapabilities = {
  isSchoolAdmin: boolean;
  canCreate: boolean;
  canInvite: boolean;
  canCancel: boolean;
  canEdit: boolean;
  canStart: boolean;
};
