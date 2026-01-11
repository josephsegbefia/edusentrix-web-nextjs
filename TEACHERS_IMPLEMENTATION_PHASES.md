# Teachers Implementation Phases

This document outlines the phased implementation plan for completing the Teachers Management System. Each phase will be implemented from backend to frontend, with testing and approval required before proceeding to the next phase.

**Design Patterns to Follow**:
- Premium UI matching existing students/teachers pages
- Use `useBusyToast` for all async operations
- Use SSE where appropriate (real-time updates)
- Follow existing modal/component patterns
- Maintain URL state sync
- Use React Query for data fetching
- Activity logging for all mutations

---

## PHASE 1: Edit Teacher Functionality ⚠️ CRITICAL

**Priority**: CRITICAL (Edit button exists but non-functional)

**Scope**:
- Enable editing teacher information from the detail page and list page

**Backend**:
1. `PATCH /api/admin/teachers/:id` - Update teacher endpoint
   - Update User (firstName, lastName, email, phone, photoUrl)
   - Update Teacher (status, employeeId, department, hireDate, terminationDate, maxClasses, maxStudents, emergencyContact, qualifications, notes, tags)
   - Validate status transitions
   - Activity logging
   - Return updated teacher data

**Schema**:
- Create `UpdateTeacherSchema` in `src/schemas/teacher.ts` (similar to CreateTeacherSchema but all fields optional)

**Frontend**:
1. `useUpdateTeacher` hook in `src/hooks/admin/useTeachers.ts`
   - Mutation with optimistic updates
   - Query invalidation
   - Error handling

2. `EditTeacherModal` component in `src/components/modals/EditTeacherModal.tsx`
   - Multi-step form (same as CreateTeacherModal)
   - Pre-populate with existing teacher data
   - Edit: personal info, professional info, assignments
   - Use busy toast for submission
   - Match premium UI design

3. Wire up `EditTeacherModal`:
   - `TeacherRowActions` - "Edit details" button opens modal
   - `TeacherOverviewTab` - Add edit button in quick actions
   - Pass teacher data to modal

**Testing Points**:
- Edit all fields
- Validate email uniqueness
- Status transitions (active ↔ inactive)
- Activity logging
- UI matches CreateTeacherModal design

**Estimated Time**: 2-3 hours

---

## PHASE 2: Edit Assignment Functionality

**Priority**: HIGH (Can create/delete but not edit)

**Scope**:
- Enable editing existing teacher assignments

**Backend**:
1. `PATCH /api/admin/teachers/assignments/:id` - Update assignment endpoint
   - Update: subjectId, classGroupId, academicPeriodId, schedule, status, startDate, endDate, notes
   - Validate: assignment exists, period active, subject/class belong to school
   - Conflict detection (same teacher, same period, same subject/class)
   - Activity logging

**Schema**:
- Create `UpdateTeacherAssignmentSchema` in `src/schemas/teacher.ts`

**Frontend**:
1. `useUpdateAssignment` hook in `src/hooks/admin/useTeacherAssignments.ts`
   - Mutation with optimistic updates
   - Query invalidation

2. `EditTeacherAssignmentModal` component in `src/components/admin/teachers/detail/EditTeacherAssignmentModal.tsx`
   - Pre-populate with existing assignment data
   - Edit: subject, class, period, schedule, dates, notes
   - Show conflict warnings if detected
   - Use busy toast
   - Match CreateTeacherAssignmentModal design

3. Wire up in `TeacherAssignmentsTab`:
   - Add edit button to each assignment card/row
   - Open EditTeacherAssignmentModal on click

**Testing Points**:
- Edit assignment details
- Conflict detection
- Period validation
- Activity logging

**Estimated Time**: 2 hours

---

## PHASE 3: Teacher Status Management (Activate/Deactivate/Delete)

**Priority**: HIGH

**Scope**:
- Add activate, deactivate, and delete functionality

**Backend**:
1. `POST /api/admin/teachers/:id/activate` - Activate teacher
   - Set status to "active"
   - Clear terminationDate if exists
   - Activity logging

2. `POST /api/admin/teachers/:id/deactivate` - Deactivate teacher
   - Set status to "inactive"
   - Activity logging

3. `DELETE /api/admin/teachers/:id` - Soft delete teacher
   - Set status to "terminated"
   - Set terminationDate to current date
   - Optionally: remove from active assignments
   - Activity logging

**Frontend**:
1. Hooks in `src/hooks/admin/useTeachers.ts`:
   - `useActivateTeacher()` - Mutation hook
   - `useDeactivateTeacher()` - Mutation hook
   - `useDeleteTeacher()` - Mutation hook (with confirmation dialog)

