# EduSentrix Library Module Technical Specification

**Product:** EduSentrix Web & Mobile  
**Module:** Library Management / Smart Library Management  
**Versions Covered:** V1 (sub-versions **V1.0 – V1.3**) and V2  
**Audience:** Software engineers, AI coding agents, QA engineers, product builders  
**Primary Build Target:** EduSentrix Web App  
**Future Build Target:** EduSentrix Mobile App  

---

## 1. Purpose

The Library module makes EduSentrix a more complete school operating system by helping schools manage physical books, book copies, borrowing, returns, overdue tracking, fines, library reports, and borrower history.

The module should not be built as a simple “book list.” It should support the real workflow used in a school library:

```txt
Books → Copies → Borrowing → Returns → Overdue → Fines → Reports → Student/Teacher History
```

The module should help schools:

- Maintain accurate library inventory.
- Track each physical copy of a book.
- Know who borrowed what and when it is due.
- Reduce book loss and damage.
- Track overdue books.
- Create replacement or damage fees when needed.
- Understand library usage and reading activity.
- Support future student, parent, teacher, AI, mobile, and fundraising features.

**V1 delivery:** Full V1 is split into **V1.0, V1.1, V1.2, V1.3** (see §4 and §34). Each sub-version is independently shippable and has its own Definition of Done (§36).

---

## 2. Product Naming

### Sidebar label

```txt
Library
```

### Marketing label

```txt
Smart Library Management
```

### Positioning

> Track books, manage borrowing, reduce losses, and build a stronger reading culture in your school.

---

## 3. Assumed EduSentrix Stack

### Frontend

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- TanStack React Query
- React Hook Form
- Zod
- Framer Motion
- Sonner toasts
- UploadThing for book cover uploads
- Clerk authentication
- Native `fetch`, no Axios

### Backend

- Next.js Route Handlers or existing backend API style
- MongoDB
- Mongoose
- TypeScript
- Clerk authentication
- Role-based access control
- School-scoped authorization
- Scheduled jobs for overdue detection and reminders

### Core project rules

- Every library resource must be scoped by `schoolId`.
- Never trust `schoolId` from the client for normal school users.
- Infer `schoolId` from the authenticated user's active school context.
- Route handlers validate input, authenticate, authorize, and call services.
- Services contain business logic.
- Derived counters must not be directly mutated by the frontend.
- Frontend data access must use TanStack Query hooks.
- All list endpoints must support pagination.

---

## 4. V1 Scope

V1 should focus on the operational physical library workflow. **Full V1 is delivered incrementally** as **V1.0 → V1.1 → V1.2 → V1.3** so each sub-version is shippable, testable, and not blocked by CSV, reports, or integrations before circulation works.

| Sub-version | Working theme | Schools can… |
|-------------|----------------|--------------|
| **V1.0** | Catalogue & inventory | Maintain books, copies, covers, and baseline settings; see a minimal dashboard. |
| **V1.1** | Circulation core | Issue, return, and renew loans; browse active loans; search borrowers. |
| **V1.2** | Exceptions & money | See overdue loans; mark lost/damaged; record basic fines and replacement fees (fee hooks). |
| **V1.3** | Visibility & scale | See borrowing history, run basic reports, CSV import, notification hooks, fuller dashboard. |

**Rule:** Do not start a sub-version’s phases until the previous sub-version meets its **Definition of Done** (§36). Agents and teams may pause between sub-versions for release.

---

### 4.1 V1.0 — Catalogue & inventory

**Outcomes**

- Accurate **book catalogue** and **copy inventory** per school.
- **Library settings** exist with sensible defaults (loan defaults will apply in V1.1).
- **RBAC** and **audit** for book and copy mutations.

**Includes**

- Library dashboard (**minimal**: inventory-focused counts and empty states for loans).
- Book catalogue; add, edit, archive books; book cover image upload.
- Book copy management (add, edit, retire/archive copies as per data model).
- Basic library settings (GET/PATCH): loan defaults, limits, toggles used by later sub-versions.
- Library permissions for books, copies, settings (read/manage as specified in §6).
- Audit logs for book and copy create/update/archive (and related copy status changes that are inventory-only).

**Excludes (defer to later sub-versions)**

- Issuing/returning loans, overdue jobs, fines, CSV import, full analytics reports, notification/fee integration beyond settings fields.

---

### 4.2 V1.1 — Circulation core

**Outcomes**

- **Borrow / issue**, **return**, and **renew** against a specific copy.
- **Active loans** list and loan detail; **borrower search** for students, teachers, and staff.
- **Derived counters** on books/copies updated only via services (no client-side counter mutation).

**Includes**

- All circulation actions: issue, return, renew.
- Permissions and audit for loan lifecycle (issue/return/renew).
- Enforcement of **max books** and **loan length** from settings where applicable.

**Excludes**

- Mark lost/damaged, overdue automation, fines, CSV, reports (beyond what a simple loan list implies), import jobs.

---

### 4.3 V1.2 — Exceptions, overdues & fees

**Outcomes**

- **Overdue** loans are visible and correct; optional transition rules (manual job or cron) documented in implementation.
- **Mark copy lost** / **mark damaged** tied to loan/copy state.
- **Basic fines** and **replacement fees**; **fee module integration points** (stub or event-based) so billing can attach later without blocking V1.2 UI.

**Includes**

- Overdue tracking (list/filter APIs; overdue state on loans).
- Basic fine calculation per settings (e.g. per day after grace); waive/mark paid patterns as in API spec.
- Replacement fee recording for lost/damaged where specified.
- Audit for overdue-related and money-related actions.

**Excludes**

- Full notification delivery (use **integration points** — see V1.3 if you only emit events in V1.2).
- CSV import, multi-report pack, borrowing **history** screens (those are V1.3).

---

### 4.4 V1.3 — History, reports, imports & integrations

**Outcomes**

- **Student** and **teacher/staff** borrowing histories for authorized roles.
- **Basic library reports** (see report types in §12; implement in priority order in Phase V1.3-B).
- **CSV import** for books and copies with row-level errors and `LibraryImportJob`.
- **Notification integration points** (queue/events) for due/overdue/reminder flows without requiring full SMS/email product completion.
- **Library dashboard** shows useful operational metrics (inventory + circulation + overdue snapshot).

**Includes**

- CSV import (`books`, `copies`, `books_and_copies`) as specified.
- Audit completeness review for remaining high-value mutations.
- Reports and dashboard widgets per §12 / §31 priorities agreed in Phase V1.3-B.

**Excludes**

- Anything listed under **V2** (§5).

---

### 4.5 V1 master checklist (maps former “V1 must include”)

| # | Capability | Sub-version |
|---|----------------|-------------|
| 1 | Library dashboard | V1.0 minimal → **V1.3** full metrics |
| 2 | Book catalogue | **V1.0** |
| 3 | Book copy management | **V1.0** |
| 4 | Add, edit, archive books | **V1.0** |
| 5 | Book cover image upload | **V1.0** |
| 6 | Borrow / issue book | **V1.1** |
| 7 | Return book | **V1.1** |
| 8 | Renew loan | **V1.1** |
| 9 | Mark copy as lost | **V1.2** |
| 10 | Mark copy as damaged | **V1.2** |
| 11 | Overdue tracking | **V1.2** |
| 12 | Basic fine and replacement fee support | **V1.2** |
| 13 | Student borrowing history | **V1.3** |
| 14 | Teacher/staff borrowing history | **V1.3** |
| 15 | Basic library settings | **V1.0** (fields used by V1.1+) |
| 16 | Basic library reports | **V1.3** |
| 17 | Library permissions and RBAC | **V1.0** scaffold → extend **V1.1–V1.3** |
| 18 | Audit logs for important actions | **V1.0** (books/copies) → **V1.1+** loans → **V1.3** sweep |
| 19 | CSV import for books and copies | **V1.3** |
| 20 | Notification integration points | **V1.3** (V1.2 may emit internal events only if needed) |
| 21 | Fee module integration points | **V1.2** (stub/events) → **V1.3** hardened as needed |

---

### V1 should not include yet

1. Barcode/QR scanning
2. Book reservations
3. Student self-service library portal
4. Parent-facing library portal
5. E-book/PDF reader
6. Digital library
7. Leo's Recommendations
8. Advanced reading analytics
9. Public developer API access

---

## 5. V2 Scope

V2 should make the Library module smarter, more interactive, and more visible to students, parents, and teachers.

### V2 should include

1. Book reservations
2. Reservation queue
3. QR/barcode generation for book copies
4. QR/barcode scanning for issuing and returning
5. Student-facing library browsing
6. Teacher-facing library browsing
7. Parent-facing library status
8. Library notices
9. Leo's Recommendations
10. Reading goals and reading challenges
11. Digital library support for PDFs/e-books
12. Advanced analytics
13. Fundraising integration for library campaigns
14. Mobile app support
15. Offline-friendly mobile borrow/return workflow
16. Exportable PDF reports
17. Automated reminder schedules
18. API-ready endpoints for future EduSentrix Connect

---

## 6. Roles and Permissions

### Suggested roles

| Role | Access |
|---|---|
| School Admin | Full library access |
| Librarian | Manage books, copies, loans, overdue, reports, notices |
| Teacher | View available books and own borrowing history |
| Staff | View/borrow books and own history |
| Student | V2: browse books and view own loans |
| Parent | V2: view child’s borrowed/overdue books and fines |

### Permission keys

