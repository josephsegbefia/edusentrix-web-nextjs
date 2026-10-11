// Test-only replacement for @/lib/lesson-notes/notifications: records calls instead of sending.
function record(kind, input) {
  globalThis.__approvalNotifications ??= [];
  globalThis.__approvalNotifications.push({ kind, input });
}

async function resolveSchoolAdminUserIds() {
  return [];
}
async function notifySchoolAdminsLessonNoteSubmitted(input) {
  record("submitted", input);
}
async function notifyTeacherLessonNoteApproved(input) {
  record("approved", input);
}
async function notifyTeacherLessonNoteRejected(input) {
  record("rejected", input);
}
async function notifyTeacherLessonNoteReviewComment(input) {
  record("review_comment", input);
}

module.exports = {
  resolveSchoolAdminUserIds,
  notifySchoolAdminsLessonNoteSubmitted,
  notifyTeacherLessonNoteApproved,
  notifyTeacherLessonNoteRejected,
  notifyTeacherLessonNoteReviewComment,
};
