import mongoose from "mongoose";
import { LibraryBook } from "@/models/LibraryBook";
import { LibraryLoan, type LibraryBorrowerType } from "@/models/LibraryLoan";
import { LibraryReservation } from "@/models/LibraryReservation";
import { Notification } from "@/models/Notification";
import { Guardian } from "@/models/Guardian";
import { School } from "@/models/School";
import { Student } from "@/models/Student";
import { Teacher } from "@/models/Teacher";
import { User } from "@/models/User";
import { getAppUrl } from "@/lib/utils/getAppUrl";

async function queueLibraryTransactionalEmail(params: {
  schoolId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  subject: string;
  innerHtml: string;
  templateKey:
    | "LIBRARY_HOLD_READY"
    | "LIBRARY_LOAN_OVERDUE_REMINDER"
    | "LIBRARY_LOAN_DUE_SOON"
    | "LIBRARY_LOAN_ISSUED";
  recipientRole: string;
}): Promise<void> {
  try {
    const [{ sendTrackedBrevoEmail }, { stripHtml }] = await Promise.all([
      import("@/lib/email"),
      import("@/lib/email/branded-template"),
    ]);
    const u = await User.findById(params.userId).select("email firstName").lean();
    if (!u) return;
    const email = u.email?.trim();
    if (!email) return;
    const school = await School.findById(params.schoolId).select("name logo").lean();
    const htmlContent = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#0f172a">${params.innerHtml}</div>`;
    await sendTrackedBrevoEmail({
      to: email,
      toName: u.firstName ?? null,
      subject: params.subject,
      htmlContent,
      textContent: stripHtml(htmlContent),
      templateKey: params.templateKey,
      schoolId: String(params.schoolId),
      schoolName: school?.name ?? null,
      schoolLogo: (school as { logo?: string } | null)?.logo ?? null,
      recipientUserId: String(params.userId),
      recipientRole: params.recipientRole,
      async: true,
    });
  } catch (e) {
    console.error("[library-notifications] email queue failed:", e);
  }
}