```ts
export const LIBRARY_PERMISSIONS = {
  BOOKS_READ: "library.books.read",
  BOOKS_CREATE: "library.books.create",
  BOOKS_UPDATE: "library.books.update",
  BOOKS_ARCHIVE: "library.books.archive",
  BOOKS_DELETE: "library.books.delete",

  COPIES_READ: "library.copies.read",
  COPIES_CREATE: "library.copies.create",
  COPIES_UPDATE: "library.copies.update",
  COPIES_DELETE: "library.copies.delete",

  LOANS_READ: "library.loans.read",
  LOANS_ISSUE: "library.loans.issue",
  LOANS_RETURN: "library.loans.return",
  LOANS_RENEW: "library.loans.renew",
  LOANS_MARK_LOST: "library.loans.mark_lost",
  LOANS_MARK_DAMAGED: "library.loans.mark_damaged",

  FINES_READ: "library.fines.read",
  FINES_MANAGE: "library.fines.manage",
  FINES_WAIVE: "library.fines.waive",

  REPORTS_VIEW: "library.reports.view",
  SETTINGS_MANAGE: "library.settings.manage",

  RESERVATIONS_READ: "library.reservations.read",
  RESERVATIONS_MANAGE: "library.reservations.manage",

  NOTICES_MANAGE: "library.notices.manage",
} as const;
```

### Default role-permission mapping

```ts
type AppRole =
  | "school_admin"
  | "librarian"
  | "teacher"
  | "staff"
  | "student"
  | "parent";

export const DEFAULT_LIBRARY_ROLE_PERMISSIONS: Record<AppRole, string[]> = {
  school_admin: ["*"],

  librarian: [
    "library.books.read",
    "library.books.create",
    "library.books.update",
    "library.books.archive",
    "library.copies.read",
    "library.copies.create",
    "library.copies.update",
    "library.loans.read",
    "library.loans.issue",
    "library.loans.return",
    "library.loans.renew",
    "library.loans.mark_lost",
    "library.loans.mark_damaged",
    "library.fines.read",
    "library.fines.manage",
    "library.reports.view",
    "library.notices.manage",
  ],

  teacher: ["library.books.read", "library.loans.read"],
  staff: ["library.books.read", "library.loans.read"],
  student: ["library.books.read"],
  parent: [],
};
```

---

## 7. Business Rules

### 7.1 School scoping

Every database query must include `schoolId`.

```ts
const book = await LibraryBook.findOne({ _id: bookId, schoolId });
```

Do not query by `_id` alone.

### 7.2 Book vs copy

A **book** is the catalogue record.

A **book copy** is a specific physical copy.

Example:

```txt
Book: Integrated Science JHS 1
Copies:
- SCI-JHS1-0001
- SCI-JHS1-0002
- SCI-JHS1-0003
```

A loan must always point to a specific `bookCopyId`.

### 7.3 Copy statuses

```ts
type LibraryBookCopyStatus =
  | "available"
  | "borrowed"
  | "reserved"
  | "maintenance"
  | "lost"
  | "damaged"
  | "archived";
```

V1 should mainly use:

```txt
available
borrowed
maintenance
lost
damaged
archived
```

V2 adds stronger support for:

```txt
reserved
```

### 7.4 Book statuses

```ts
type LibraryBookStatus = "active" | "archived";
```

Hard delete should generally be avoided. Use archive.

### 7.5 Borrowing rules

Before issuing a book, the backend must check:

1. Borrower exists in the same school.
2. Book exists in the same school.
3. Copy exists in the same school.
4. Copy belongs to the selected book.
5. Copy status is `available`.
6. Borrower has not exceeded max allowed books.
7. Due date is after issue date.
8. User has `library.loans.issue`.

### 7.6 Return rules

When returning a book:

1. Loan must be active or overdue.
2. Return condition must be selected.
3. If returned in good/fair/new condition, copy becomes `available`.
4. If damaged, copy becomes `damaged` or `maintenance`.
5. If lost, copy becomes `lost`.
6. Fine is calculated if enabled.
7. Replacement fee is created or recorded if enabled.
8. Counters are updated.

### 7.7 Overdue rules

A loan is overdue when:

```txt
status = active AND dueAt < now
```

Overdue status should be updated by scheduled jobs and also respected dynamically in list queries.

### 7.8 Fines

Fines are optional per school.

```txt
fine = daysOverdue * finePerDay
```

Fine statuses:

```ts
type LibraryFineStatus = "none" | "pending" | "paid" | "waived";
```

V1 can store fine fields directly on the loan. V2 may introduce a separate `LibraryFine` model if fines become more complex.

### 7.9 Replacement fees

Lost or damaged books can create a replacement/damage fee.

V1: record fee amount and optionally call Fees module manually.  
V2: automatic Fees module integration based on settings.

### 7.10 Audit logs

Audit these actions:

- book created
- book updated
- book archived
- copy created
- copy updated
- copy archived
- loan issued
- loan returned
- loan renewed
- loan marked lost
- loan marked damaged
- fine waived
- settings updated
- CSV import completed

Suggested shape:

```ts
type AuditLog = {
  schoolId: string;
  actorId: string;
  actorRole?: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
  createdAt: Date;
};
```

---

## 8. Data Models

All models should use Mongoose schemas with timestamps.

---

## 8.1 LibraryBook

Represents a book title/catalogue record.

```ts
export type LibraryBook = {
  _id: string;
  schoolId: string;

  title: string;
  subtitle?: string;
  author?: string;
  publisher?: string;
  isbn?: string;
  edition?: string;
  publicationYear?: number;

  category?: string;
  subject?: string;
  gradeLevelIds?: string[];
  language?: string;

  description?: string;
  coverImageUrl?: string;
  coverImageKey?: string;

  shelfLocation?: string;
  tags: string[];

  totalCopies: number;
  availableCopies: number;
  borrowedCopies: number;
  lostCopies: number;
  damagedCopies: number;
  reservedCopies: number;

  status: "active" | "archived";

  createdBy: string;
  updatedBy?: string;

  createdAt: Date;
  updatedAt: Date;
};
```

Mongoose notes:

```ts
const LibraryBookSchema = new Schema(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },

    title: { type: String, required: true, trim: true, index: true },
    subtitle: { type: String, trim: true },
    author: { type: String, trim: true, index: true },
    publisher: { type: String, trim: true },
    isbn: { type: String, trim: true, index: true },
    edition: { type: String, trim: true },
    publicationYear: { type: Number },

    category: { type: String, trim: true, index: true },
    subject: { type: String, trim: true, index: true },
    gradeLevelIds: [{ type: Schema.Types.ObjectId, ref: "Grade" }],
    language: { type: String, trim: true, default: "English" },

    description: { type: String, trim: true },
    coverImageUrl: { type: String },
    coverImageKey: { type: String },

    shelfLocation: { type: String, trim: true, index: true },
    tags: [{ type: String, trim: true }],

    totalCopies: { type: Number, default: 0, min: 0 },
    availableCopies: { type: Number, default: 0, min: 0 },
    borrowedCopies: { type: Number, default: 0, min: 0 },
    lostCopies: { type: Number, default: 0, min: 0 },
    damagedCopies: { type: Number, default: 0, min: 0 },
    reservedCopies: { type: Number, default: 0, min: 0 },

    status: { type: String, enum: ["active", "archived"], default: "active", index: true },

    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

LibraryBookSchema.index({ schoolId: 1, title: "text", author: "text", isbn: "text", tags: "text" });
LibraryBookSchema.index({ schoolId: 1, status: 1, category: 1 });
LibraryBookSchema.index({ schoolId: 1, subject: 1 });
LibraryBookSchema.index({ schoolId: 1, createdAt: -1 });
```

Important: `totalCopies`, `availableCopies`, etc. are derived counters. Only services should update them.

---

## 8.2 LibraryBookCopy

Represents one physical copy.

```ts
export type LibraryBookCopyCondition =
  | "new"
  | "good"
  | "fair"
  | "damaged"
  | "lost";

export type LibraryBookCopy = {
  _id: string;
  schoolId: string;
  bookId: string;

  copyCode: string;
  barcode?: string;
  qrCode?: string;

  condition: LibraryBookCopyCondition;
  status: LibraryBookCopyStatus;

  shelfLocation?: string;
  acquisitionDate?: Date;
  acquisitionCost?: number;
  source?: "purchase" | "donation" | "government" | "other";

  notes?: string;

  createdBy: string;
  updatedBy?: string;

  createdAt: Date;
  updatedAt: Date;
};
```

Mongoose notes:

```ts
const LibraryBookCopySchema = new Schema(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    bookId: { type: Schema.Types.ObjectId, ref: "LibraryBook", required: true, index: true },

    copyCode: { type: String, required: true, trim: true },
    barcode: { type: String, trim: true },
    qrCode: { type: String, trim: true },

    condition: {
      type: String,
      enum: ["new", "good", "fair", "damaged", "lost"],
      default: "good",
      index: true,
    },

    status: {
      type: String,
      enum: ["available", "borrowed", "reserved", "maintenance", "lost", "damaged", "archived"],
      default: "available",
      index: true,
    },

    shelfLocation: { type: String, trim: true, index: true },
    acquisitionDate: { type: Date },
    acquisitionCost: { type: Number, min: 0 },
    source: {
      type: String,
      enum: ["purchase", "donation", "government", "other"],
      default: "purchase",
    },

    notes: { type: String, trim: true },

    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

LibraryBookCopySchema.index({ schoolId: 1, copyCode: 1 }, { unique: true });
LibraryBookCopySchema.index({ schoolId: 1, barcode: 1 }, { sparse: true });
LibraryBookCopySchema.index({ schoolId: 1, bookId: 1, status: 1 });
LibraryBookCopySchema.index({ schoolId: 1, status: 1, condition: 1 });
```

---

## 8.3 LibraryLoan

Represents a borrowing transaction.

