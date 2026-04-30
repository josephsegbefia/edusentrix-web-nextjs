import { z } from "zod";

const currentYear = new Date().getFullYear();

export const createLibraryBookSchema = z.object({
  title: z.string().trim().min(1).max(160),
  subtitle: z.string().trim().max(160).optional().or(z.literal("")),
  author: z.string().trim().max(120).optional().or(z.literal("")),
  publisher: z.string().trim().max(120).optional().or(z.literal("")),
  isbn: z.string().trim().max(32).optional().or(z.literal("")),
  edition: z.string().trim().max(60).optional().or(z.literal("")),
  publicationYear: z.coerce.number().int().min(1000).max(currentYear).optional(),

  category: z.string().trim().max(80).optional().or(z.literal("")),
  subject: z.string().trim().max(80).optional().or(z.literal("")),
  gradeLevelIds: z.array(z.string().min(1)).default([]),
  language: z.string().trim().max(60).optional().default("English"),

  description: z.string().trim().max(2000).optional().or(z.literal("")),
  coverImageUrl: z.union([z.string().url(), z.literal("")]).optional(),
  coverImageKey: z.string().optional().or(z.literal("")),

  shelfLocation: z.string().trim().max(80).optional().or(z.literal("")),
  tags: z.array(z.string().trim().max(40)).default([]),

  initialCopies: z.coerce.number().int().min(0).max(500).default(0),
  acquisitionCost: z.coerce.number().min(0).optional(),
});

export const updateLibraryBookSchema = createLibraryBookSchema
  .omit({ initialCopies: true })
  .partial()
  .extend({
    status: z.enum(["active", "archived"]).optional(),
  });

