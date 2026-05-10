/**
 * Single source of truth for delegatable modules, presets, and permission strings.
 * Server derives `permissions[]` from `preset` — clients must not send raw permissions.
 */
import type { DelegationModule } from "./types";

export type DelegationPresetDefinition = {
  label: string;
  description: string;
  permissions: readonly string[];
};

export type DelegationModuleDefinition = {
  label: string;
  description: string;
  /** Admin module path (contextual "Delegate access" button). */
  adminHref: string;
  /** Where delegates open the module (teacher shell). Omit if not yet routable. */
  delegateHref: string | null;
  showContextualDelegateButton: boolean;
  /** If false, admin UI must not offer granting this module yet. */
  implemented: boolean;
  presets: Record<string, DelegationPresetDefinition>;
};

export const DELEGATION_REGISTRY: Record<DelegationModule, DelegationModuleDefinition> = {
  admissions: {
    label: "Admissions",
    description:
      "Review applications, request documents, and manage applicant communication.",
    adminHref: "/admin/admissions",
    delegateHref: "/teacher/admissions",
    showContextualDelegateButton: true,
    implemented: true,
    presets: {
      viewer: {
        label: "Viewer",
        description:
          "View cycles, applications, documents, and timelines.",
        permissions: ["admissions.view"],
      },
      reviewer: {
        label: "Reviewer",
        description:
          "Viewer plus notes, status updates, document requests, emails, interviews.",
        permissions: [
          "admissions.view",
          "admissions.comment",
          "admissions.change_status",
          "admissions.send_email",
          "admissions.request_document",
          "admissions.schedule_interview",
        ],
      },
      manager: {
        label: "Manager",
        description: "Reviewer plus form edits and public cycle operations.",
        permissions: [
          "admissions.view",
          "admissions.comment",
          "admissions.change_status",
          "admissions.send_email",
          "admissions.request_document",
          "admissions.request_payment",
          "admissions.schedule_interview",
          "admissions.manage_form",
          "admissions.manage_cycle",
        ],
      },
      decision_maker: {
        label: "Decision maker",
        description:
          "Manager plus accept, reject, waitlist, provision, and export.",
        permissions: [
          "admissions.view",
          "admissions.comment",
          "admissions.change_status",
          "admissions.send_email",
          "admissions.request_document",
          "admissions.request_payment",
          "admissions.schedule_interview",
          "admissions.manage_form",
          "admissions.manage_cycle",
          "admissions.decide",
          "admissions.provision_student",
          "admissions.export",
        ],
      },
    },
  },
  polls: {
    label: "Polls",
    description: "School polls and voting.",
    adminHref: "/admin/community/polls",
    delegateHref: "/admin/community/polls",
    showContextualDelegateButton: true,
    implemented: true,
    presets: {
      viewer: {
        label: "Viewer",
        description: "View polls and results.",
        permissions: ["polls.view"],
      },
      manager: {
        label: "Manager",
        description: "Create, edit, publish, close, export.",
        permissions: [
          "polls.view",
          "polls.create",
          "polls.edit",
          "polls.publish",
          "polls.close",
          "polls.export",
        ],
      },
    },
  },
  fundraising: {
    label: "Fundraising",
    description: "Fundraising campaigns and donations.",
    adminHref: "/admin/community/fundraising",
    delegateHref: "/admin/community/fundraising",
    showContextualDelegateButton: true,
    implemented: true,
    presets: {
      viewer: {
        label: "Viewer",
        description: "View campaigns and donations.",
        permissions: ["fundraising.view"],
      },
      campaign_manager: {
        label: "Campaign manager",
        description: "Create, edit, publish, post updates, export donations.",
        permissions: [
          "fundraising.view",
          "fundraising.create",
          "fundraising.edit",
          "fundraising.publish",
          "fundraising.close",
          "fundraising.post_update",
          "fundraising.export",
        ],
      },
    },
  },
  meetings: {
    label: "Meetings",
    description: "School meetings and invites.",
    adminHref: "/admin/meetings",
    delegateHref: "/admin/meetings",
    showContextualDelegateButton: true,
    implemented: true,
    presets: {
      viewer: {
        label: "Viewer",
        description: "View meetings.",
        permissions: ["meetings.view"],
      },
      organizer: {
        label: "Organizer",
        description: "Create, edit, start, cancel, invite.",
        permissions: [
          "meetings.view",
          "meetings.create",
          "meetings.edit",
          "meetings.start",
          "meetings.cancel",
          "meetings.invite",
        ],
      },
    },
  },
  academic_calendar: {
    label: "Academic Calendar",
    description: "School calendar events.",
    adminHref: "/admin/academic-calendar",
    delegateHref: "/admin/academic-calendar",
    showContextualDelegateButton: true,
    implemented: true,
    presets: {
      viewer: {
        label: "Viewer",
        description: "View calendar.",
        permissions: ["calendar.view"],
      },
      editor: {
        label: "Editor",
        description: "Create and edit school events.",
        permissions: [
          "calendar.view",
          "calendar.create",
          "calendar.edit",
          "calendar.delete",
          "calendar.notify",
        ],
      },
    },
  },
  documents: {
    label: "Documents",
    description: "Shared school documents.",
    adminHref: "/admin/documents",
    delegateHref: "/admin/documents",
    showContextualDelegateButton: true,
    implemented: true,
    presets: {
      viewer: {
        label: "Viewer",
        description: "View shared documents.",
        permissions: ["documents.view"],
      },
      manager: {
        label: "Manager",
        description: "Upload, categorize, share, archive.",
        permissions: [
          "documents.view",
          "documents.upload",
          "documents.edit",
          "documents.share",
          "documents.archive",
          "documents.export",
        ],
      },
    },
  },
  supplies: {
    label: "Supply Programs",
    description: "Supply lists and fulfillment.",
    adminHref: "/admin/supplies",
    delegateHref: "/admin/supplies",
    showContextualDelegateButton: true,
    implemented: true,
    presets: {
      viewer: {
        label: "Viewer",
        description: "View programs and requests.",
        permissions: ["supplies.view"],
      },
      manager: {
        label: "Manager",
        description: "Create programs, review requests, update fulfillment.",
        permissions: [
          "supplies.view",
          "supplies.create_program",
          "supplies.edit_program",
          "supplies.review_request",
          "supplies.update_fulfillment",
          "supplies.export",
        ],
      },
    },
  },
  store: {
    label: "School Store",
    description: "Store products and orders.",
    adminHref: "/admin/store",
    delegateHref: "/admin/store",
    showContextualDelegateButton: true,
    implemented: true,
    presets: {
      viewer: {
        label: "Viewer",
        description: "View products and orders.",
        permissions: ["store.view"],
      },
      operator: {
        label: "Store operator",
        description: "Manage products and process orders.",
        permissions: [
          "store.view",
          "store.manage_products",
          "store.process_orders",
          "store.update_order_status",
          "store.export",
        ],
      },
    },
  },
  reports: {
    label: "Reports",
    description: "Reports and exports.",
    adminHref: "/admin/reports",
    delegateHref: "/admin/reports",
    showContextualDelegateButton: true,
    implemented: true,
    presets: {
      viewer: {
        label: "Viewer",
        description: "View dashboards and reports.",
        permissions: ["reports.view"],
      },
      exporter: {
        label: "Exporter",
        description: "View and export reports.",
        permissions: ["reports.view", "reports.export"],
      },
    },
  },
  staff_attendance: {
    label: "Staff Attendance",
    description: "Staff attendance records.",
    adminHref: "/admin/staff-attendance",
    delegateHref: "/admin/staff-attendance",
    showContextualDelegateButton: true,
    implemented: true,
    presets: {
      viewer: {
        label: "Viewer",
        description: "View attendance.",
        permissions: ["staff_attendance.view"],
      },
      recorder: {
        label: "Recorder",
        description: "Mark attendance and add notes.",
        permissions: [
          "staff_attendance.view",
          "staff_attendance.record",
          "staff_attendance.edit",
        ],
      },
    },
  },
  invitations: {
    label: "Invitations",
    description: "School invitations.",
    adminHref: "/admin/invitations",
    delegateHref: "/admin/invitations",
    showContextualDelegateButton: true,
    implemented: true,
    presets: {
      viewer: {
        label: "Viewer",
        description: "View invitations.",
        permissions: ["invitations.view"],
      },
      sender: {
        label: "Sender",
        description: "Send and resend invitations.",
        permissions: ["invitations.view", "invitations.send", "invitations.resend"],
      },
      coordinator: {
        label: "Coordinator",
        description: "Viewer plus revoke invitations.",
        permissions: [
          "invitations.view",
          "invitations.send",
          "invitations.resend",
          "invitations.revoke",
        ],
      },
    },
  },
  library: {
    label: "Library",
    description: "Catalogue, copies, and circulation settings.",
    adminHref: "/admin/library",
    delegateHref: "/admin/library",
    showContextualDelegateButton: true,
    implemented: true,
    presets: {
      viewer: {
        label: "Viewer",
        description: "Browse the catalogue, copy details, and circulation summary.",
        permissions: [
          "library.books.read",
          "library.copies.read",
          "library.loans.read",
          "library.fines.read",
          "library.reports.view",
          "library.reservations.read",
        ],
      },
      librarian: {
        label: "Librarian",
        description: "Manage books, copies, circulation, and library settings.",
        permissions: [
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
          "library.fines.waive",
          "library.reports.view",
          "library.settings.manage",
          "library.notices.manage",
          "library.reservations.read",
          "library.reservations.manage",
        ],
      },
    },
  },
  email: {
    label: "Email",
    description: "Operational school email (not system configuration).",
    adminHref: "/admin/email",
    delegateHref: "/admin/email",
    showContextualDelegateButton: true,
    implemented: true,
    presets: {
      viewer: {
        label: "Viewer",
        description: "View email activity.",
        permissions: ["email.view"],
      },
      sender: {
        label: "Sender",
        description: "Send operational messages.",
        permissions: ["email.view", "email.send"],
      },
    },
  },
  fees: {
    label: "Fees & Payments",
    description: "Fee records and limited payment actions (no setup or approvals).",
    adminHref: "/admin/fees",
    delegateHref: "/admin/fees",
    showContextualDelegateButton: true,
    implemented: true,
    presets: {
      viewer: {
        label: "Viewer",
        description: "View fee records and invoices.",
        permissions: ["fees.view"],
      },
      assistant: {
        label: "Assistant",
        description: "Reminders, offline payments, export.",
        permissions: ["fees.view", "fees.send_reminder", "fees.record_payment", "fees.export"],
      },
    },
  },
  expenses: {
    label: "Expenses",
    description: "Expense records (no approvals or disbursements).",
    adminHref: "/admin/expenses",
    delegateHref: "/admin/expenses",
    showContextualDelegateButton: true,
    implemented: true,
    presets: {
      viewer: {
        label: "Viewer",
        description: "View expenses.",
        permissions: ["expenses.view"],
      },
      recorder: {
        label: "Recorder",
        description: "Create expenses and upload receipts.",
        permissions: ["expenses.view", "expenses.create", "expenses.upload_receipt", "expenses.export"],
      },
    },
  },
  students: {
    label: "Students",
    description: "Student records (scoped; high-impact actions admin-only).",
    adminHref: "/admin/students",
    delegateHref: "/admin/students",
    showContextualDelegateButton: true,
    implemented: true,
    presets: {
      viewer: {
        label: "Viewer",
        description: "View student profiles.",
        permissions: ["students.view"],
      },
      editor: {
        label: "Editor",
        description: "Update allowed student fields.",
        permissions: ["students.view", "students.edit"],
      },
    },
  },
  grades: {
    label: "Grades",
    description: "Grade configuration.",
    adminHref: "/admin/grades",
    delegateHref: "/admin/grades",
    showContextualDelegateButton: true,
    implemented: true,
    presets: {
      viewer: { label: "Viewer", description: "View grades.", permissions: ["grades.view"] },
      editor: {
        label: "Editor",
        description: "Create and edit grades.",
        permissions: ["grades.view", "grades.edit"],
      },
    },
  },
  subjects: {
    label: "Subjects",
    description: "Subjects catalog.",
    adminHref: "/admin/subjects",
    delegateHref: "/admin/subjects",
    showContextualDelegateButton: true,
    implemented: true,
    presets: {
      viewer: { label: "Viewer", description: "View subjects.", permissions: ["subjects.view"] },
      editor: {
        label: "Editor",
        description: "Manage subjects.",
        permissions: ["subjects.view", "subjects.edit"],
      },
    },
  },
  curriculum: {
    label: "Curriculum",
    description: "Curriculum settings.",
    adminHref: "/admin/settings/curriculum",
    delegateHref: "/admin/settings/curriculum",
    showContextualDelegateButton: true,
    implemented: true,
    presets: {
      viewer: {
        label: "Viewer",
        description: "View curriculum configuration.",
        permissions: ["curriculum.view"],
      },
      editor: {
        label: "Editor",
        description: "Edit curriculum configuration.",
        permissions: ["curriculum.view", "curriculum.edit"],
      },
    },
  },
  timetable: {
    label: "Class schedules",
    description: "Class schedule planning and publishing.",
    adminHref: "/admin/classes",
    delegateHref: "/admin/classes",
    showContextualDelegateButton: true,
    implemented: true,
    presets: {
      viewer: { label: "Viewer", description: "View timetables.", permissions: ["timetable.view"] },
      editor: {
        label: "Editor",
        description: "Edit draft timetables.",
        permissions: ["timetable.view", "timetable.edit"],
      },
    },
  },
  academic_periods: {
    label: "Academic Periods",
    description: "Terms and academic periods.",
    adminHref: "/admin/periods",
    delegateHref: "/admin/periods",
    showContextualDelegateButton: true,
    implemented: true,
    presets: {
      viewer: { label: "Viewer", description: "View periods.", permissions: ["academic_periods.view"] },
      editor: {
        label: "Editor",
        description: "Manage periods.",
        permissions: ["academic_periods.view", "academic_periods.edit"],
      },
    },
  },
  promotions: {
    label: "Promotions",
    description: "Promotion cycles and policies.",
    adminHref: "/admin/promotions",
    delegateHref: "/admin/promotions",
    showContextualDelegateButton: true,
    implemented: true,
    presets: {
      viewer: { label: "Viewer", description: "View promotions.", permissions: ["promotions.view"] },
      operator: {
        label: "Operator",
        description: "Run promotion workflows (non-destructive).",
        permissions: ["promotions.view", "promotions.operate"],
      },
    },
  },
};