```ts
export type LibraryBorrowerType = "student" | "teacher" | "staff";
export type LibraryLoanStatus =
  | "active"
  | "returned"
  | "overdue"
  | "lost"
  | "damaged"
  | "cancelled";

export type LibraryLoan = {
  _id: string;
  schoolId: string;

  bookId: string;
  bookCopyId: string;

  borrowerType: LibraryBorrowerType;
  borrowerId: string;

  issuedBy: string;
  returnedTo?: string;

  issuedAt: Date;
  dueAt: Date;
  returnedAt?: Date;

  status: LibraryLoanStatus;
  isOpen: boolean;

  renewalCount: number;
  lastRenewedAt?: Date;
  lastRenewedBy?: string;

  returnCondition?: LibraryBookCopyCondition;

  fineAmount: number;
  fineStatus: LibraryFineStatus;
  fineWaivedBy?: string;
  fineWaivedAt?: Date;
  fineWaiverReason?: string;

  replacementFeeAmount?: number;
  replacementFeeStatus?: "none" | "pending" | "paid" | "waived";
  linkedFeeId?: string;

  lastReminderSentAt?: Date;
  reminderCount?: number;

  notes?: string;

  createdAt: Date;
  updatedAt: Date;
};
```

Mongoose notes:

```ts
const LibraryLoanSchema = new Schema(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },

    bookId: { type: Schema.Types.ObjectId, ref: "LibraryBook", required: true, index: true },
    bookCopyId: { type: Schema.Types.ObjectId, ref: "LibraryBookCopy", required: true, index: true },

    borrowerType: {
      type: String,
      enum: ["student", "teacher", "staff"],
      required: true,
      index: true,
    },
    borrowerId: { type: Schema.Types.ObjectId, required: true, index: true },

    issuedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    returnedTo: { type: Schema.Types.ObjectId, ref: "User" },

    issuedAt: { type: Date, required: true, default: Date.now, index: true },
    dueAt: { type: Date, required: true, index: true },
    returnedAt: { type: Date, index: true },

    status: {
      type: String,
      enum: ["active", "returned", "overdue", "lost", "damaged", "cancelled"],
      default: "active",
      index: true,
    },
    isOpen: { type: Boolean, default: true, index: true },

    renewalCount: { type: Number, default: 0, min: 0 },
    lastRenewedAt: { type: Date },
    lastRenewedBy: { type: Schema.Types.ObjectId, ref: "User" },

    returnCondition: { type: String, enum: ["new", "good", "fair", "damaged", "lost"] },

    fineAmount: { type: Number, default: 0, min: 0 },
    fineStatus: {
      type: String,
      enum: ["none", "pending", "paid", "waived"],
      default: "none",
      index: true,
    },
    fineWaivedBy: { type: Schema.Types.ObjectId, ref: "User" },
    fineWaivedAt: { type: Date },
    fineWaiverReason: { type: String, trim: true },

    replacementFeeAmount: { type: Number, min: 0 },
    replacementFeeStatus: {
      type: String,
      enum: ["none", "pending", "paid", "waived"],
      default: "none",
    },
    linkedFeeId: { type: Schema.Types.ObjectId, ref: "Fee" },

    lastReminderSentAt: { type: Date },
    reminderCount: { type: Number, default: 0 },

    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

LibraryLoanSchema.index({ schoolId: 1, borrowerType: 1, borrowerId: 1, status: 1 });
LibraryLoanSchema.index({ schoolId: 1, status: 1, dueAt: 1 });
LibraryLoanSchema.index({ schoolId: 1, bookId: 1, status: 1 });
LibraryLoanSchema.index({ schoolId: 1, bookCopyId: 1, isOpen: 1 }, {
  unique: true,
  partialFilterExpression: { isOpen: true },
});
```

---

## 8.4 LibrarySettings

Stores school-specific library rules.

```ts
export type LibrarySettings = {
  _id: string;
  schoolId: string;

  defaultLoanDaysStudent: number;
  defaultLoanDaysTeacher: number;
  defaultLoanDaysStaff: number;

  maxBooksPerStudent: number;
  maxBooksPerTeacher: number;
  maxBooksPerStaff: number;

  allowRenewals: boolean;
  maxRenewals: number;
  renewalDays: number;

  enableFines: boolean;
  finePerDay: number;
  graceDaysAfterDueDate: number;

  enableReplacementFees: boolean;

  notifyBeforeDueDate: boolean;
  dueReminderDaysBefore: number;
  notifyOnDueDate: boolean;
  notifyAfterOverdue: boolean;
  overdueReminderFrequencyDays: number;

  notifyParentsForStudentOverdue: boolean;
  notifyTeachersForTeacherOverdue: boolean;

  createdAt: Date;
  updatedAt: Date;
};
```

Default settings:

```ts
export const DEFAULT_LIBRARY_SETTINGS = {
  defaultLoanDaysStudent: 14,
  defaultLoanDaysTeacher: 30,
  defaultLoanDaysStaff: 21,

  maxBooksPerStudent: 2,
  maxBooksPerTeacher: 5,
  maxBooksPerStaff: 3,

  allowRenewals: true,
  maxRenewals: 1,
  renewalDays: 7,

  enableFines: false,
  finePerDay: 1,
  graceDaysAfterDueDate: 0,

  enableReplacementFees: true,

  notifyBeforeDueDate: true,
  dueReminderDaysBefore: 2,
  notifyOnDueDate: true,
  notifyAfterOverdue: true,
  overdueReminderFrequencyDays: 3,

  notifyParentsForStudentOverdue: true,
  notifyTeachersForTeacherOverdue: true,
};
```

---

## 8.5 LibraryImportJob

Tracks CSV imports.

```ts
export type LibraryImportJob = {
  _id: string;
  schoolId: string;

  type: "books" | "copies" | "books_and_copies";
  status: "pending" | "processing" | "completed" | "failed" | "completed_with_errors";

  fileName: string;
  fileUrl?: string;

  totalRows: number;
  successfulRows: number;
  failedRows: number;

  errors: Array<{
    rowNumber: number;
    field?: string;
    message: string;
    raw?: Record<string, unknown>;
  }>;

  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};
```

---

## 8.6 LibraryReservation - V2

```ts
export type LibraryReservationStatus =
  | "pending"
  | "ready"
  | "fulfilled"
  | "cancelled"
  | "expired";

export type LibraryReservation = {
  _id: string;
  schoolId: string;

  bookId: string;
  bookCopyId?: string;

  borrowerType: "student" | "teacher" | "staff";
  borrowerId: string;

  status: LibraryReservationStatus;
  queuePosition: number;

  reservedAt: Date;
  readyAt?: Date;
  expiresAt?: Date;
  fulfilledAt?: Date;
  cancelledAt?: Date;

  createdAt: Date;
  updatedAt: Date;
};
```

Indexes:

```ts
LibraryReservationSchema.index({ schoolId: 1, bookId: 1, status: 1, queuePosition: 1 });
LibraryReservationSchema.index({ schoolId: 1, borrowerType: 1, borrowerId: 1, status: 1 });
```

---

## 8.7 LibraryNotice - V2

```ts
export type LibraryNoticeAudience =
  | "all"
  | "students"
  | "teachers"
  | "parents"
  | "class_group"
  | "grade";

export type LibraryNotice = {
  _id: string;
  schoolId: string;

  title: string;
  message: string;

  audience: LibraryNoticeAudience;
  audienceRefId?: string;

  publishedAt?: Date;
  expiresAt?: Date;
  status: "draft" | "published" | "archived";

  createdBy: string;
  updatedBy?: string;

  createdAt: Date;
  updatedAt: Date;
};
```

---

## 9. Suggested Backend Folder Structure

```txt
src/
  app/
    api/
      library/
        dashboard/route.ts
        books/route.ts
        books/[bookId]/route.ts
        books/[bookId]/copies/route.ts
        copies/[copyId]/route.ts
        loans/route.ts
        loans/[loanId]/route.ts
        loans/[loanId]/return/route.ts
        loans/[loanId]/renew/route.ts
        loans/[loanId]/mark-lost/route.ts
        loans/[loanId]/mark-damaged/route.ts
        loans/[loanId]/waive-fine/route.ts
        overdue/route.ts
        overdue/send-reminders/route.ts
        borrowers/search/route.ts
        reports/route.ts
        settings/route.ts
        imports/route.ts
        imports/[jobId]/route.ts
        reservations/route.ts                 # V2
        reservations/[reservationId]/route.ts # V2
        notices/route.ts                      # V2
        notices/[noticeId]/route.ts           # V2
        copies/lookup-by-code/route.ts        # V2

  server/
    library/
      library.types.ts
      library.constants.ts
      library.permissions.ts
      library.validators.ts
      library-book.service.ts
      library-copy.service.ts
      library-loan.service.ts
      library-report.service.ts
      library-settings.service.ts
      library-import.service.ts
      library-reservation.service.ts          # V2
      library-notice.service.ts               # V2
      library.jobs.ts
      library.notifications.ts
      library.audit.ts

  models/
    LibraryBook.ts
    LibraryBookCopy.ts
    LibraryLoan.ts
    LibrarySettings.ts
    LibraryImportJob.ts
    LibraryReservation.ts                     # V2
    LibraryNotice.ts                          # V2
```

---

## 10. API Response Shape

```ts
export type ApiSuccess<T> = {
  success: true;
  data: T;
  message?: string;
  meta?: Record<string, unknown>;
};

export type ApiError = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type PaginatedResponse<T> = {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};
```

---

## 11. Validation Schemas

Use Zod on backend and frontend.

### Create book