2. Update `TeacherRowActions`:
   - Add "Activate" option (when inactive/terminated)
   - Add "Deactivate" option (when active)
   - Add "Delete" option (with confirmation dialog)
   - Use busy toast for all actions

3. Update `TeacherOverviewTab`:
   - Add status change buttons in quick actions
   - Show appropriate actions based on current status

**Testing Points**:
- Status transitions work correctly
- Termination date set on delete
- Confirmation dialog for delete
- Activity logging
- UI updates immediately

**Estimated Time**: 1.5 hours

---

## PHASE 4: Subject & Homeroom Management

**Priority**: MEDIUM

**Scope**:
- Direct subject assignment (separate from class assignments)
- Homeroom assignment/removal

**Backend**:
1. `GET /api/admin/teachers/:id/subjects` - Get teacher's subjects (separate endpoint)
2. `POST /api/admin/teachers/:id/subjects` - Add subject to teacher
   - Add subjectId to Teacher.subjectIds array
   - Validate subject exists and is active
   - Activity logging
3. `DELETE /api/admin/teachers/:id/subjects/:subjectId` - Remove subject
   - Remove from subjectIds array
   - Don't delete historical assignments
   - Activity logging
4. `GET /api/admin/teachers/subjects/:subjectId` - Get all teachers teaching a subject
5. `GET /api/admin/teachers/:id/homeroom` - Get homeroom (separate endpoint)
6. `POST /api/admin/teachers/:id/homeroom` - Assign homeroom
   - Set homeroomClassGroupId
   - Update ClassGroup.homeroomTeacherId
   - Validate: class belongs to school, class doesn't already have homeroom
   - Activity logging
7. `DELETE /api/admin/teachers/:id/homeroom` - Remove homeroom
   - Clear homeroomClassGroupId
   - Clear ClassGroup.homeroomTeacherId
   - Activity logging

**Frontend**:
1. Hooks in `src/hooks/admin/useTeachers.ts`:
   - `useTeacherSubjects(teacherId)` - Query hook
   - `useAssignSubject()` - Mutation hook
   - `useRemoveSubject()` - Mutation hook
   - `useTeachersBySubject(subjectId)` - Query hook
   - `useTeacherHomeroom(teacherId)` - Query hook
   - `useAssignHomeroom()` - Mutation hook
   - `useRemoveHomeroom()` - Mutation hook

2. Modals:
   - `AssignSubjectModal` - Select and assign subject
   - `AssignHomeroomModal` - Select and assign homeroom class

3. Update `TeacherOverviewTab`:
   - Show subject badges with remove buttons
   - Show homeroom with remove button
   - Add "Assign Subject" and "Assign Homeroom" buttons

**Testing Points**:
- Subject assignment/removal
- Homeroom assignment/removal
- Validation (class already has homeroom, etc.)
- Activity logging
- UI updates immediately

**Estimated Time**: 3 hours

---

## PHASE 5: Attendance Management

**Priority**: MEDIUM

**Scope**:
- Record teacher attendance
- Manage leave requests

**Backend**:
1. `GET /api/admin/teachers/:id/attendance` - Get attendance records
   - Query params: startDate, endDate, status
   - Pagination
2. `POST /api/admin/teachers/:id/attendance` - Record attendance
   - Create TeacherAttendance record
   - Validate: date, status, leaveType if applicable
   - Activity logging
3. `PATCH /api/admin/teachers/attendance/:id` - Update attendance
   - Update status, times, leave details
   - Activity logging
4. `GET /api/admin/teachers/:id/leave-requests` - Get leave requests
5. `POST /api/admin/teachers/:id/leave-requests` - Submit leave request
   - Create attendance record with pending approval
6. `PATCH /api/admin/teachers/leave-requests/:id/approve` - Approve leave
7. `PATCH /api/admin/teachers/leave-requests/:id/reject` - Reject leave

**Frontend**:
1. Hooks in `src/hooks/admin/useTeacherAttendance.ts`:
   - `useTeacherAttendance(teacherId, filters)` - Query hook
   - `useRecordAttendance()` - Mutation hook
   - `useUpdateAttendance()` - Mutation hook
   - `useLeaveRequests(teacherId)` - Query hook
   - `useSubmitLeaveRequest()` - Mutation hook
   - `useApproveLeave()` - Mutation hook
   - `useRejectLeave()` - Mutation hook

2. Components:
   - `TeacherAttendanceTab` - Full implementation (replace placeholder)
     - Calendar view of attendance
     - List view of attendance records
     - Leave requests section
   - `RecordAttendanceModal` - Record attendance form
   - `SubmitLeaveRequestModal` - Leave request form

**Testing Points**:
- Record attendance (present, absent, late, etc.)
- Submit leave requests
- Approve/reject leave
- Calendar view shows correct status
- Activity logging

**Estimated Time**: 4-5 hours