function absoluteAppUrl(path: string): string {
  const appUrl = getAppUrl();
  return path.startsWith("http") ? path : `${appUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function libraryOverdueLoanActionUrl(borrowerType: string): string {
  if (borrowerType === "student") return "/student/library";
  if (borrowerType === "teacher") return "/teacher/library";
  return "/admin/library/overdue";
}

/**
 * V1.3 integration point: enqueue in-app notifications for overdue loans.
 * Resolves borrower → User where possible (linked student/teacher users; staff = user id).
 * Also queues transactional email when the user has an email on file.
 */
export async function enqueueLibraryOverdueReminderNotifications(args: {
  schoolId: mongoose.Types.ObjectId;
  loanIds: mongoose.Types.ObjectId[];
  title?: string;
  body?: string;
}): Promise<{ enqueued: number; skippedLoans: number }> {
  const loans = await LibraryLoan.find({
    _id: { $in: args.loanIds },
    schoolId: args.schoolId,
    isOpen: true,
  }).lean();

  let enqueued = 0;
  let skippedLoans = 0;

  for (const loan of loans) {
    const userIds = await resolveBorrowerRecipientUserIds(args.schoolId, loan);
    if (userIds.length === 0) {
      skippedLoans += 1;
      continue;
    }
    const actionUrl = libraryOverdueLoanActionUrl(loan.borrowerType);
    const abs = absoluteAppUrl(actionUrl);
    const title = args.title ?? "Library loan overdue";
    const body =
      args.body ??
      "You have a library loan that is past its due date. Please return or renew it from the library.";
    for (const userId of userIds) {
      await Notification.create({
        schoolId: args.schoolId,
        userId,
        type: "reminder",
        title,
        body,
        priority: "normal",
        entityType: "LibraryLoan",
        entityId: loan._id,
        actionUrl,
        metadata: { loanId: String(loan._id), module: "library" },
      });
      enqueued += 1;
      await queueLibraryTransactionalEmail({
        schoolId: args.schoolId,
        userId,
        subject: title,
        innerHtml: `<p>Hello,</p><p>${body}</p><p><a href="${abs}" style="color:#4f46e5;">Open library</a></p>`,
        templateKey: "LIBRARY_LOAN_OVERDUE_REMINDER",
        recipientRole: loan.borrowerType,
      });
    }
  }

  if (process.env.NODE_ENV === "development") {
    console.debug("[library-notifications]", {
      loanIds: args.loanIds.length,
      enqueued,
      skippedLoans,
    });
  }

  return { enqueued, skippedLoans };
}

/**
 * Remind patrons of loans due within the configured window (cron-driven).
 * Sets `lastDueSoonReminderAt` when at least one in-app notification was created for the loan.
 */
export async function enqueueLibraryLoanDueSoonNotifications(args: {
  schoolId: mongoose.Types.ObjectId;
  loanIds: mongoose.Types.ObjectId[];
  title?: string;
  body?: string;
}): Promise<{ enqueued: number; skippedLoans: number; loansMarked: number }> {
  if (args.loanIds.length === 0) return { enqueued: 0, skippedLoans: 0, loansMarked: 0 };

  const loans = await LibraryLoan.find({
    _id: { $in: args.loanIds },
    schoolId: args.schoolId,
    isOpen: true,
    status: "active",
  }).lean();

  let enqueued = 0;
  let skippedLoans = 0;
  let loansMarked = 0;
  const now = new Date();

  for (const loan of loans) {
    const userIds = await resolveBorrowerRecipientUserIds(args.schoolId, loan);
    if (userIds.length === 0) {
      skippedLoans += 1;
      continue;
    }
    const actionUrl = libraryOverdueLoanActionUrl(loan.borrowerType);
    const abs = absoluteAppUrl(actionUrl);
    const due = loan.dueAt.toLocaleDateString();
    const title = args.title ?? "Library loan due soon";
    const body =
      args.body ??
      `You have a library loan due on ${due}. Please renew or return it on time.`;

    let anyRecipient = false;
    for (const userId of userIds) {
      await Notification.create({
        schoolId: args.schoolId,
        userId,
        type: "reminder",
        title,
        body,
        priority: "normal",
        entityType: "LibraryLoan",
        entityId: loan._id,
        actionUrl,
        metadata: { loanId: String(loan._id), module: "library", kind: "due_soon" },
      });
      enqueued += 1;
      anyRecipient = true;
      await queueLibraryTransactionalEmail({
        schoolId: args.schoolId,
        userId,
        subject: title,
        innerHtml: `<p>Hello,</p><p>${body}</p><p><a href="${abs}" style="color:#4f46e5;">Open library</a></p>`,
        templateKey: "LIBRARY_LOAN_DUE_SOON",
        recipientRole: loan.borrowerType,
      });
    }

    if (anyRecipient) {
      await LibraryLoan.updateOne(
        { _id: loan._id, schoolId: args.schoolId },
        { $set: { lastDueSoonReminderAt: now } }
      );
      loansMarked += 1;
    } else {
      skippedLoans += 1;
    }
  }

  if (process.env.NODE_ENV === "development") {
    console.debug("[library-notifications] due-soon", {
      loanIds: args.loanIds.length,
      enqueued,
      skippedLoans,
      loansMarked,
    });
  }

  return { enqueued, skippedLoans, loansMarked };
}

export async function enqueueLibraryLoanIssuedNotifications(args: {
  schoolId: mongoose.Types.ObjectId;
  loanIds: mongoose.Types.ObjectId[];
  title?: string;
  body?: string;
}): Promise<{ enqueued: number; skippedLoans: number }> {
  if (args.loanIds.length === 0) return { enqueued: 0, skippedLoans: 0 };

  const loans = await LibraryLoan.find({
    _id: { $in: args.loanIds },
    schoolId: args.schoolId,
  }).lean();

  const bookIds = [...new Set(loans.map((l) => String(l.bookId)))].map(
    (id) => new mongoose.Types.ObjectId(id)
  );
  const books =
    bookIds.length > 0
      ? await LibraryBook.find({ _id: { $in: bookIds }, schoolId: args.schoolId })
          .select("title")
          .lean()
      : [];
  const bookTitleById = new Map(
    books.map((b) => [String(b._id), (b as { title?: string }).title])
  );

  let enqueued = 0;
  let skippedLoans = 0;

  for (const loan of loans) {
    const titleLabel = bookTitleById.get(String(loan.bookId)) ?? "your book";
    const due = loan.dueAt.toLocaleDateString();
    const notifTitle = args.title ?? "Library book issued";
    const patronBody =
      args.body ??
      `You borrowed “${titleLabel}”. It is due on ${due}.`;

    const actionUrl = libraryOverdueLoanActionUrl(loan.borrowerType);
    const abs = absoluteAppUrl(actionUrl);

    const userIds = await resolveBorrowerRecipientUserIds(args.schoolId, loan);
    const notifiedUserIds = new Set<string>();
    let anyRecipient = false;

    for (const userId of userIds) {
      await Notification.create({
        schoolId: args.schoolId,
        userId,
        type: "reminder",
        title: notifTitle,
        body: patronBody,
        priority: "normal",
        entityType: "LibraryLoan",
        entityId: loan._id,
        actionUrl,
        metadata: { loanId: String(loan._id), module: "library", kind: "issued" },
      });
      enqueued += 1;
      anyRecipient = true;
      notifiedUserIds.add(String(userId));
      await queueLibraryTransactionalEmail({
        schoolId: args.schoolId,
        userId,
        subject: notifTitle,
        innerHtml: `<p>Hello,</p><p>${patronBody}</p><p><a href="${abs}" style="color:#4f46e5;">Open library</a></p>`,
        templateKey: "LIBRARY_LOAN_ISSUED",
        recipientRole: loan.borrowerType,
      });
    }

    if (loan.borrowerType === "student") {
      const guardians = await Guardian.find({ studentId: loan.borrowerId }).select("userId").lean();
      const stu = await Student.findOne({ _id: loan.borrowerId, schoolId: args.schoolId })
        .select("firstName lastName")
        .lean();
      const childName =
        `${(stu as { firstName?: string } | null)?.firstName ?? ""} ${(stu as { lastName?: string } | null)?.lastName ?? ""}`.trim() ||
        "your child";
      const parentUrl = `/parent/library/${String(loan.bookId)}`;
      const parentAbs = absoluteAppUrl(parentUrl);
      const parentBody =
        `“${titleLabel}” was checked out to ${childName}. Due on ${due}.`;

      for (const g of guardians) {
        const uid = g.userId as mongoose.Types.ObjectId;
        if (notifiedUserIds.has(String(uid))) continue;
        await Notification.create({
          schoolId: args.schoolId,
          userId: uid,
          type: "reminder",
          title: notifTitle,
          body: parentBody,
          priority: "normal",
          entityType: "LibraryLoan",
          entityId: loan._id,
          actionUrl: parentUrl,
          metadata: {
            loanId: String(loan._id),
            bookId: String(loan.bookId),
            module: "library",
            audience: "parent",
            kind: "issued",
          },
        });
        enqueued += 1;
        anyRecipient = true;
        await queueLibraryTransactionalEmail({
          schoolId: args.schoolId,
          userId: uid,
          subject: notifTitle,
          innerHtml: `<p>Hello,</p><p>${parentBody}</p><p><a href="${parentAbs}" style="color:#4f46e5;">Open parent library</a></p>`,
          templateKey: "LIBRARY_LOAN_ISSUED",
          recipientRole: "parent",
        });
      }
    }

    if (!anyRecipient) skippedLoans += 1;
  }

  if (process.env.NODE_ENV === "development") {
    console.debug("[library-notifications] loan-issued", {
      loanIds: args.loanIds.length,
      enqueued,
      skippedLoans,
    });
  }

  return { enqueued, skippedLoans };
}

export async function resolveBorrowerRecipientUserIds(
  schoolId: mongoose.Types.ObjectId,
  loan: { borrowerType: string; borrowerId: mongoose.Types.ObjectId }
): Promise<mongoose.Types.ObjectId[]> {
  if (loan.borrowerType === "staff") {
    return [loan.borrowerId];
  }
  if (loan.borrowerType === "teacher") {
    const t = await Teacher.findOne({ _id: loan.borrowerId, schoolId }).select("userId").lean();
    const uid = t?.userId as mongoose.Types.ObjectId | undefined;
    return uid ? [uid] : [];
  }
  const s = await Student.findOne({ _id: loan.borrowerId, schoolId }).select("userId").lean();
  const uid = s?.userId as mongoose.Types.ObjectId | undefined;
  return uid ? [uid] : [];
}

function libraryReservationReadyActionUrl(
  borrowerType: LibraryBorrowerType,
  bookId: string
): string {
  if (borrowerType === "student") return `/student/library/${bookId}`;
  if (borrowerType === "teacher") return `/teacher/library/${bookId}`;
  return "/admin/library/reservations";
}

/**
 * In-app notification when a hold becomes ready for pickup (or is created already ready).
 * Queues school-scoped transactional email (same template registry keys as other module emails).
 */
export async function enqueueLibraryReservationReadyNotifications(args: {
  schoolId: mongoose.Types.ObjectId;
  reservationIds: mongoose.Types.ObjectId[];
  title?: string;
  body?: string;
}): Promise<{ enqueued: number; skippedReservations: number }> {
  if (args.reservationIds.length === 0) return { enqueued: 0, skippedReservations: 0 };

  const reservations = await LibraryReservation.find({
    _id: { $in: args.reservationIds },
    schoolId: args.schoolId,
    status: "ready",
  })
    .select("borrowerType borrowerId bookId")
    .lean();

  const bookIds = [...new Set(reservations.map((r) => String(r.bookId)))].map(
    (id) => new mongoose.Types.ObjectId(id)
  );
  const books =
    bookIds.length > 0
      ? await LibraryBook.find({ _id: { $in: bookIds }, schoolId: args.schoolId })
          .select("title")
          .lean()
      : [];
  const bookTitleById = new Map(books.map((b) => [String(b._id), (b as { title?: string }).title]));

  let enqueued = 0;
  let skippedReservations = 0;

  for (const res of reservations) {
    const userIds = await resolveBorrowerRecipientUserIds(args.schoolId, {
      borrowerType: res.borrowerType,
      borrowerId: res.borrowerId,
    });
    const title = bookTitleById.get(String(res.bookId)) ?? "A title";
    const actionUrl = libraryReservationReadyActionUrl(res.borrowerType, String(res.bookId));
    const abs = absoluteAppUrl(actionUrl);
    const notifTitle = args.title ?? "Library hold ready";
    const patronBody = args.body ?? `“${title}” is ready for pickup.`;

    const notifiedUserIds = new Set<string>();
    let anyRecipient = false;

    for (const userId of userIds) {
      await Notification.create({
        schoolId: args.schoolId,
        userId,
        type: "reminder",
        title: notifTitle,
        body: patronBody,
        priority: "normal",
        entityType: "LibraryReservation",
        entityId: res._id,
        actionUrl,
        metadata: {
          reservationId: String(res._id),
          bookId: String(res.bookId),
          module: "library",
        },
      });
      enqueued += 1;
      notifiedUserIds.add(String(userId));
      anyRecipient = true;
      await queueLibraryTransactionalEmail({
        schoolId: args.schoolId,
        userId,
        subject: notifTitle,
        innerHtml: `<p>Hello,</p><p>${patronBody}</p><p><a href="${abs}" style="color:#4f46e5;">View title</a></p>`,
        templateKey: "LIBRARY_HOLD_READY",
        recipientRole: res.borrowerType,
      });
    }

    if (res.borrowerType === "student") {
      const guardians = await Guardian.find({ studentId: res.borrowerId }).select("userId").lean();
      const stu = await Student.findOne({ _id: res.borrowerId, schoolId: args.schoolId })
        .select("firstName lastName")
        .lean();
      const childName =
        `${(stu as { firstName?: string } | null)?.firstName ?? ""} ${(stu as { lastName?: string } | null)?.lastName ?? ""}`.trim() ||
        "your child";
      const parentUrl = `/parent/library/${String(res.bookId)}`;
      const parentAbs = absoluteAppUrl(parentUrl);
      const parentBody =
        args.body ??
        `“${title}” is ready for pickup for ${childName}. Open the parent library to view details.`;

      for (const g of guardians) {
        const uid = g.userId as mongoose.Types.ObjectId;
        if (notifiedUserIds.has(String(uid))) continue;
        await Notification.create({
          schoolId: args.schoolId,
          userId: uid,
          type: "reminder",
          title: notifTitle,
          body: parentBody,
          priority: "normal",
          entityType: "LibraryReservation",
          entityId: res._id,
          actionUrl: parentUrl,
          metadata: {
            reservationId: String(res._id),
            bookId: String(res.bookId),
            module: "library",
            audience: "parent",
          },
        });
        enqueued += 1;
        anyRecipient = true;
        await queueLibraryTransactionalEmail({
          schoolId: args.schoolId,
          userId: uid,
          subject: notifTitle,
          innerHtml: `<p>Hello,</p><p>${parentBody}</p><p><a href="${parentAbs}" style="color:#4f46e5;">Open parent library</a></p>`,
          templateKey: "LIBRARY_HOLD_READY",
          recipientRole: "parent",
        });
      }
    }

    if (!anyRecipient) skippedReservations += 1;
  }

  if (process.env.NODE_ENV === "development") {
    console.debug("[library-notifications] reservation-ready", {
      reservationIds: args.reservationIds.length,
      enqueued,
      skippedReservations,
    });
  }

  return { enqueued, skippedReservations };
}

export async function notifyLibraryReservationsBecameReady(
  schoolId: mongoose.Types.ObjectId,
  reservationIds: (mongoose.Types.ObjectId | null | undefined)[]
): Promise<void> {
  const uniq = [...new Set(reservationIds.filter(Boolean).map((x) => String(x)))].map(
    (s) => new mongoose.Types.ObjectId(s)
  );
  if (uniq.length === 0) return;
  await enqueueLibraryReservationReadyNotifications({ schoolId, reservationIds: uniq });
}