```ts
export const createLibraryBookSchema = z.object({
  title: z.string().trim().min(1).max(160),
  subtitle: z.string().trim().max(160).optional().or(z.literal("")),
  author: z.string().trim().max(120).optional().or(z.literal("")),
  publisher: z.string().trim().max(120).optional().or(z.literal("")),
  isbn: z.string().trim().max(32).optional().or(z.literal("")),
  edition: z.string().trim().max(60).optional().or(z.literal("")),
  publicationYear: z.coerce.number().int().min(1000).max(new Date().getFullYear()).optional(),

  category: z.string().trim().max(80).optional().or(z.literal("")),
  subject: z.string().trim().max(80).optional().or(z.literal("")),
  gradeLevelIds: z.array(z.string()).default([]),
  language: z.string().trim().max(60).optional().default("English"),

  description: z.string().trim().max(2000).optional().or(z.literal("")),
  coverImageUrl: z.string().url().optional().or(z.literal("")),
  coverImageKey: z.string().optional().or(z.literal("")),

  shelfLocation: z.string().trim().max(80).optional().or(z.literal("")),
  tags: z.array(z.string().trim().max(40)).default([]),

  initialCopies: z.coerce.number().int().min(0).max(500).default(0),
  acquisitionCost: z.coerce.number().min(0).optional(),
});
```

### Create copy

```ts
export const createLibraryBookCopySchema = z.object({
  bookId: z.string().min(1),
  copyCode: z.string().trim().min(1).max(80),
  barcode: z.string().trim().max(120).optional().or(z.literal("")),
  condition: z.enum(["new", "good", "fair", "damaged", "lost"]).default("good"),
  status: z.enum(["available", "maintenance", "lost", "damaged"]).default("available"),
  shelfLocation: z.string().trim().max(80).optional().or(z.literal("")),
  acquisitionDate: z.coerce.date().optional(),
  acquisitionCost: z.coerce.number().min(0).optional(),
  source: z.enum(["purchase", "donation", "government", "other"]).default("purchase"),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});
```

### Issue loan

```ts
export const issueLibraryLoanSchema = z.object({
  bookId: z.string().min(1),
  bookCopyId: z.string().min(1),
  borrowerType: z.enum(["student", "teacher", "staff"]),
  borrowerId: z.string().min(1),
  dueAt: z.coerce.date(),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});
```

### Return loan

```ts
export const returnLibraryLoanSchema = z.object({
  returnCondition: z.enum(["new", "good", "fair", "damaged", "lost"]),
  returnedAt: z.coerce.date().optional(),
  fineAmount: z.coerce.number().min(0).optional(),
  replacementFeeAmount: z.coerce.number().min(0).optional(),
  createFeeCharge: z.boolean().default(false),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});
```

### Renew loan

```ts
export const renewLibraryLoanSchema = z.object({
  newDueAt: z.coerce.date(),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});
```

### Settings

```ts
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
```

---

## 12. API Endpoints - V1

All endpoints require authentication and school-scoped authorization.

### `GET /api/library/dashboard`

Permission:

```txt
library.books.read
```

Returns:

```ts
type LibraryDashboardResponse = {
  stats: {
    totalBooks: number;
    totalCopies: number;
    availableCopies: number;
    borrowedCopies: number;
    overdueLoans: number;
    lostCopies: number;
    damagedCopies: number;
    activeBorrowers: number;
  };
  recentLoans: LibraryLoanListItem[];
  dueToday: LibraryLoanListItem[];
  overdue: LibraryLoanListItem[];
  popularBooks: Array<{
    bookId: string;
    title: string;
    author?: string;
    coverImageUrl?: string;
    borrowCount: number;
  }>;
  lowAvailabilityBooks: Array<{
    bookId: string;
    title: string;
    availableCopies: number;
    totalCopies: number;
  }>;
};
```

---

### `GET /api/library/books`

Permission:

```txt
library.books.read
```

Query params:

```txt
q?: string
category?: string
subject?: string
gradeLevelId?: string
status?: active | archived
availability?: available | unavailable | low_stock
page?: number
limit?: number
sort?: newest | oldest | title_asc | title_desc | most_borrowed
```

Returns paginated book list.

---

### `POST /api/library/books`

Permission:

```txt
library.books.create
```

Body:

```ts
CreateLibraryBookInput
```

Behavior:

- Create the book.
- If `initialCopies > 0`, auto-create copies.
- Generate copy codes.
- Update counters.
- Write audit log.

---

### `GET /api/library/books/:bookId`

Permission:

```txt
library.books.read
```

Returns book detail with counters, copies summary, and recent loans.

---

### `PATCH /api/library/books/:bookId`

Permission:

```txt
library.books.update
```

Updates editable book fields. Must not allow direct mutation of derived counters.

---

### `DELETE /api/library/books/:bookId`

Permission:

```txt
library.books.archive
```

Recommended behavior: archive book instead of hard delete.

Rules:

- Do not archive if there are active loans unless force/archive policy is implemented.
- Set status to `archived`.

---

### `GET /api/library/books/:bookId/copies`

Permission:

```txt
library.copies.read
```

Query params:

```txt
status?: available | borrowed | maintenance | lost | damaged | archived
condition?: new | good | fair | damaged | lost
page?: number
limit?: number
```

---

### `POST /api/library/books/:bookId/copies`

Permission:

```txt
library.copies.create
```

Supports adding one copy or multiple copies.

Possible body:

```ts
CreateLibraryBookCopyInput
```

or:

```ts
{
  count: number;
  baseCopyCode?: string;
  condition?: "new" | "good" | "fair";
  shelfLocation?: string;
}
```

---

### `PATCH /api/library/copies/:copyId`

Permission:

```txt
library.copies.update
```

Rules:

- Do not allow direct status change from `borrowed` to `available`.
- Use return flow for returning a borrowed copy.
- If marking lost/damaged directly, update related active loan if one exists.

---

### `DELETE /api/library/copies/:copyId`

Permission:

```txt
library.copies.delete
```

Recommended behavior: archive copy.

Rules:

- Do not archive a borrowed copy.
- Update counters.

---

### `GET /api/library/borrowers/search`

Permission:

```txt
library.loans.issue
```

Query params:

```txt
q: string
type?: student | teacher | staff
limit?: number
```

Response item:

```ts
type BorrowerSearchResult = {
  id: string;
  type: "student" | "teacher" | "staff";
  name: string;
  avatarUrl?: string;
  code?: string;
  classGroupName?: string;
  roleLabel?: string;
  activeLoanCount: number;
  overdueLoanCount: number;
  canBorrow: boolean;
  blockReason?: string;
};
```

---

### `GET /api/library/loans`

Permission:

```txt
library.loans.read
```

Query params:

```txt
status?: active | returned | overdue | lost | damaged
borrowerType?: student | teacher | staff
borrowerId?: string
bookId?: string
q?: string
from?: ISO date
to?: ISO date
page?: number
limit?: number
sort?: newest | oldest | due_soon | overdue_first
```

Response item:

```ts
type LibraryLoanListItem = {
  _id: string;
  book: {
    _id: string;
    title: string;
    author?: string;
    coverImageUrl?: string;
  };
  copy: {
    _id: string;
    copyCode: string;
  };
  borrower: {
    id: string;
    type: "student" | "teacher" | "staff";
    name: string;
    avatarUrl?: string;
    classGroupName?: string;
  };
  issuedAt: string;
  dueAt: string;
  returnedAt?: string;
  status: LibraryLoanStatus;
  daysOverdue: number;
  fineAmount: number;
  fineStatus: LibraryFineStatus;
};
```

---

### `POST /api/library/loans`

Permission:

```txt
library.loans.issue
```

Behavior:

- Validate borrower.
- Validate book and copy.
- Check availability.
- Check borrowing limit.
- Create loan.
- Set copy status to `borrowed`.
- Update book counters.
- Write audit log.
- Send notification if configured.

---

### `GET /api/library/loans/:loanId`

Permission:

```txt
library.loans.read
```

Returns full loan detail.

---

### `POST /api/library/loans/:loanId/return`

Permission:

```txt
library.loans.return
```

Behavior:

- Validate active/overdue loan.
- Calculate fine if enabled.
- Update loan status.
- Update copy status.
- Update book counters.
- Optionally create linked fee charge.
- Write audit log.

---

### `POST /api/library/loans/:loanId/renew`

Permission:

```txt
library.loans.renew
```

Rules:

- Loan must be active or overdue.
- Renewals must be enabled.
- Renewal count must be below max.
- New due date must be after current due date.
- V2: block renewal if book has reservation queue.

---

### `POST /api/library/loans/:loanId/mark-lost`

Permission:

```txt
library.loans.mark_lost
```

Body:

```ts
{
  replacementFeeAmount?: number;
  createFeeCharge?: boolean;
  notes?: string;
}
```

Behavior:

- Set loan status to `lost`.
- Set copy status and condition to `lost`.
- Update counters.
- Optionally create replacement fee.

---

### `POST /api/library/loans/:loanId/mark-damaged`

Permission:

```txt
library.loans.mark_damaged
```

Behavior:

- Set loan/copy as damaged or maintenance.
- Record fee if provided.
- Update counters.

---

### `POST /api/library/loans/:loanId/waive-fine`

Permission:

```txt
library.fines.waive
```

Body:

```ts
{
  reason: string;
}
```

---

### `GET /api/library/overdue`

Permission:

```txt
library.loans.read
```

Query params:

```txt
borrowerType?: student | teacher | staff
classGroupId?: string
daysOverdueMin?: number
daysOverdueMax?: number
page?: number
limit?: number
```

---

### `POST /api/library/overdue/send-reminders`

Permission:

```txt
library.loans.read
```

Body:

```ts
{
  loanIds: string[];
  channel?: "email" | "sms" | "whatsapp" | "in_app";
  message?: string;
}
```

V1 may create notification records even if actual SMS/WhatsApp delivery is handled elsewhere.