export const DELEGATION_MODULE_IDS = Object.keys(
  DELEGATION_REGISTRY
) as DelegationModule[];

export function getModuleDefinition(module: string): DelegationModuleDefinition | null {
  return DELEGATION_REGISTRY[module as DelegationModule] ?? null;
}

export function resolvePresetPermissions(
  module: DelegationModule,
  preset: string
): string[] | null {
  const def = DELEGATION_REGISTRY[module];
  if (!def) return null;
  const p = def.presets[preset];
  if (!p) return null;
  return [...p.permissions];
}

export function listImplementedModules(): DelegationModule[] {
  return DELEGATION_MODULE_IDS.filter((m) => DELEGATION_REGISTRY[m].implemented);
}

/**
 * Longest `adminHref` wins so `/admin/students/foo` maps to `students`, not a shorter prefix.
 */
export function resolveDelegationModuleFromAdminPath(pathname: string): DelegationModule | null {
  const normalized = (pathname.replace(/\/$/, "") || "/").split("?")[0] ?? "/";
  let best: { module: DelegationModule; len: number } | null = null;
  for (const mod of DELEGATION_MODULE_IDS) {
    const def = DELEGATION_REGISTRY[mod];
    if (!def.implemented || !def.showContextualDelegateButton) continue;
    const href = def.adminHref.replace(/\/$/, "");
    if (normalized === href || normalized.startsWith(`${href}/`)) {
      if (!best || href.length > best.len) {
        best = { module: mod, len: href.length };
      }
    }
  }
  return best?.module ?? null;
}