---

## PHASE 6: Document Management

**Priority**: MEDIUM

**Scope**:
- Upload and manage teacher documents
- Track document expiry

**Backend**:
1. `GET /api/admin/teachers/:id/documents` - Get documents
   - Filter by type, category
   - Sort by expiryDate (expiring first)
2. `POST /api/admin/teachers/:id/documents` - Upload document
   - Upload to Cloudinary
   - Create TeacherDocument record
   - Validate: file type, size
   - Activity logging
3. `GET /api/admin/teachers/:id/documents/:docId` - Get document (download)
4. `DELETE /api/admin/teachers/:id/documents/:docId` - Delete document
   - Delete from Cloudinary
   - Delete record
   - Activity logging
5. `GET /api/admin/teachers/documents/expiring` - Get expiring documents (all teachers)
   - Query params: daysAhead (default 30)

**Frontend**:
1. Hooks in `src/hooks/admin/useTeacherDocuments.ts`:
   - `useTeacherDocuments(teacherId)` - Query hook
   - `useUploadDocument()` - Mutation hook
   - `useDeleteDocument()` - Mutation hook
   - `useExpiringDocuments()` - Query hook

2. Components:
   - `TeacherDocumentsTab` - Full implementation (replace placeholder)
     - Document list with expiry indicators
     - Upload button
     - Document cards with download/delete
   - `UploadDocumentModal` - Document upload form
     - File upload (Cloudinary)
     - Document type, category, description
     - Issue/expiry dates

**Testing Points**:
- Upload documents (various types)
- View documents
- Delete documents
- Expiry alerts/indicators
- Activity logging

**Estimated Time**: 3-4 hours

---

## PHASE 7: Notes Management

**Priority**: MEDIUM

**Scope**:
- Internal notes about teachers
- Confidential notes

**Backend**:
1. `GET /api/admin/teachers/:id/notes` - Get notes
   - Filter by category
   - Sort by createdAt (newest first)
   - Respect isConfidential (only admins see confidential)
2. `POST /api/admin/teachers/:id/notes` - Create note
   - Validate: title, content, category
   - Set createdBy from auth
   - Activity logging
3. `PATCH /api/admin/teachers/:id/notes/:noteId` - Update note
   - Only allow update by creator or admin
   - Activity logging
4. `DELETE /api/admin/teachers/:id/notes/:noteId` - Delete note
   - Only allow delete by creator or admin
   - Activity logging

**Frontend**:
1. Hooks in `src/hooks/admin/useTeacherNotes.ts`:
   - `useTeacherNotes(teacherId)` - Query hook
   - `useCreateNote()` - Mutation hook
   - `useUpdateNote()` - Mutation hook
   - `useDeleteNote()` - Mutation hook

2. Components:
   - `TeacherNotesTab` - Full implementation (replace placeholder)
     - Notes list with categories
     - Confidential indicators
     - Add/edit/delete notes
   - `AddNoteModal` - Create note form
   - `EditNoteModal` - Edit note form (or reuse AddNoteModal)

**Testing Points**:
- Create notes (all categories)
- Edit notes (permissions)
- Delete notes (permissions)
- Confidential notes visibility
- Activity logging

**Estimated Time**: 2-3 hours

---

## PHASE 8: Performance Tab

**Priority**: LOW

**Scope**:
- Performance metrics and evaluations

**Backend**:
1. `GET /api/admin/teachers/:id/performance` - Get performance metrics
   - Calculate from student outcomes
   - Average grade, pass rate, attendance rate
   - Period-based
2. `GET /api/admin/teachers/:id/performance/:periodId` - Get performance for specific period
3. `POST /api/admin/teachers/:id/performance` - Record evaluation
   - Create TeacherPerformance record
   - Validate: evaluationType, overallRating (1-5)
   - Activity logging
4. `GET /api/admin/teachers/:id/evaluations` - Get evaluation history

**Frontend**:
1. Hooks in `src/hooks/admin/useTeacherPerformance.ts`:
   - `useTeacherPerformance(teacherId, periodId?)` - Query hook
   - `useCreateEvaluation()` - Mutation hook
   - `useTeacherEvaluations(teacherId)` - Query hook

2. Components:
   - `TeacherPerformanceTab` - Full implementation (replace placeholder)
     - Performance metrics cards (average grade, pass rate, attendance)
     - Performance charts (trends over time)
     - Evaluations list
     - Add evaluation form

**Testing Points**:
- Performance metrics calculation
- Record evaluations
- View evaluation history
- Performance charts
- Activity logging

**Estimated Time**: 4-5 hours

---

## PHASE 9: Activity Log Tab

**Priority**: LOW

**Scope**:
- Display activity log for teacher