---

### `GET /api/library/reports`

Permission:

```txt
library.reports.view
```

Query params:

```txt
type:
  | most_borrowed
  | active_readers
  | overdue
  | lost_damaged
  | category_usage
  | class_activity
  | inventory_value

from?: ISO date
to?: ISO date
classGroupId?: string
gradeLevelId?: string
limit?: number
```

Report types:

- Most borrowed books
- Most active readers
- Overdue loans
- Lost/damaged books
- Category usage
- Class reading activity
- Inventory value

---

### `GET /api/library/settings`

Permission:

```txt
library.books.read
```

Returns existing settings or creates default settings.

---

### `PATCH /api/library/settings`

Permission:

```txt
library.settings.manage
```

Updates library settings.

---

### `POST /api/library/imports`

Permission:

```txt
library.books.create
```

Supported import types:

```txt
books
copies
books_and_copies
```

Books CSV columns:

```csv
title,subtitle,author,publisher,isbn,edition,publicationYear,category,subject,gradeLevels,language,description,shelfLocation,tags,initialCopies,acquisitionCost
```

Copies CSV columns:

```csv
bookIsbn,bookTitle,copyCode,barcode,condition,status,shelfLocation,acquisitionDate,acquisitionCost,source,notes
```

Import rules:

- Validate row by row.
- Do not fail entire import because one row fails.
- Store row-level errors.
- Return import summary.

---

## 13. API Endpoints - V2

### `GET /api/library/reservations`

Permission:

```txt
library.reservations.read
```

Query params:

```txt
bookId?: string
borrowerType?: student | teacher | staff
borrowerId?: string
status?: pending | ready | fulfilled | cancelled | expired
page?: number
limit?: number
```

### `POST /api/library/reservations`

Permission:

```txt
library.reservations.manage
```

Body:

```ts
{
  bookId: string;
  borrowerType: "student" | "teacher" | "staff";
  borrowerId: string;
}
```

Rules:

- Book must exist.
- Borrower must exist.
- Prevent duplicate pending reservation.
- Assign queue position.
- If a copy is available, reservation may become `ready`.

### `POST /api/library/reservations/:reservationId/fulfill`

Creates a loan from a ready reservation.

### `POST /api/library/reservations/:reservationId/cancel`

Cancels reservation and recalculates queue positions if needed.

### `GET /api/library/notices`

Returns published notices based on audience.

### `POST /api/library/notices`

Permission:

```txt
library.notices.manage
```

Body:

```ts
{
  title: string;
  message: string;
  audience: "all" | "students" | "teachers" | "parents" | "class_group" | "grade";
  audienceRefId?: string;
  publishedAt?: string;
  expiresAt?: string;
  status: "draft" | "published";
}
```

### `POST /api/library/copies/:copyId/generate-code`

Permission:

```txt
library.copies.update
```

Generates QR/barcode value for a copy.

### `GET /api/library/copies/lookup-by-code?code=...`

Finds copy by `copyCode`, `barcode`, or `qrCode`.

**Implemented in web app (admin):** `GET /api/admin/library/copies/lookup?code=...` (same semantics; requires library module access). `POST /api/admin/library/copies/[copyId]/generate-code` generates barcode + `EDU:` QR payload when missing.

**Patron recommendations (rule-based, Leo-style):**

- `GET /api/student/library/recommendations?limit=`
- `GET /api/teacher/library/recommendations?limit=`
- `GET /api/parent/library/recommendations?limit=` — from linked wards’ loan history.

### `GET /api/library/me/loans`

Returns personal loans for student, teacher, or staff.

### `GET /api/library/my-children/:studentId/loans`

Returns a child’s loans for a parent. Must validate parent-child relationship.

### `GET /api/library/browse`

Student/teacher-facing browse endpoint.

---

## 14. Backend Services

### `library-book.service.ts`

Required functions:

```ts
createBook(input, context)
updateBook(bookId, input, context)
archiveBook(bookId, context)
getBookById(bookId, context)
listBooks(filters, context)
recalculateBookCounters(bookId, context)
searchBooks(query, context)
```

### `library-copy.service.ts`

Required functions:

```ts
createCopy(bookId, input, context)
bulkCreateCopies(bookId, input, context)
updateCopy(copyId, input, context)
archiveCopy(copyId, context)
getAvailableCopies(bookId, context)
lookupCopyByCode(code, context)
generateCopyCode(book, sequenceNumber, context)
```

### `library-recommendations.service.ts` (web, rule-based picks)

```ts
recommendLibraryBooksForBorrower(schoolId, borrowerType, borrowerId, limit)
recommendLibraryBooksForWardStudents(schoolId, wardStudentIds[], limit)
recommendLibraryBooksFromRecentLoanBooks(schoolId, recentBookIds[], limit)
```

### `library-loan.service.ts`

Required functions:

```ts
issueLoan(input, context)
returnLoan(loanId, input, context)
renewLoan(loanId, input, context)
markLoanLost(loanId, input, context)
markLoanDamaged(loanId, input, context)
waiveFine(loanId, input, context)
listLoans(filters, context)
getLoanById(loanId, context)
getBorrowerLoanSummary(borrowerType, borrowerId, context)
calculateFine(loan, settings, now)
markOverdueLoans(context)
```

### `library-settings.service.ts`

```ts
getOrCreateSettings(context)
updateSettings(input, context)
```

### `library-report.service.ts`

```ts
getDashboardSummary(context, filters)
getMostBorrowedBooks(context, filters)
getActiveReaders(context, filters)
getOverdueReport(context, filters)
getLostDamagedReport(context, filters)
getCategoryUsageReport(context, filters)
getClassActivityReport(context, filters)
getInventoryValueReport(context, filters)
```

### `library-import.service.ts`

```ts
createImportJob(input, context)
processBooksCsv(jobId, file, context)
processCopiesCsv(jobId, file, context)
validateBookImportRow(row, rowNumber)
validateCopyImportRow(row, rowNumber)
```

### `library-notifications.ts`

**Implemented (web):** in-app `Notification` plus optional **queued Brevo email** via `sendTrackedBrevoEmail` (`async: true`) for:

- **Hold ready** — template `LIBRARY_HOLD_READY` (patron + linked parents).
- **Overdue reminder** (admin “send reminders”) — template `LIBRARY_LOAN_OVERDUE_REMINDER`.

```ts
enqueueLibraryOverdueReminderNotifications({ schoolId, loanIds })
enqueueLibraryReservationReadyNotifications({ schoolId, reservationIds }) // V2.2
notifyLibraryReservationsBecameReady(schoolId, reservationIds[])
```

Spec placeholders not yet productized as separate cron modules:

```ts
// Planned / settings-driven (future)
sendLoanIssuedNotification(loan, context)
sendDueSoonReminder(loan, context)
```

---

## 15. Scheduled Jobs

**Implemented (HTTP cron; auth `LIBRARY_CRON_SECRET` or `CRON_SECRET`):**

- **`GET/POST /api/cron/library-reservation-expiry`** — expires stale holds (`library-reservation-scheduler` + `expireStaleLibraryReservationsGlobally`).
- **`GET/POST /api/cron/library-loans-overdue`** — `markOpenLoansOverdueGlobally` (all tenants).

### `library.markOverdueLoans`

Frequency: daily.

Behavior:

- Find active loans where `dueAt < now`.
- Set status to `overdue`.
- Calculate fine if enabled.
- Update audit metadata.

### `library.sendDueSoonReminders`

Frequency: daily.

Behavior:

- Use `notifyBeforeDueDate` and `dueReminderDaysBefore`.
- Notify borrower/parent/teacher as configured.

### `library.sendOverdueReminders`

Frequency: daily or configured interval.

Behavior:

- Find overdue loans.
- Respect `overdueReminderFrequencyDays`.
- Avoid duplicate reminders using `lastReminderSentAt`.

---

## 16. Integrations

### Students module

Student detail page should include a Library tab:

```txt
Currently Borrowed
Borrowing History
Overdue Books
Lost/Damaged Books
Total Books Borrowed
Favorite Categories
```

### Teachers module

Teacher detail page should include:

```txt
Currently Borrowed
Teaching Resources Borrowed
Pending Returns
Borrowing History
```

### Fees module

Lost/damaged books can create fee charges.

Payload example:

```ts
{
  studentId: string;
  source: "library";
  sourceRefId: loanId;
  title: "Library book replacement fee";
  description: "Lost book: Integrated Science JHS 1 - Copy SCI-JHS1-0004";
  amount: 60;
  dueDate: string;
}
```

### Notifications module

Events:

```txt
library.loan_issued
library.book_due_soon
library.book_overdue
library.book_returned
library.book_lost
library.book_damaged
library.reservation_ready
library.notice_published
```

### Reports module

Global Reports should include:

```txt
Library Usage
Overdue & Fines
Inventory
Reading Activity
Lost/Damaged Books
```

### Fundraising module - V2

Example campaigns:

```txt
Help us stock the library with 100 new storybooks.
Sponsor textbooks for JHS students.
Donate to replace damaged library books.
```

Payload:

```ts
{
  source: "library";
  title: "Stock Our Library With 100 Storybooks";
  targetAmount: 5000;
  description: string;
  suggestedItems: Array<{
    title: string;
    estimatedCost: number;
    quantity: number;
  }>;
}
```

### EduAI Assistant - V2

Example prompts:

```txt
Show me all JHS 1 students with overdue books.
Which books are most borrowed this term?
Recommend books for Primary 5 students.
Generate a library usage report for this month.
Which class has the best reading activity this term?
Draft a message to parents about overdue library books.
```

Suggested AI tools:

