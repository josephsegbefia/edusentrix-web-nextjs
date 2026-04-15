/**
 * School-scoped collection registry for deterministic sandbox reset.
 *
 * Each entry maps a Mongoose model name to the field that references the
 * sandbox school, plus an explicit delete and seed ordering.  Lower
 * `deleteOrder` values are deleted first (leaf collections before roots).
 * Lower `seedOrder` values are seeded first (roots before leaves).
 *
 * This registry is code — not Mongo data — so it can be tested and versioned
 * with the app.  It is the single source of truth for which collections must
 * be wiped and repopulated when a demo sandbox is recycled.
 */

export type CollectionRegistryEntry = {
  /** Mongoose model name (matches the string passed to `mongoose.model()`). */
  modelName: string;
  /** The document field that holds the sandbox school ObjectId. */
  schoolIdField: string;
  /** Lower = deleted first.  Leaf data before parent data. */
  deleteOrder: number;
  /** Lower = seeded first.  Parent data before leaf data. */
  seedOrder: number;
  /** Human note — what this collection holds in the context of a demo. */
  description: string;
};

/**
 * Ordered registry of every school-scoped collection that participates in
 * sandbox provisioning and reset.
 *
 * Collections not listed here are either platform-global (e.g.
 * `SubscriptionTier`, `BankBranch`) or not relevant to the demo experience.
 *
 * The ordering intentionally places FK-leaf collections (votes, comments,
 * allocations, events) before their parents so deletes don't leave orphans
 * during the brief reset window.
 */