**Backend**:
1. Use existing Activity model
2. `GET /api/admin/teachers/:id/activity` - Get activity log
   - Query params: page, limit, type
   - Sort by createdAt (newest first)

**Frontend**:
1. Hook in `src/hooks/admin/useTeacherActivity.ts`:
   - `useTeacherActivity(teacherId, filters)` - Query hook

2. Components:
   - `TeacherActivityTab` - Full implementation (replace placeholder)
     - Activity timeline/list
     - Filter by activity type
     - Show user, action, timestamp

**Testing Points**:
- Activity log shows all teacher-related activities
- Filtering works
- Pagination works
- Timestamps correct

**Estimated Time**: 1-2 hours

---

## PHASE 10: Bulk Operations

**Priority**: LOW

**Scope**:
- Bulk actions for teachers

**Backend**:
1. `POST /api/admin/teachers/bulk-assign-subjects` - Bulk assign subjects
   - Body: { teacherIds: string[], subjectIds: string[] }
   - Validate all teachers and subjects
   - Activity logging for each
2. `POST /api/admin/teachers/bulk-assign-classes` - Bulk assign classes (via assignments)
3. `POST /api/admin/teachers/bulk-change-status` - Bulk change status
   - Body: { teacherIds: string[], status: TeacherStatus }
   - Validate status transitions
   - Activity logging
4. `POST /api/admin/teachers/bulk-export` - Export teachers (CSV/Excel)
   - Include all teacher fields
   - Filter by current list filters

**Frontend**:
1. Wire up existing `TeachersBulkActionsBar`:
   - Connect to backend endpoints
   - Add confirmation dialogs
   - Show progress for bulk operations
   - Use busy toast

**Testing Points**:
- Bulk assign subjects
- Bulk assign classes
- Bulk change status
- Export CSV/Excel
- Confirmation dialogs
- Progress indicators

**Estimated Time**: 2-3 hours

---

## PHASE 11: CSV Import & Reports

**Priority**: LOW

**Scope**:
- Bulk import teachers from CSV
- Reports and analytics

**Backend**:
1. `POST /api/admin/teachers/bulk-create` - Bulk create from CSV
   - Parse CSV file
   - Validate all rows
   - Create teachers (with Clerk invitations)
   - Return summary (successful, failed with errors)
2. `GET /api/admin/teachers/reports/workload` - Workload distribution report
3. `GET /api/admin/teachers/reports/assignments` - Assignment report
4. `GET /api/admin/teachers/reports/performance` - Performance summary
5. `GET /api/admin/teachers/reports/attendance` - Attendance summary

**Frontend**:
1. CSV Import:
   - Add "Import CSV" button to teachers page
   - CSV upload modal with template download
   - Show import progress and results
2. Reports:
   - Reports page/section
   - Charts and tables for each report type

**Testing Points**:
- CSV import with validation
- Error handling for invalid rows
- Reports display correctly
- Charts render properly

**Estimated Time**: 4-5 hours

---

## PHASE 12: Workload Visualization & Warnings

**Priority**: LOW

**Scope**:
- Visual workload indicators
- Workload warnings

**Backend**:
- Workload calculation already exists in assignment creation
- Add endpoint: `GET /api/admin/teachers/:id/workload` - Get workload metrics
  - Current classes count
  - Current students count
  - Max capacity (if set)
  - Comparison to school average

**Frontend**:
1. Workload visualization in `TeacherOverviewTab`:
   - Workload chart/indicator
   - Capacity indicators (progress bars)
   - Warnings if over capacity or significantly above average
2. Workload warnings in assignment modals:
   - Show warning before creating/editing if would exceed capacity

**Testing Points**:
- Workload calculation accurate
- Visualizations display correctly
- Warnings show at right thresholds

**Estimated Time**: 2-3 hours

---

## Summary

**Total Phases**: 12
**Total Estimated Time**: 30-40 hours

**Priority Breakdown**:
- CRITICAL: 1 phase (Phase 1)
- HIGH: 2 phases (Phase 2, 3)
- MEDIUM: 4 phases (Phase 4, 5, 6, 7)
- LOW: 5 phases (Phase 8, 9, 10, 11, 12)

**Recommended Order**:
1. Phase 1 (CRITICAL - Edit Teacher)
2. Phase 2 (HIGH - Edit Assignment)
3. Phase 3 (HIGH - Status Management)
4. Phase 4 (MEDIUM - Subject & Homeroom)
5. Phase 5 (MEDIUM - Attendance)
6. Phase 6 (MEDIUM - Documents)
7. Phase 7 (MEDIUM - Notes)
8. Phase 8-12 (LOW - Performance, Activity, Bulk, Reports, Workload)

---

**Note**: Each phase will be implemented completely (backend → frontend → testing) before moving to the next phase. User approval required after each phase.