```ts
library.searchBooks
library.getOverdueLoans
library.getBorrowerHistory
library.getMostBorrowedBooks
library.generateLibraryReport
library.draftOverdueReminder
library.recommendBooksForGrade
```

---

## 17. Frontend Routes - V1

```txt
/admin/library
/admin/library/books
/admin/library/books/new
/admin/library/books/[bookId]
/admin/library/books/[bookId]/edit
/admin/library/books/[bookId]/copies
/admin/library/issue
/admin/library/returns
/admin/library/loans
/admin/library/overdue
/admin/library/borrowers
/admin/library/reports
/admin/library/settings
/admin/library/imports
```

## 18. Frontend Routes - V2

```txt
/admin/library/reservations
/admin/library/notices
/admin/library/scan
/student/library
/teacher/library
/parent/library
```

---

## 19. Frontend Pages and Components - V1

### 19.1 Library dashboard

Route:

```txt
/admin/library
```

Sections:

- Header
- KPI cards
- Quick actions
- Recent borrowings
- Due today
- Overdue list
- Popular books
- Low availability books

Components:

```txt
LibraryDashboardPage
LibraryStatsGrid
LibraryStatCard
RecentLoansCard
DueTodayCard
OverdueLoansCard
PopularBooksCard
LowAvailabilityBooksCard
LibraryQuickActions
```

### 19.2 Books catalogue

Route:

```txt
/admin/library/books
```

Features:

- Search
- Category filter
- Subject filter
- Grade filter
- Availability filter
- Status filter
- Sort dropdown
- Card/table view toggle
- Pagination or infinite scroll
- Empty state
- Loading skeleton

Components:

```txt
LibraryBooksPage
LibraryBookFilters
LibraryBookSearchInput
LibraryBookCard
LibraryBookGrid
LibraryBookTable
LibraryBookEmptyState
LibraryBookSkeleton
```

### 19.3 Add/Edit book form

Routes:

```txt
/admin/library/books/new
/admin/library/books/[bookId]/edit
```

Fields:

```txt
Title
Subtitle
Author
Publisher
ISBN
Edition
Publication Year
Category
Subject
Grade Levels
Language
Description
Cover Image
Shelf Location
Tags
Initial Copies
Acquisition Cost
```

Components:

```txt
LibraryBookForm
BookCoverUploadField
BookMetadataSection
BookAcademicSection
BookInventorySection
BookTagsInput
```

### 19.4 Book detail

Route:

```txt
/admin/library/books/[bookId]
```

Sections:

- Book header
- Availability summary
- Copies table
- Recent loans
- Borrowing history
- Quick actions

Components:

```txt
LibraryBookDetailPage
LibraryBookHeader
BookAvailabilitySummary
BookCopiesTable
BookRecentLoans
BookActionMenu
```

### 19.5 Copies management

Route:

```txt
/admin/library/books/[bookId]/copies
```

Components:

```txt
BookCopiesPage
BookCopiesTable
AddCopyModal
BulkAddCopiesModal
EditCopyModal
CopyStatusBadge
CopyConditionBadge
```

### 19.6 Issue book flow

Route:

```txt
/admin/library/issue
```

Flow:

```txt
Search borrower → Select borrower → Search/select book → Select available copy → Set due date → Confirm issue
```

Components:

```txt
IssueBookPage
BorrowerSearchStep
BorrowerResultCard
BookSearchStep
BookResultCard
AvailableCopiesSelector
DueDateSelector
IssueLoanReviewCard
IssueLoanConfirmButton
```

### 19.7 Return book flow

Route:

```txt
/admin/library/returns
```

Flow:

```txt
Search loan/copy/borrower → Select active loan → Choose return condition → Review fine/replacement fee → Confirm return
```

Components:

```txt
ReturnBookPage
LoanSearchInput
ActiveLoanResultCard
ReturnConditionSelector
FinePreviewCard
ReplacementFeeCard
ReturnConfirmationDialog
```

### 19.8 Loans page

Route:

```txt
/admin/library/loans
```

Components:

```txt
LibraryLoansPage
LibraryLoansTable
LoanStatusTabs
LoanFilters
LoanActionsDropdown
LoanDetailDrawer
RenewLoanDialog
MarkLostDialog
MarkDamagedDialog
WaiveFineDialog
```

### 19.9 Overdue page

Route:

```txt
/admin/library/overdue
```

Features:

- Filter by borrower type
- Filter by class group
- Show days overdue
- Show fine amount
- Bulk send reminders
- Mark returned
- Renew
- Mark lost
- Create fee charge

Components:

```txt
OverdueLoansPage
OverdueLoanCard
OverdueLoansTable
BulkReminderBar
OverdueFilters
DaysOverdueBadge
```

### 19.10 Borrowers page

Route:

```txt
/admin/library/borrowers
```

Components:

```txt
LibraryBorrowersPage
BorrowerActivityTable
BorrowerActivityCard
BorrowerLibraryDrawer
```

### 19.11 Reports page

Route:

```txt
/admin/library/reports
```

Reports:

```txt
Most Borrowed Books
Most Active Readers
Students With Overdue Books
Books Not Borrowed Recently
Damaged/Lost Books
Category Usage
Class Reading Activity
Inventory Value
```

Components:

```txt
LibraryReportsPage
ReportTypeSelector
ReportDateRangePicker
MostBorrowedBooksReport
ActiveReadersReport
OverdueReport
LostDamagedReport
CategoryUsageChart
ClassActivityReport
InventoryValueReport
ExportReportButton
```

### 19.12 Settings page

Route:

```txt
/admin/library/settings
```

Sections:

- Loan rules
- Borrowing limits
- Renewal rules
- Fines and replacement fees
- Notifications
- Advanced settings

Components:

```txt
LibrarySettingsPage
LoanRulesForm
BorrowingLimitsForm
RenewalRulesForm
LibraryFineSettingsForm
LibraryNotificationSettingsForm
```

### 19.13 Imports page

Route:

```txt
/admin/library/imports
```

Components:

```txt
LibraryImportsPage
LibraryCsvUploadCard
ImportTypeSelector
ImportTemplateDownload
ImportJobTable
ImportErrorTable
```

---

## 20. Frontend Pages and Components - V2

### Reservations

Route:

```txt
/admin/library/reservations
```

Components:

```txt
LibraryReservationsPage
ReservationQueueTable
ReservationStatusBadge
FulfillReservationDialog
CancelReservationDialog
```

### Scanner

Route:

```txt
/admin/library/scan
```

Use cases:

- Scan copy to issue
- Scan copy to return
- Scan copy to view details

Components:

```txt
LibraryScannerPage
ScannerCameraView
ScannedCopyPreview
ScannerActionSelector
```

### Student library portal

Route:

```txt
/student/library
```

Components:

```txt
StudentLibraryPage
StudentBookBrowser
StudentCurrentLoans
StudentReadingHistory
ReserveBookButton
```

### Teacher library portal

Route:

```txt
/teacher/library
```

Components:

```txt
TeacherLibraryPage
TeacherBookBrowser
TeacherCurrentLoans
TeacherResourceReservations
```

### Parent library portal

Route:

```txt
/parent/library
```

Components:

```txt
ParentLibraryPage
ChildLibrarySelector
ChildCurrentLoans
ChildOverdueBooks
ChildLibraryFines
```

### Library notices

Route:

```txt
/admin/library/notices
```

Components:

```txt
LibraryNoticesPage
LibraryNoticeForm
LibraryNoticeAudienceSelector
LibraryNoticeList
```

---

## 21. Frontend Feature Folder Structure

```txt
src/
  features/
    library/
      api/
        library-api.ts
      components/
        dashboard/
        books/
        copies/
        loans/
        borrowers/
        reports/
        settings/
        imports/
        reservations/   # V2
        notices/        # V2
        scanner/        # V2
      hooks/
        use-library-dashboard.ts
        use-library-books.ts
        use-library-book.ts
        use-create-library-book.ts
        use-update-library-book.ts
        use-archive-library-book.ts
        use-library-copies.ts
        use-create-library-copy.ts
        use-library-loans.ts
        use-issue-library-loan.ts
        use-return-library-loan.ts
        use-renew-library-loan.ts
        use-mark-loan-lost.ts
        use-mark-loan-damaged.ts
        use-waive-library-fine.ts
        use-overdue-library-loans.ts
        use-library-borrower-search.ts
        use-library-reports.ts
        use-library-settings.ts
        use-update-library-settings.ts
        use-library-imports.ts
        use-library-reservations.ts # V2
        use-library-notices.ts      # V2
      schemas/
        library-book.schema.ts
        library-copy.schema.ts
        library-loan.schema.ts
        library-settings.schema.ts
        library-import.schema.ts
      types/
        library.types.ts
      utils/
        library-formatters.ts
        library-status.ts
        library-query-keys.ts
```

---

## 22. TanStack Query Resources

### Query keys

```ts
export const libraryKeys = {
  all: ["library"] as const,
  dashboard: (filters?: Record<string, unknown>) =>
    ["library", "dashboard", filters] as const,
  books: (filters?: Record<string, unknown>) =>
    ["library", "books", filters] as const,
  book: (bookId: string) =>
    ["library", "books", bookId] as const,
  copies: (bookId: string, filters?: Record<string, unknown>) =>
    ["library", "books", bookId, "copies", filters] as const,
  loans: (filters?: Record<string, unknown>) =>
    ["library", "loans", filters] as const,
  loan: (loanId: string) =>
    ["library", "loans", loanId] as const,
  overdue: (filters?: Record<string, unknown>) =>
    ["library", "overdue", filters] as const,
  borrowers: (query: string, type?: string) =>
    ["library", "borrowers", query, type] as const,
  reports: (filters?: Record<string, unknown>) =>
    ["library", "reports", filters] as const,
  settings: () =>
    ["library", "settings"] as const,
  imports: () =>
    ["library", "imports"] as const,
};
```