export const listLibraryBooksQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  status: z.enum(["active", "archived", "all"]).default("active"),
  sortBy: z.enum(["updatedAt", "createdAt", "title"]).default("updatedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const createLibraryBookCopyBodySchema = z.object({
  copyCode: z.string().trim().min(1).max(80),
  barcode: z.string().trim().max(120).optional().or(z.literal("")),
  qrCode: z.string().trim().max(160).optional().or(z.literal("")),
  condition: z.enum(["new", "good", "fair", "damaged", "lost"]).default("good"),
  status: z.enum(["available", "maintenance", "lost", "damaged"]).default("available"),
  shelfLocation: z.string().trim().max(80).optional().or(z.literal("")),
  acquisitionDate: z.coerce.date().optional(),
  acquisitionCost: z.coerce.number().min(0).optional(),
  source: z.enum(["purchase", "donation", "government", "other"]).default("purchase"),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const updateLibraryBookCopySchema = createLibraryBookCopyBodySchema
  .partial()
  .extend({
    status: z
      .enum(["available", "borrowed", "reserved", "maintenance", "lost", "damaged", "archived"])
      .optional(),
  });

export const updateLibrarySettingsSchema = z.object({
  defaultLoanDaysStudent: z.coerce.number().int().min(1).max(365),
  defaultLoanDaysTeacher: z.coerce.number().int().min(1).max(365),
  defaultLoanDaysStaff: z.coerce.number().int().min(1).max(365),

  maxBooksPerStudent: z.coerce.number().int().min(1).max(50),
  maxBooksPerTeacher: z.coerce.number().int().min(1).max(100),
  maxBooksPerStaff: z.coerce.number().int().min(1).max(100),

  allowRenewals: z.boolean(),
  maxRenewals: z.coerce.number().int().min(0).max(10),
  renewalDays: z.coerce.number().int().min(1).max(365),

  enableFines: z.boolean(),
  finePerDay: z.coerce.number().min(0).max(1000),
  graceDaysAfterDueDate: z.coerce.number().int().min(0).max(90),

  enableReplacementFees: z.boolean(),

  notifyBeforeDueDate: z.boolean(),
  dueReminderDaysBefore: z.coerce.number().int().min(0).max(30),
  notifyOnDueDate: z.boolean(),
  notifyAfterOverdue: z.boolean(),
  overdueReminderFrequencyDays: z.coerce.number().int().min(1).max(30),

  notifyParentsForStudentOverdue: z.boolean(),
  notifyTeachersForTeacherOverdue: z.boolean(),
});

export const patchLibrarySettingsSchema = updateLibrarySettingsSchema.partial();

export const issueLibraryLoanSchema = z.object({
  bookId: z.string().min(1),
  bookCopyId: z.string().min(1),
  borrowerType: z.enum(["student", "teacher", "staff"]),
  borrowerId: z.string().min(1),
  dueAt: z.coerce.date(),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const returnLibraryLoanSchema = z.object({
  returnCondition: z.enum(["new", "good", "fair", "damaged", "lost"]),
  returnedAt: z.coerce.date().optional(),
  fineAmount: z.coerce.number().min(0).optional(),
  replacementFeeAmount: z.coerce.number().min(0).optional(),
  createFeeCharge: z.boolean().default(false),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const renewLibraryLoanSchema = z.object({
  newDueAt: z.coerce.date(),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const listLibraryLoansQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  bucket: z
    .enum(["open", "overdue", "returned", "fines_pending", "all"])
    .default("open"),
  sortBy: z.enum(["issuedAt", "dueAt", "returnedAt"]).default("issuedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const waiveLibraryLoanFineSchema = z.object({
  reason: z.string().trim().max(500).optional().or(z.literal("")),
});

export const markLibraryLoanDispositionBodySchema = z.object({
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  createFeeCharge: z.boolean().optional().default(false),
});

export const libraryBorrowersSearchQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  types: z
    .string()
    .optional()
    .transform((raw) => {
      const s = raw?.trim() || "student,teacher,staff";
      const parts = s.split(",").map((p) => p.trim().toLowerCase());
      const isBorrowerType = (p: string): p is "student" | "teacher" | "staff" =>
        p === "student" || p === "teacher" || p === "staff";
      const narrowed = [...new Set(parts.filter(isBorrowerType))];
      return narrowed.length > 0 ? narrowed : (["student", "teacher", "staff"] as const);
    }),
  limit: z.coerce.number().int().min(1).max(25).default(12),
});

export const libraryReportQuerySchema = z.object({
  type: z.enum([
    "overdue",
    "most_borrowed",
    "inventory_value",
    "active_readers",
    "lost_damaged",
    "category_usage",
    "class_activity",
  ]),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  classGroupId: z.string().optional(),
  gradeLevelId: z.string().optional(),
  limit: z.coerce.number().int().min(5).max(100).optional(),
});

export const libraryImportBodySchema = z.object({
  type: z.enum(["books", "copies", "books_and_copies"]),
  fileName: z.string().trim().min(1).max(200),
  csvText: z.string().min(1).max(2_000_000),
});

export const librarySendRemindersSchema = z.object({
  loanIds: z.array(z.string().min(1)).min(1).max(100),
  message: z.string().trim().max(500).optional().or(z.literal("")),
});

export const borrowerHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const libraryNoticeAudienceSchema = z.enum([
  "all",
  "students",
  "teachers",
  "parents",
  "class_group",
  "grade",
]);

export const createLibraryNoticeBodySchema = z.object({
  title: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(16_000),
  audience: libraryNoticeAudienceSchema,
  audienceRefId: z.string().min(1).optional(),
  expiresAt: z.coerce.date().optional().nullable(),
  status: z.enum(["draft", "published"]).optional().default("draft"),
});

export const updateLibraryNoticeBodySchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  message: z.string().trim().min(1).max(16_000).optional(),
  audience: libraryNoticeAudienceSchema.optional(),
  audienceRefId: z.union([z.string().min(1), z.literal("")]).optional(),
  expiresAt: z.coerce.date().optional().nullable(),
  status: z.enum(["draft", "published", "archived"]).optional(),
});

export const listAdminLibraryNoticesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(["all", "draft", "published", "archived"]).optional().default("all"),
});

export const libraryReservationStatusSchema = z.enum([
  "pending",
  "ready",
  "fulfilled",
  "cancelled",
  "expired",
]);

export const listLibraryReservationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  bookId: z.string().trim().optional(),
  borrowerType: z.enum(["student", "teacher", "staff"]).optional(),
  borrowerId: z.string().trim().optional(),
  status: libraryReservationStatusSchema.optional(),
});

export const createLibraryReservationBodySchema = z.object({
  bookId: z.string().min(1),
  borrowerType: z.enum(["student", "teacher", "staff"]),
  borrowerId: z.string().min(1),
});

export const patronCreateLibraryReservationBodySchema = z.object({
  bookId: z.string().min(1),
});

/** Parent places a hold for a linked student (`studentId` must be a ward). */
export const parentCreateLibraryReservationBodySchema = z.object({
  bookId: z.string().min(1),
  studentId: z.string().min(1),
});