export const DEMO_SCOPED_COLLECTIONS: readonly CollectionRegistryEntry[] = [
  // ── Tier 0: event / log / metric leaves ──────────────────────────
  { modelName: "DemoEvent",              schoolIdField: "schoolId", deleteOrder: 0,  seedOrder: 99, description: "Demo telemetry events" },
  { modelName: "Activity",               schoolIdField: "schoolId", deleteOrder: 1,  seedOrder: 98, description: "Generic activity log" },
  { modelName: "TeacherActivity",         schoolIdField: "schoolId", deleteOrder: 1,  seedOrder: 98, description: "Teacher activity log" },
  { modelName: "PaymentAuditEvent",       schoolIdField: "schoolId", deleteOrder: 1,  seedOrder: 98, description: "Payment audit log" },
  { modelName: "TimetableChangeLog",      schoolIdField: "schoolId", deleteOrder: 1,  seedOrder: 98, description: "Timetable change log" },
  { modelName: "UsageMetric",             schoolIdField: "schoolId", deleteOrder: 1,  seedOrder: 98, description: "Usage metrics" },
  { modelName: "CalendarReminderLog",     schoolIdField: "schoolId", deleteOrder: 1,  seedOrder: 98, description: "Calendar reminder log" },
  { modelName: "Notification",            schoolIdField: "schoolId", deleteOrder: 1,  seedOrder: 98, description: "In-app notifications" },
  { modelName: "InvoiceEvent",            schoolIdField: "schoolId", deleteOrder: 1,  seedOrder: 98, description: "Invoice lifecycle events" },
  { modelName: "EmailEvent",              schoolIdField: "schoolId", deleteOrder: 1,  seedOrder: 98, description: "Email delivery events" },

  // ── Tier 1: community / poll leaves ──────────────────────────────
  { modelName: "CommunityPollVote",       schoolIdField: "schoolId", deleteOrder: 2,  seedOrder: 95, description: "Poll votes" },
  { modelName: "CommunityPollComment",    schoolIdField: "schoolId", deleteOrder: 2,  seedOrder: 95, description: "Poll comments" },
  { modelName: "CommunityPoll",           schoolIdField: "schoolId", deleteOrder: 3,  seedOrder: 55, description: "Community polls" },
  { modelName: "FundraisingDonation",     schoolIdField: "schoolId", deleteOrder: 2,  seedOrder: 95, description: "Fundraising donations" },
  { modelName: "FundraisingPayout",       schoolIdField: "schoolId", deleteOrder: 2,  seedOrder: 95, description: "Fundraising payouts" },
  { modelName: "FundraisingCampaignUpdate", schoolIdField: "schoolId", deleteOrder: 2, seedOrder: 95, description: "Campaign updates" },
  { modelName: "FundraisingCampaign",     schoolIdField: "schoolId", deleteOrder: 3,  seedOrder: 54, description: "Fundraising campaigns" },

  // ── Tier 2: academic leaves ──────────────────────────────────────
  { modelName: "Submission",              schoolIdField: "schoolId", deleteOrder: 4,  seedOrder: 90, description: "Homework submissions" },
  { modelName: "Homework",                schoolIdField: "schoolId", deleteOrder: 5,  seedOrder: 60, description: "Homework assignments" },
  { modelName: "SubjectGrade",            schoolIdField: "schoolId", deleteOrder: 4,  seedOrder: 70, description: "Subject grades" },
  { modelName: "Grade",                   schoolIdField: "schoolId", deleteOrder: 4,  seedOrder: 70, description: "Grade records" },
  { modelName: "StudentAttendance",       schoolIdField: "schoolId", deleteOrder: 4,  seedOrder: 65, description: "Student attendance" },
  { modelName: "TeacherAttendance",       schoolIdField: "schoolId", deleteOrder: 4,  seedOrder: 65, description: "Teacher/staff attendance" },
  { modelName: "TermResult",              schoolIdField: "schoolId", deleteOrder: 4,  seedOrder: 85, description: "Term results" },
  { modelName: "PeriodReport",            schoolIdField: "schoolId", deleteOrder: 4,  seedOrder: 85, description: "Period reports" },
  { modelName: "ReportExport",            schoolIdField: "schoolId", deleteOrder: 4,  seedOrder: 92, description: "Report exports" },
  { modelName: "ReportVerification",      schoolIdField: "schoolId", deleteOrder: 4,  seedOrder: 92, description: "Report verification codes" },
  { modelName: "Assessment",              schoolIdField: "schoolId", deleteOrder: 5,  seedOrder: 58, description: "Assessments" },

  // ── Tier 3: lesson notes ─────────────────────────────────────────
  { modelName: "LessonNoteReviewComment", schoolIdField: "schoolId", deleteOrder: 5,  seedOrder: 80, description: "Lesson note review comments" },
  { modelName: "LessonNoteApproval",      schoolIdField: "schoolId", deleteOrder: 5,  seedOrder: 80, description: "Lesson note approvals" },
  { modelName: "LessonNote",              schoolIdField: "schoolId", deleteOrder: 6,  seedOrder: 50, description: "Lesson notes" },

  // ── Tier 4: finance leaves ───────────────────────────────────────
  { modelName: "Payment",                 schoolIdField: "schoolId", deleteOrder: 6,  seedOrder: 72, description: "Payments" },
  { modelName: "PaymentIntent",           schoolIdField: "schoolId", deleteOrder: 6,  seedOrder: 90, description: "Payment intents" },
  { modelName: "PaymentReferenceCounter", schoolIdField: "schoolId", deleteOrder: 6,  seedOrder: 90, description: "Payment ref counter" },
  { modelName: "StudentCreditBalance",    schoolIdField: "schoolId", deleteOrder: 6,  seedOrder: 90, description: "Student credit balances" },
  { modelName: "Invoice",                 schoolIdField: "schoolId", deleteOrder: 7,  seedOrder: 45, description: "Invoices" },
  { modelName: "FeeStructure",            schoolIdField: "schoolId", deleteOrder: 8,  seedOrder: 30, description: "Fee structures" },
  { modelName: "CashClosure",             schoolIdField: "schoolId", deleteOrder: 6,  seedOrder: 90, description: "Cash closures" },
  { modelName: "FinancialTransaction",    schoolIdField: "schoolId", deleteOrder: 6,  seedOrder: 90, description: "Financial transactions" },
  { modelName: "SchoolExpense",           schoolIdField: "schoolId", deleteOrder: 6,  seedOrder: 90, description: "School expenses" },
  { modelName: "ExpenseCategory",         schoolIdField: "schoolId", deleteOrder: 7,  seedOrder: 35, description: "Expense categories" },
  { modelName: "Budget",                  schoolIdField: "schoolId", deleteOrder: 7,  seedOrder: 40, description: "Budgets" },
  { modelName: "SchoolDisbursement",      schoolIdField: "schoolId", deleteOrder: 6,  seedOrder: 90, description: "Disbursements" },
  { modelName: "Vendor",                  schoolIdField: "schoolId", deleteOrder: 7,  seedOrder: 35, description: "Vendors" },
  { modelName: "ReconciliationAlert",     schoolIdField: "schoolId", deleteOrder: 5,  seedOrder: 95, description: "Recon alerts" },
  { modelName: "ReconciliationIngestion", schoolIdField: "schoolId", deleteOrder: 5,  seedOrder: 95, description: "Recon ingestions" },
  { modelName: "ReconciliationRun",       schoolIdField: "schoolId", deleteOrder: 5,  seedOrder: 95, description: "Recon runs" },
  { modelName: "ReconciliationSession",   schoolIdField: "schoolId", deleteOrder: 5,  seedOrder: 95, description: "Recon sessions" },

  // ── Tier 5: timetable ────────────────────────────────────────────
  { modelName: "TimetableSlot",           schoolIdField: "schoolId", deleteOrder: 8,  seedOrder: 55, description: "Timetable slots" },
  { modelName: "TimetableConflict",       schoolIdField: "schoolId", deleteOrder: 8,  seedOrder: 90, description: "Timetable conflicts" },
  { modelName: "TimetableVersion",        schoolIdField: "schoolId", deleteOrder: 9,  seedOrder: 40, description: "Timetable versions" },

  // ── Tier 6: email / messaging ────────────────────────────────────
  { modelName: "EmailMessage",            schoolIdField: "schoolId", deleteOrder: 8,  seedOrder: 90, description: "Email messages" },
  { modelName: "EmailThread",             schoolIdField: "schoolId", deleteOrder: 9,  seedOrder: 90, description: "Email threads" },
  { modelName: "EmailBatch",              schoolIdField: "schoolId", deleteOrder: 8,  seedOrder: 90, description: "Email batches" },
  { modelName: "EmailDispatchJob",        schoolIdField: "schoolId", deleteOrder: 8,  seedOrder: 90, description: "Email dispatch jobs" },
  { modelName: "EmailPreference",         schoolIdField: "schoolId", deleteOrder: 8,  seedOrder: 90, description: "Email preferences" },
  { modelName: "EmailSuppression",        schoolIdField: "schoolId", deleteOrder: 8,  seedOrder: 90, description: "Email suppressions" },
  { modelName: "Message",                 schoolIdField: "schoolId", deleteOrder: 8,  seedOrder: 90, description: "Messages" },
  { modelName: "MessageThread",           schoolIdField: "schoolId", deleteOrder: 9,  seedOrder: 90, description: "Message threads" },
  { modelName: "Notice",                  schoolIdField: "schoolId", deleteOrder: 8,  seedOrder: 55, description: "Notices" },
  { modelName: "Escalation",              schoolIdField: "schoolId", deleteOrder: 8,  seedOrder: 90, description: "Escalations" },

  // ── Tier 7: people ───────────────────────────────────────────────
  { modelName: "TeacherAssignment",       schoolIdField: "schoolId", deleteOrder: 10, seedOrder: 25, description: "Teacher-subject assignments" },
  { modelName: "TeacherComment",          schoolIdField: "schoolId", deleteOrder: 10, seedOrder: 90, description: "Teacher comments" },
  { modelName: "TeacherDocument",         schoolIdField: "schoolId", deleteOrder: 10, seedOrder: 90, description: "Teacher documents" },
  { modelName: "TeacherDutyAssignment",   schoolIdField: "schoolId", deleteOrder: 10, seedOrder: 90, description: "Duty assignments" },
  { modelName: "TeacherNote",             schoolIdField: "schoolId", deleteOrder: 10, seedOrder: 90, description: "Teacher notes" },
  { modelName: "TeacherPerformance",      schoolIdField: "schoolId", deleteOrder: 10, seedOrder: 90, description: "Teacher performance" },
  { modelName: "TeacherPermission",       schoolIdField: "schoolId", deleteOrder: 10, seedOrder: 90, description: "Teacher permissions" },
  { modelName: "TeacherResource",         schoolIdField: "schoolId", deleteOrder: 10, seedOrder: 90, description: "Teacher resources" },
  { modelName: "TeacherSettings",         schoolIdField: "schoolId", deleteOrder: 10, seedOrder: 90, description: "Teacher settings" },
  { modelName: "Teacher",                 schoolIdField: "schoolId", deleteOrder: 11, seedOrder: 15, description: "Teacher records" },
  { modelName: "StudentClassRole",        schoolIdField: "schoolId", deleteOrder: 10, seedOrder: 90, description: "Student class roles" },
  { modelName: "SchoolStudentRole",       schoolIdField: "schoolId", deleteOrder: 10, seedOrder: 90, description: "School student roles" },
  { modelName: "Student",                 schoolIdField: "schoolId", deleteOrder: 11, seedOrder: 15, description: "Student records" },
  { modelName: "Invitation",              schoolIdField: "schoolId", deleteOrder: 10, seedOrder: 90, description: "Invitations" },
  { modelName: "Invite",                  schoolIdField: "schoolId", deleteOrder: 10, seedOrder: 90, description: "Legacy invites" },

  // ── Tier 8: promotions ───────────────────────────────────────────
  { modelName: "PromotionDecision",       schoolIdField: "schoolId", deleteOrder: 10, seedOrder: 90, description: "Promotion decisions" },
  { modelName: "PromotionExecutionLog",   schoolIdField: "schoolId", deleteOrder: 10, seedOrder: 90, description: "Promotion execution logs" },
  { modelName: "PromotionCycle",          schoolIdField: "schoolId", deleteOrder: 11, seedOrder: 55, description: "Promotion cycles" },
  { modelName: "PromotionPolicy",         schoolIdField: "schoolId", deleteOrder: 12, seedOrder: 50, description: "Promotion policies" },

  // ── Tier 9: structural / config ──────────────────────────────────
  { modelName: "Subject",                 schoolIdField: "schoolId", deleteOrder: 13, seedOrder: 12, description: "Subjects" },
  { modelName: "ClassGroup",              schoolIdField: "schoolId", deleteOrder: 13, seedOrder: 10, description: "Class groups" },
  { modelName: "ClassRoleDefinition",     schoolIdField: "schoolId", deleteOrder: 12, seedOrder: 50, description: "Class role definitions" },
  { modelName: "Rubric",                  schoolIdField: "schoolId", deleteOrder: 12, seedOrder: 50, description: "Rubrics" },
  { modelName: "GradingScale",            schoolIdField: "schoolId", deleteOrder: 12, seedOrder: 20, description: "Grading scales" },
  { modelName: "ReportTemplate",          schoolIdField: "schoolId", deleteOrder: 12, seedOrder: 22, description: "Report templates" },
  { modelName: "AcademicCalendarEvent",   schoolIdField: "schoolId", deleteOrder: 12, seedOrder: 28, description: "Calendar events" },
  { modelName: "AcademicCalendar",        schoolIdField: "schoolId", deleteOrder: 13, seedOrder: 8,  description: "Academic calendar" },
  { modelName: "AcademicPeriod",          schoolIdField: "schoolId", deleteOrder: 13, seedOrder: 7,  description: "Academic periods (terms)" },
  { modelName: "SchoolSettings",          schoolIdField: "schoolId", deleteOrder: 14, seedOrder: 5,  description: "School settings" },
  { modelName: "SchoolSubscription",      schoolIdField: "schoolId", deleteOrder: 14, seedOrder: 5,  description: "School subscription" },
  { modelName: "ProvisioningJob",         schoolIdField: "schoolId", deleteOrder: 14, seedOrder: 90, description: "Provisioning jobs" },

  // ── Tier 10: AI caches ───────────────────────────────────────────
  { modelName: "AICachedInsight",         schoolIdField: "schoolId", deleteOrder: 15, seedOrder: 95, description: "AI cached insights" },
  { modelName: "AIFeatureCache",          schoolIdField: "schoolId", deleteOrder: 15, seedOrder: 95, description: "AI feature cache" },
  { modelName: "AIFeatureUsageEvent",     schoolIdField: "schoolId", deleteOrder: 15, seedOrder: 95, description: "AI usage events" },
  { modelName: "AIInsightCache",          schoolIdField: "schoolId", deleteOrder: 15, seedOrder: 95, description: "AI insight cache" },

  // ── Tier 11: identity (User, Membership — deleted last, seeded first) ──
  { modelName: "UserMembership",          schoolIdField: "schoolId", deleteOrder: 16, seedOrder: 4,  description: "User-school memberships" },
  { modelName: "User",                    schoolIdField: "schoolId", deleteOrder: 17, seedOrder: 3,  description: "User accounts" },

  // ── School itself (root) — deleted absolutely last, seeded absolutely first ──
  // School uses `_id` as the school identifier, not a `schoolId` field.
  // It is handled specially in reset/seed routines (not via the generic loop).
] as const;

/** Collections sorted by deleteOrder ascending (leaf-first). */
export function deleteOrderedCollections(): readonly CollectionRegistryEntry[] {
  return [...DEMO_SCOPED_COLLECTIONS].sort(
    (a, b) => a.deleteOrder - b.deleteOrder
  );
}

/** Collections sorted by seedOrder ascending (root-first). */
export function seedOrderedCollections(): readonly CollectionRegistryEntry[] {
  return [...DEMO_SCOPED_COLLECTIONS].sort(
    (a, b) => a.seedOrder - b.seedOrder
  );
}

/** Quick lookup: does this model name participate in sandbox reset? */
export function isRegisteredDemoCollection(modelName: string): boolean {
  return DEMO_SCOPED_COLLECTIONS.some((c) => c.modelName === modelName);
}