### API client pattern

```ts
export async function libraryFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`/api/library${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const json = await res.json();

  if (!res.ok || json.success === false) {
    throw new Error(json?.error?.message ?? "Library request failed");
  }

  return json.data as T;
}
```

### Example hook

```ts
export function useLibraryBooks(filters: LibraryBookFilters) {
  return useQuery({
    queryKey: libraryKeys.books(filters),
    queryFn: () => libraryApi.listBooks(filters),
    staleTime: 30_000,
  });
}
```

### Mutation invalidation rules

After creating/updating/archiving book, invalidate:

```txt
library.books
library.dashboard
library.book(bookId)
```

After issuing/returning/renewing loan, invalidate:

```txt
library.dashboard
library.loans
library.overdue
library.books
library.book(bookId)
library.copies(bookId)
```

After updating settings, invalidate:

```txt
library.settings
```

---

## 23. UploadThing Requirements

Upload route name:

```txt
libraryBookCoverUploader
```

Constraints:

```txt
Images only
Max file size: 2MB or 4MB
Allowed types: image/jpeg, image/png, image/webp
One cover per book
```

Store:

```ts
coverImageUrl: string;
coverImageKey: string;
```

When replacing a cover:

1. Upload new image.
2. Update book record.
3. Optionally delete old UploadThing file.
4. Do not fail book update if old file deletion fails; log the failure.

---

## 24. Security Requirements

- All endpoints require authentication.
- All endpoints require school membership.
- Mutations require permissions.
- Every query must include `schoolId`.
- Validate all request bodies and query params with Zod.
- Rate-limit search, import, reminder, and code lookup endpoints.
- Do not expose unnecessary student/parent/teacher data.
- CSV imports must validate file type and size.
- CSV exports should protect against formula injection by escaping values starting with `=`, `+`, `-`, or `@`.

---

## 25. Error Codes

```txt
LIBRARY_BOOK_NOT_FOUND
LIBRARY_COPY_NOT_FOUND
LIBRARY_COPY_NOT_AVAILABLE
LIBRARY_COPY_ALREADY_BORROWED
LIBRARY_LOAN_NOT_FOUND
LIBRARY_LOAN_NOT_ACTIVE
LIBRARY_BORROWER_NOT_FOUND
LIBRARY_BORROWER_LIMIT_REACHED
LIBRARY_RENEWAL_NOT_ALLOWED
LIBRARY_RENEWAL_LIMIT_REACHED
LIBRARY_INVALID_DUE_DATE
LIBRARY_FINE_ALREADY_PAID
LIBRARY_PERMISSION_DENIED
LIBRARY_IMPORT_INVALID_FILE
LIBRARY_IMPORT_TOO_LARGE
LIBRARY_RESERVATION_NOT_FOUND
LIBRARY_RESERVATION_DUPLICATE
```

---

## 26. Performance Requirements

### Required indexes

```txt
LibraryBook: schoolId + status + category
LibraryBook: schoolId + title/author/isbn text search
LibraryBookCopy: schoolId + bookId + status
LibraryBookCopy: schoolId + copyCode unique
LibraryLoan: schoolId + status + dueAt
LibraryLoan: schoolId + borrowerType + borrowerId + status
LibraryLoan: schoolId + bookCopyId + isOpen unique partial
```

### Pagination

Default limit:

```txt
20
```

Max limit:

```txt
100
```

### Aggregation

Avoid MongoDB features unsupported on lower Atlas tiers, such as `$function`.

If library data grows, introduce cached summary collections later.

---

## 27. CSV Export Requirements

V1 should support CSV export for:

```txt
Books catalogue
Copies list
Loans list
Overdue loans
Reports
```

V2 should support PDF export for selected reports.

Exports must respect current filters.

---

## 28. Notification Templates

### Loan issued

```txt
Hello {borrowerName}, you have borrowed "{bookTitle}" from the school library. Due date: {dueDate}.
```

### Due soon

```txt
Reminder: "{bookTitle}" is due on {dueDate}. Please return or renew it on time.
```

### Overdue student parent message

```txt
Dear parent, your child {studentName} has an overdue library book: "{bookTitle}". Due date: {dueDate}. Please remind them to return it.
```

### Lost/damaged book

```txt
The library book "{bookTitle}" has been marked as {status}. Replacement/damage fee: {amount}.
```

---

## 29. UI Design Guidance

The Library module should match the premium EduSentrix dashboard style.

### Style principles

- Premium cards
- Subtle shadows or clean borders
- Clear whitespace
- Strong visual hierarchy
- Smooth step transitions
- Responsive layout
- Skeleton loaders
- Helpful empty states
- Toast feedback for all mutations
- Clear destructive confirmation dialogs

### Status semantics

Use design tokens, not hardcoded colors.

```txt
Available: success
Borrowed: info
Due soon: warning
Overdue: destructive
Lost: destructive strong
Damaged: warning/danger
Archived: muted
Returned: success
```

### Accessibility

- Dialogs must be keyboard accessible.
- Forms must show field-level errors.
- Tables should convert to cards on mobile.
- Do not rely only on color for status.
- Buttons must have clear labels.

---

## 30. Mobile App Considerations

The mobile app will be developed later, but the backend should already support mobile usage.

### Future librarian/admin mobile features

```txt
Dashboard summary
Search book
Issue book
Return book
View overdue
Scan QR/barcode
```

### Future student mobile features

```txt
Browse library
View borrowed books
Reserve book
View reading history
```

### Future parent mobile features

```txt
View child’s borrowed books
View overdue books
View library fines
```

### Mobile API rules

- Use lightweight list items.
- Support pagination.
- Support search endpoints.
- QR/barcode lookup must be fast.
- Support bearer token authentication.

---

## 31. Acceptance Criteria - V1

These criteria apply to **full V1** (after **V1.3**). For incremental releases, map each bullet to **§4.5** (sub-version matrix) and verify the corresponding **§36** sub-version DoD first.

### Books

- Admin/librarian can create a book.
- Admin/librarian can upload a cover.
- Admin/librarian can edit a book.
- Admin/librarian can archive a book.
- Book list supports search, filter, sort, and pagination.
- Book detail shows counters and copies.

### Copies

- Admin/librarian can add one or many copies.
- Each copy has a unique copy code within the school.
- Copy status changes update book counters.
- Borrowed copy cannot be archived directly.

### Loans

- Admin/librarian can issue a book to student/teacher/staff.
- System prevents borrowing unavailable copies.
- System prevents borrower from exceeding borrowing limit.
- Admin/librarian can return a book.
- Admin/librarian can renew a loan.
- Admin/librarian can mark book lost/damaged.
- Overdue loans are visible.

### Fines

- If fines are enabled, overdue fine is calculated.
- Fine can be waived by permitted users.
- Lost/damaged replacement amount can be recorded.

### Reports

- Dashboard shows correct totals.
- Reports show most borrowed books, active readers, overdue items, lost/damaged books, category usage, class activity, and inventory value.

### Security

- Unauthorized users cannot access library endpoints.
- Users without permission cannot mutate library data.
- Users cannot access another school’s library data.

### UX

- All forms have validation.
- All mutations show success/error toast.
- Loading and empty states exist.
- UI works on mobile and desktop.

---

## 32. Acceptance Criteria - V2

### Reservations

- Users can reserve unavailable books if enabled.
- Reservation queue is ordered correctly.
- Reservation becomes ready when a copy is available.
- Reservation can be fulfilled into a loan.
- Duplicate active reservations are prevented.

### QR/barcode

- System can generate QR/barcode values for copies.
- Admin/librarian can look up copy by scanned code.
- Scanner flow supports issue and return.

### Student/teacher/parent portals

- Students can browse available books.
- Students can view their own borrowing history.
- Teachers can view their own borrowing history.
- Parents can view their child’s overdue library items.

### Notices

- Librarian/admin can create and publish library notices.
- Notices can target audiences.
- Expired notices are hidden.

### AI

- EduAI can answer common library questions through safe tools.
- EduAI respects permissions and school scoping.

### Fundraising

- Library campaign can be created from library context.
- Campaign tracks target amount and purpose.

---

## 33. Testing Plan

### Backend unit tests

Test:

- create book
- update book
- archive book
- add copies
- generate copy codes
- issue loan
- prevent double borrowing same copy
- prevent borrower limit exceed
- return loan
- renew loan
- mark lost
- mark damaged
- calculate fines
- waive fine
- mark overdue loans
- settings defaults
- CSV row validation

### Backend integration tests

Test API endpoints with:

- authenticated school admin
- librarian
- teacher
- unauthorized user
- user from another school

Critical cases:

- user cannot access another school’s book
- issue loan updates copy and book counters
- return loan updates copy and book counters
- overdue job updates correct loans
- import job handles partial failures

### Frontend tests

Test:

- book form validation
- issue book workflow
- return book workflow
- filters update query
- mutation success state
- mutation error state
- empty states
- permission-based action visibility

### QA scenarios

#### Scenario 1: Add book with 10 copies

Expected:

- Book created.
- 10 copies created.
- `totalCopies = 10`.
- `availableCopies = 10`.

#### Scenario 2: Issue one copy

Expected:

- Loan created.
- Copy status becomes `borrowed`.
- `availableCopies` decreases by 1.
- `borrowedCopies` increases by 1.

#### Scenario 3: Return book in good condition

Expected:

- Loan status becomes `returned`.
- Copy status becomes `available`.
- `returnedAt` is set.
- Counters update.

#### Scenario 4: Book becomes overdue

Expected:

- Active loan past due date becomes overdue.
- Overdue page shows the loan.
- Fine is calculated if enabled.

#### Scenario 5: Lost book

Expected:

- Loan status becomes `lost`.
- Copy status becomes `lost`.
- `lostCopies` increases.
- Replacement amount is recorded.

---

## 34. Implementation roadmap (phases by sub-version)

This section is the **execution order**. Phases are sequential **within** a sub-version. Complete the sub-version **Definition of Done** (§36) before starting the next sub-version.

---

### V1.0 — Catalogue & inventory

#### Phase V1.0-A — Backend foundation

Deliverables:

```txt
LibraryBook model
LibraryBookCopy model
LibrarySettings model (defaults + fields needed for V1.1 enforcement)
Validators (books, copies, settings)
library.permissions.ts — BOOKS_*, COPIES_*, SETTINGS keys used in V1.0
library-book.service.ts / library-copy.service.ts / library-settings.service.ts
Route handlers: books, books/[bookId], copies; settings GET + PATCH
schoolId from auth context only; pagination on list endpoints
Audit hooks for book and copy mutations
Unit tests: validation + core service behaviors
```

#### Phase V1.0-B — Admin UI: catalogue & copies

Deliverables:

```txt
/admin/library — minimal dashboard (inventory counts, no fake loan metrics)
/admin/library/books — list, filters, pagination
/admin/library/books/new — create
/admin/library/books/[bookId] — detail, edit, archive
/admin/library/books/[bookId]/copies — copy management
Cover upload (UploadThing) integrated on book create/edit
/admin/library/settings — basic settings form
TanStack Query hooks; loading / empty / error states
Frontend tests: critical form validation paths
```

---

### V1.1 — Circulation core

#### Phase V1.1-A — Backend: loans & borrowers

Deliverables:

```txt
LibraryLoan model
library-loan.service.ts — issue, return, renew; counter updates on book/copy
Enforce max loans and loan durations from LibrarySettings
borrowers/search API (students, teachers, staff) as per §12
Route handlers: loans, loans/[loanId], return, renew; issue workflow
Permissions: LOANS_* used in V1.1
Audit hooks for issue/return/renew
Tests: double-issue prevention, limit exceed, counter consistency on return
```

#### Phase V1.1-B — Admin UI: circulation

Deliverables:

```txt
/admin/library/issue — issue flow (borrower + copy selection)
/admin/library/returns — return flow
/admin/library/loans — list and filters
Loan detail view (read-only + actions per permission)
Integration tests: happy path issue/return/renew
```

---

### V1.2 — Exceptions, overdues & fees

#### Phase V1.2-A — Backend: overdue & money paths

Deliverables:

```txt
Overdue query APIs; loan status transitions to overdue (cron/job or documented batch)
mark-lost / mark-damaged routes; copy + loan terminal states
Fine calculation per settings; waive-fine route where specified
Replacement fee fields / records; fee module integration stubs (events or nullable foreign keys)
library.jobs.ts — overdue evaluation entry point
Tests: overdue detection, fine math edge cases, lost/damaged counter updates
```

#### Phase V1.2-B — Admin UI: exceptions

Deliverables:

```txt
/admin/library/overdue — list, filters, actions
UI for mark lost/damaged; fine display and waive where allowed
Optional: manual “send reminders” trigger UI if API exists (delivery may be stub)
```

---

### V1.3 — History, reports, imports & integrations

#### Phase V1.3-A — Backend: imports, reports, history, events

Deliverables:

```txt
LibraryImportJob model + import + import/[jobId] routes
library-import.service.ts — row validation, partial failure behavior
library-report.service.ts — implement report types in priority order (see below)
Borrower / history endpoints for student and teacher/staff as per API spec
Notification integration points (e.g. outbox records or domain events) for reminders
Audit sweep for remaining mutations
Integration tests: import partial failure; school isolation on reports
```

Suggested **report rollout order** (adjust per school pilot feedback):

```txt
1. overdue
2. most_borrowed
3. inventory_value
4. active_readers
5. lost_damaged
6. category_usage
7. class_activity
```

#### Phase V1.3-B — Admin UI: visibility & bulk

Deliverables:

```txt
Dashboard widgets — inventory + circulation + overdue snapshot
/admin/library/reports — type picker, date range, export if spec requires
/admin/library/imports — upload, job status, error download
Borrowing history views (authorized roles only)
Wire notification hooks to existing school notification system where available
```

---

### V2 — After V1.3 is stable

Follow **§5 V2 Scope** and keep V2 work isolated (new routes/models as marked in §9). Do not collapse V2 into V1.3 deliverables.

---

### Deprecated: old monolithic phase list

The former single-track “Phase 1–5” list is superseded by **V1.0–V1.3** phases above. **Phase 5 (V2)** is now **§5 + V2 subsection** only.

---

## 35. AI Agent Build Instructions

When an AI coding agent builds this module:

1. Do not build V2 before **V1.3** (full V1) is stable; do not build **V1.n+1** before **V1.n** meets its Definition of Done (§36).
2. Start with **V1.0-A**: models, validators, services, and permissions — then **V1.0-B** UI.
3. Keep business logic inside services, not route handlers.
4. Always enforce `schoolId` scoping.
5. Always check permissions before mutations.
6. Do not allow frontend mutation of derived counters.
7. Always update book counters through service functions.
8. Use TanStack Query hooks for frontend data fetching.
9. Use shadcn/ui and EduSentrix design tokens.
10. Use Zod for all forms and APIs.
11. Build reusable components.
12. Add loading, error, empty, and success states.
13. Add audit logs for all meaningful mutations **scheduled for the current sub-version** (complete audit by end of V1.3).
14. Add tests for service logic.
15. Prefer archive over hard delete.
16. Do not expose data from another school.
17. Do not expose sensitive borrower data in search results.

---

## 36. Definition of Done (by sub-version and full V1)

Gate each release on the **sub-version checklist** below. **Full V1** is complete only when **V1.3** is done.

---

### V1.0 Definition of Done

1. Admin/librarian can create, edit, archive books and manage copies with cover upload.
2. Book list and detail reflect **correct** `availableCopies` / `totalCopies` (or equivalent fields) for inventory-only states (**borrowed count zero** or not yet used is acceptable if copies are marked available).
3. Library settings can be loaded and updated; defaults are applied on new schools.
4. Routes are protected by auth, school scoping, and **books/copies/settings** permissions.
5. Audit log entries exist for book and copy **create / update / archive** paths defined in V1.0.
6. Backend tests cover book/copy validation; smoke tests cover list + detail APIs.

---

### V1.1 Definition of Done

1. Admin/librarian can **issue**, **return**, and **renew** loans for students, teachers, and staff against available copies.
2. **Double issue** of the same copy is impossible; **borrower limits** from settings are enforced.
3. `availableCopies` / `borrowedCopies` (or equivalent) update correctly on issue and return.
4. `/issue`, `/returns`, `/loans` flows are usable end-to-end with **loading/error** states.
5. Audit entries exist for issue, return, renew.
6. Tests cover issue/return/renew and counter consistency.

---

### V1.2 Definition of Done

1. Overdue loans appear on **Overdue** views/APIs using agreed rules (cron or on-read transition documented in code/module README if not in this spec).
2. Staff can **mark lost** and **mark damaged**; loan and copy terminal states match §12 behavior.
3. When fines are enabled in settings, fine amounts are calculated and stored consistently; **waive** (if in scope) works.
4. Replacement fees can be recorded for lost/damaged per spec; **fee module integration stub** is present (events or schema hooks) without blocking UI.
5. Audit entries exist for overdue transitions, lost/damaged, fine actions.
6. Tests cover overdue boundary dates, fine math, and lost/damaged counters.

---

### V1.3 Definition of Done

1. **Student** and **teacher/staff** borrowing histories are visible to authorized users (per §6).
2. **Basic reports** — at minimum **overdue** and **most_borrowed** — work; additional types per **§34 V1.3-A** rollout order as time allows (document which ship in MVP vs fast-follow).
3. **CSV import** works with **row-level errors** and job status (`LibraryImportJob`).
4. **Dashboard** shows useful inventory + circulation + overdue metrics (not placeholders).
5. **Notification integration points** exist for at least one path (e.g. overdue reminder enqueue) even if external delivery is async.
6. Routes remain protected; audit sweep complete for high-value mutations across the module.
7. UI is responsive and matches EduSentrix premium design.
8. Frontend + backend tests cover import partial failure, report queries with school isolation, and critical paths from V1.0–V1.2 regressions.

---

### Full V1 complete

**V1** (all sub-versions) is complete when **V1.0 through V1.3** definitions above are satisfied. Then proceed to **V2** per §5.

---

## 37. Future Opportunities Beyond V2

Later versions can explore:

- Library membership cards
- RFID support
- Multi-branch library support
- Inter-school book sharing
- Reading competitions
- Student book reviews
- Teacher-curated reading lists
- AI-generated reading summaries
- LMS integration
- Library procurement planning
- Parent book sponsorship
- Public school library donation pages
- EduSentrix Connect API access for approved library partners

---

## 38. Final Recommendation

Ship **V1** as **four sub-versions** (§4, §34, §36):

```txt
V1.0 — Books, copies, settings, minimal dashboard.
V1.1 — Issue, return, renew, loans, borrower search.
V1.2 — Overdue, lost/damaged, fines, replacement fees, fee hooks.
V1.3 — History, reports, CSV import, notification points, full dashboard.
```

Then build **V2** as the engagement layer (§5):

```txt
Reservations, barcode/QR scanning, student/parent portals, notices, Leo's Recommendations, fundraising, mobile support.
```

This sequencing keeps each release usable in real schools and avoids blocking circulation on imports or reports.

This will make EduSentrix feel more complete, more premium, and more useful to real schools.
