import "server-only";
import mongoose from "mongoose";
import { SchemeOfWork, type ISchemeOfWork, type SchemeOfWorkStatus } from "@/models/SchemeOfWork";
import { SchemeItem, type ISchemeItem } from "@/models/SchemeItem";
import { SchemeReview, type ISchemeReview } from "@/models/SchemeReview";
import { LessonNote } from "@/models/LessonNote";
import { getSchemeDeleteBlockReason } from "@/lib/schemes/scheme-delete";
import { SCHEME_LINKED_LESSON_NOTES_CODE } from "@/lib/schemes/scheme-delete-errors";
import { recordActivity } from "@/lib/audit/recordActivity";
import { Subject } from "@/models/Subject";
import { Grade } from "@/models/Grade";
import { ClassGroup } from "@/models/ClassGroup";
import { Curriculum } from "@/models/Curriculum";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { Teacher } from "@/models/Teacher";
import { User } from "@/models/User";
import { serializeSchemeRow } from "@/lib/schemes/serializers";
import { recordSchemeReviewAudit } from "@/lib/schemes/scheme-review-audit";
import { NextResponse } from "next/server";

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeDbStatus(s: string): SchemeOfWorkStatus {
  if (s === "in_review") return "submitted";
  return s as SchemeOfWorkStatus;
}

function activationConflictFilter(scheme: ISchemeOfWork): Record<string, unknown> {
  const base: Record<string, unknown> = {};
  if (scheme.academicYearId && scheme.termId) {
    base.academicYearId = scheme.academicYearId;
    base.termId = scheme.termId;
  } else if (scheme.academicPeriodId) {
    base.academicPeriodId = scheme.academicPeriodId;
  }
  base.gradeId = scheme.gradeId ?? null;
  base.subjectId = scheme.subjectId ?? null;
  if (scheme.classGroupId) {
    base.classGroupId = scheme.classGroupId;
  } else {
    base.$or = [{ classGroupId: null }, { classGroupId: { $exists: false } }];
  }
  return base;
}

async function loadUserNames(
  userIds: mongoose.Types.ObjectId[]
): Promise<Map<string, { name: string; email?: string | null }>> {
  const uniq = [...new Set(userIds.map(String))];
  if (!uniq.length) return new Map();
  const users = await User.find({
    _id: { $in: uniq.map((id) => new mongoose.Types.ObjectId(id)) },
  })
    .select("firstName lastName name email")
    .lean();
  const map = new Map<string, { name: string; email?: string | null }>();
  for (const u of users as unknown as Array<{
    _id: mongoose.Types.ObjectId;
    firstName?: string;
    lastName?: string;
    name?: string;
    email?: string;
  }>) {
    const name =
      [u.firstName, u.lastName].filter(Boolean).join(" ").trim() ||
      u.name?.trim() ||
      "Staff user";
    map.set(String(u._id), { name, email: u.email ?? null });
  }
  return map;
}

export async function listAdminSchemes(input: {
  schoolId: mongoose.Types.ObjectId;
  searchParams: URLSearchParams;
}) {
  const { schoolId, searchParams } = input;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20));
  const skip = (page - 1) * limit;

  const rawStatus = searchParams.get("status");
  const academicYearId = searchParams.get("academicYearId");
  const termId = searchParams.get("termId");
  const gradeId = searchParams.get("gradeId");
  const classGroupId = searchParams.get("classGroupId");
  const subjectId = searchParams.get("subjectId");
  const teacherId = searchParams.get("teacherId");
  const curriculumId = searchParams.get("curriculumId");
  const search = searchParams.get("search")?.trim();

  const query: Record<string, unknown> = { schoolId };

  if (rawStatus === null || rawStatus === "") {
    query.status = { $in: ["submitted", "in_review"] };
  } else if (rawStatus === "all") {
    // no status constraint
  } else if (rawStatus === "submitted") {
    query.status = { $in: ["submitted", "in_review"] };
  } else if (
    [
      "draft",
      "needs_revision",
      "approved",
      "active",
      "archived",
      "rejected",
    ].includes(rawStatus)
  ) {
    query.status = rawStatus;
  }

  if (academicYearId && mongoose.Types.ObjectId.isValid(academicYearId)) {
    query.academicYearId = new mongoose.Types.ObjectId(academicYearId);
  }
  if (termId && mongoose.Types.ObjectId.isValid(termId)) {
    query.termId = new mongoose.Types.ObjectId(termId);
  }
  if (gradeId && mongoose.Types.ObjectId.isValid(gradeId)) {
    query.gradeId = new mongoose.Types.ObjectId(gradeId);
  }
  if (classGroupId && mongoose.Types.ObjectId.isValid(classGroupId)) {
    query.classGroupId = new mongoose.Types.ObjectId(classGroupId);
  }
  if (subjectId && mongoose.Types.ObjectId.isValid(subjectId)) {
    query.subjectId = new mongoose.Types.ObjectId(subjectId);
  }
  if (teacherId && mongoose.Types.ObjectId.isValid(teacherId)) {
    query.ownerTeacherId = new mongoose.Types.ObjectId(teacherId);
  }
  if (curriculumId && mongoose.Types.ObjectId.isValid(curriculumId)) {
    query.curriculumId = new mongoose.Types.ObjectId(curriculumId);
  }
  const periodId = searchParams.get("periodId");
  if (periodId && mongoose.Types.ObjectId.isValid(periodId)) {
    const oid = new mongoose.Types.ObjectId(periodId);
    query.$or = [{ academicPeriodId: oid }, { academicYearId: oid }, { termId: oid }];
  }
  if (search) {
    query.title = new RegExp(escapeRegex(search), "i");
  }

  const [total, docs] = await Promise.all([
    SchemeOfWork.countDocuments(query),
    SchemeOfWork.find(query).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean() as Promise<
      ISchemeOfWork[]
    >,
  ]);

  const schemeIds = docs.map((d) => d._id);
  const itemAgg =
    schemeIds.length === 0
      ? []
      : await SchemeItem.aggregate<{ _id: mongoose.Types.ObjectId; c: number }>([
          {
            $match: {
              schoolId,
              schemeId: { $in: schemeIds },
            },
          },
          { $group: { _id: "$schemeId", c: { $sum: 1 } } },
        ]);
  const itemCount = new Map(itemAgg.map((r) => [String(r._id), r.c]));

  const subjectIds = [...new Set(docs.map((d) => d.subjectId).filter(Boolean).map(String))];
  const gradeIds = [...new Set(docs.map((d) => d.gradeId).filter(Boolean).map(String))];
  const classIds = [...new Set(docs.map((d) => d.classGroupId).filter(Boolean).map(String))];
  const teacherIds = [...new Set(docs.map((d) => d.ownerTeacherId).filter(Boolean).map(String))];
  const periodIds = new Set<string>();
  for (const d of docs) {
    if (d.academicYearId) periodIds.add(String(d.academicYearId));
    if (d.termId) periodIds.add(String(d.termId));
    if (d.academicPeriodId) periodIds.add(String(d.academicPeriodId));
  }

  const [subjects, grades, classes, teachers, periods] = await Promise.all([
    subjectIds.length
      ? Subject.find({
          schoolId,
          _id: { $in: subjectIds.map((id) => new mongoose.Types.ObjectId(id)) },
        })
          .select("name")
          .lean()
      : [],
    gradeIds.length
      ? Grade.find({
          schoolId,
          _id: { $in: gradeIds.map((id) => new mongoose.Types.ObjectId(id)) },
        })
          .select("name")
          .lean()
      : [],
    classIds.length
      ? ClassGroup.find({
          schoolId,
          _id: { $in: classIds.map((id) => new mongoose.Types.ObjectId(id)) },
        })
          .select("name")
          .lean()
      : [],
    teacherIds.length
      ? Teacher.find({
          schoolId,
          _id: { $in: teacherIds.map((id) => new mongoose.Types.ObjectId(id)) },
        })
          .select("userId")
          .lean()
      : [],
    periodIds.size
      ? AcademicPeriod.find({
          schoolId,
          _id: { $in: [...periodIds].map((id) => new mongoose.Types.ObjectId(id)) },
        })
          .select("yearLabel term")
          .lean()
      : [],
  ]);

  const subjectName = new Map(subjects.map((s) => [String(s._id), s.name]));
  const gradeName = new Map(grades.map((g) => [String(g._id), g.name]));
  const className = new Map(classes.map((c) => [String(c._id), c.name]));
  const periodLabel = new Map(
    periods.map((p) => [String(p._id), `${p.yearLabel} · ${p.term}`])
  );

  const teacherUserIds = teachers
    .map((t) => t.userId)
    .filter(Boolean) as mongoose.Types.ObjectId[];
  const teacherBySchemeTeacher = new Map(teachers.map((t) => [String(t._id), t]));
  const userNames = await loadUserNames(teacherUserIds);

  const rows = docs.map((row) => {
    const tid = row.ownerTeacherId ? String(row.ownerTeacherId) : null;
    const tDoc = tid ? teacherBySchemeTeacher.get(tid) : undefined;
    const uid = tDoc?.userId ? String(tDoc.userId) : null;
    const owner =
      uid && userNames.has(uid)
        ? {
            id: tid!,
            name: userNames.get(uid)!.name,
            email: userNames.get(uid)!.email ?? undefined,
          }
        : tid
          ? { id: tid, name: "Teacher", email: undefined as string | undefined }
          : null;

    const ay = row.academicYearId ? periodLabel.get(String(row.academicYearId)) : undefined;
    const tm = row.termId ? periodLabel.get(String(row.termId)) : undefined;
    const fallbackPeriod = row.academicPeriodId
      ? periodLabel.get(String(row.academicPeriodId))
      : undefined;

    return {
      id: String(row._id),
      title: row.title,
      status: normalizeDbStatus(String(row.status)),
      subject: row.subjectId
        ? { id: String(row.subjectId), name: subjectName.get(String(row.subjectId)) ?? "Subject" }
        : undefined,
      grade: row.gradeId
        ? { id: String(row.gradeId), name: gradeName.get(String(row.gradeId)) ?? "Grade" }
        : undefined,
      classGroup: row.classGroupId
        ? {
            id: String(row.classGroupId),
            name: className.get(String(row.classGroupId)) ?? "Class",
          }
        : null,
      academicYear: row.academicYearId
        ? {
            id: String(row.academicYearId),
            name: ay ?? "Academic year",
          }
        : undefined,
      term: row.termId
        ? {
            id: String(row.termId),
            name: tm ?? "Term",
          }
        : undefined,
      academicPeriodLabel: fallbackPeriod ?? null,
      ownerTeacher: owner,
      itemCount: itemCount.get(String(row._id)) ?? 0,
      submittedAt: row.submittedAt ? new Date(row.submittedAt).toISOString() : undefined,
      updatedAt: new Date(row.updatedAt).toISOString(),
      sourceType: row.sourceType ?? "manual",
      description: row.description ?? null,
    };
  });

  return {
    rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function getAdminSchemeDetail(input: {
  schoolId: mongoose.Types.ObjectId;
  schemeId: string;
}) {
  if (!mongoose.Types.ObjectId.isValid(input.schemeId)) {
    return { error: NextResponse.json({ success: false, error: "Invalid scheme id" }, { status: 400 }) };
  }
  const sid = new mongoose.Types.ObjectId(input.schemeId);
  const scheme = (await SchemeOfWork.findOne({
    _id: sid,
    schoolId: input.schoolId,
  }).lean()) as ISchemeOfWork | null;
  if (!scheme) {
    return { error: NextResponse.json({ success: false, error: "Scheme not found" }, { status: 404 }) };
  }

  const items = (await SchemeItem.find({ schemeId: sid, schoolId: input.schoolId })
    .sort({ sequence: 1, weekNumber: 1 })
    .lean()) as ISchemeItem[];

  const reviews = (await SchemeReview.find({ schemeId: sid, schoolId: input.schoolId })
    .sort({ createdAt: 1 })
    .lean()) as ISchemeReview[];

  const actorIds = [...new Set(reviews.map((r) => String(r.actorUserId)))];
  const userNames = await loadUserNames(actorIds.map((id) => new mongoose.Types.ObjectId(id)));

  const [subject, grade, klass, curriculum, ayPeriod, termPeriod] = await Promise.all([
    scheme.subjectId
      ? Subject.findOne({ _id: scheme.subjectId, schoolId: input.schoolId }).select("name").lean()
      : null,
    scheme.gradeId
      ? Grade.findOne({ _id: scheme.gradeId, schoolId: input.schoolId }).select("name").lean()
      : null,
    scheme.classGroupId
      ? ClassGroup.findOne({ _id: scheme.classGroupId, schoolId: input.schoolId }).select("name").lean()
      : null,
    scheme.curriculumId
      ? Curriculum.findOne({ _id: scheme.curriculumId, schoolId: input.schoolId }).select("title").lean()
      : null,
    scheme.academicYearId
      ? AcademicPeriod.findOne({ _id: scheme.academicYearId, schoolId: input.schoolId })
          .select("yearLabel term")
          .lean()
      : null,
    scheme.termId
      ? AcademicPeriod.findOne({ _id: scheme.termId, schoolId: input.schoolId })
          .select("yearLabel term")
          .lean()
      : null,
  ]);

  let ownerTeacher: { id: string; name: string; email?: string } | null = null;
  if (scheme.ownerTeacherId) {
    const t = await Teacher.findOne({
      _id: scheme.ownerTeacherId,
      schoolId: input.schoolId,
    })
      .select("userId")
      .lean();
    if (t?.userId) {
      const nm = await loadUserNames([t.userId]);
      ownerTeacher = {
        id: String(scheme.ownerTeacherId),
        name: nm.get(String(t.userId))?.name ?? "Teacher",
        email: nm.get(String(t.userId))?.email ?? undefined,
      };
    }
  }

  const serializedItems = items.map((row) => {
    const objectives =
      row.learningObjectives && row.learningObjectives.length > 0
        ? row.learningObjectives
        : row.learningObjective
          ? [row.learningObjective]
          : [];
    const topicDisplay = (row.topic || row.title || "").trim() || "—";
    return {
      id: String(row._id),
      weekNumber: row.weekNumber ?? 0,
      lessonOrder: row.lessonOrder ?? undefined,
      topic: topicDisplay,
      subtopic: row.subtopic ?? undefined,
      strand: row.strand ?? undefined,
      subStrand: row.subStrand ?? undefined,
      contentStandard: row.contentStandard ?? undefined,
      indicator: row.indicator ?? undefined,
      learningObjectives: objectives,
      coreCompetencies: row.coreCompetencies ?? [],
      teachingResources: row.teachingResources ?? [],
      teachingLearningActivities: row.teachingLearningActivities ?? undefined,
      assessmentIdeas: row.assessmentIdeas ?? [],
      plannedStartDate: row.plannedStartDate
        ? new Date(row.plannedStartDate).toISOString()
        : undefined,
      plannedEndDate: row.plannedEndDate
        ? new Date(row.plannedEndDate).toISOString()
        : undefined,
      coverageStatus: row.coverageStatus ?? "not_started",
      status: row.status,
    };
  });

  const serializedReviews = reviews.map((r) => ({
    id: String(r._id),
    decision: r.decision,
    note: r.note ?? undefined,
    actor: {
      id: String(r.actorUserId),
      name: userNames.get(String(r.actorUserId))?.name ?? "Reviewer",
      role: r.actorRole ?? undefined,
    },
    createdAt: new Date(r.createdAt).toISOString(),
  }));

  const periodFallback =
    scheme.academicPeriodId &&
    (await AcademicPeriod.findOne({ _id: scheme.academicPeriodId, schoolId: input.schoolId })
      .select("yearLabel term")
      .lean());

  return {
    data: {
      scheme: {
        id: String(scheme._id),
        title: scheme.title,
        description: scheme.description ?? undefined,
        status: normalizeDbStatus(String(scheme.status)),
        sourceType: scheme.sourceType,
        createdAt: new Date(scheme.createdAt).toISOString(),
        updatedAt: new Date(scheme.updatedAt).toISOString(),
        submittedAt: scheme.submittedAt ? new Date(scheme.submittedAt).toISOString() : undefined,
        approvedAt: scheme.approvedAt ? new Date(scheme.approvedAt).toISOString() : undefined,
        activatedAt: scheme.activatedAt ? new Date(scheme.activatedAt).toISOString() : undefined,
        version: scheme.version ?? 1,
      },
      academicContext: {
        curriculum: curriculum
          ? { id: String(scheme.curriculumId), name: curriculum.title }
          : null,
        academicYear: ayPeriod
          ? {
              id: String(scheme.academicYearId),
              name: `${ayPeriod.yearLabel} · ${ayPeriod.term}`,
            }
          : periodFallback
            ? {
                id: String(scheme.academicPeriodId),
                name: `${periodFallback.yearLabel} · ${periodFallback.term}`,
              }
            : null,
        term: termPeriod
          ? {
              id: String(scheme.termId),
              name: `${termPeriod.yearLabel} · ${termPeriod.term}`,
            }
          : null,
        grade: grade ? { id: String(scheme.gradeId), name: grade.name } : null,
        classGroup: klass ? { id: String(scheme.classGroupId), name: klass.name } : null,
        subject: subject ? { id: String(scheme.subjectId), name: subject.name } : null,
      },
      ownerTeacher,
      items: serializedItems,
      reviews: serializedReviews,
      summaryRow: serializeSchemeRow(scheme),
    },
  };
}

export async function reviewSchemeDecision(input: {
  schoolId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  schemeId: string;
  decision: "approved" | "needs_revision" | "rejected";
  note?: string | null;
  actorRole?: string | null;
}) {
  if (!mongoose.Types.ObjectId.isValid(input.schemeId)) {
    return { error: NextResponse.json({ success: false, error: "Invalid scheme id" }, { status: 400 }) };
  }
  const sid = new mongoose.Types.ObjectId(input.schemeId);
  const scheme = await SchemeOfWork.findOne({ _id: sid, schoolId: input.schoolId });
  if (!scheme) {
    return { error: NextResponse.json({ success: false, error: "Scheme not found" }, { status: 404 }) };
  }

  const prev = normalizeDbStatus(String(scheme.status));
  if (prev !== "submitted") {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: "Only submitted schemes can be reviewed",
        },
        { status: 409 }
      ),
    };
  }

  const note = input.note?.trim() || null;
  if (input.decision === "needs_revision" || input.decision === "rejected") {
    if (!note || note.length < 1) {
      return {
        error: NextResponse.json(
          { success: false, error: "A comment is required for this decision" },
          { status: 400 }
        ),
      };
    }
  }

  const now = new Date();
  if (input.decision === "approved") {
    scheme.status = "approved";
    scheme.approvedAt = now;
    scheme.approvedByUserId = input.userId;
    scheme.rejectedAt = undefined;
    scheme.rejectedByUserId = undefined;
  } else if (input.decision === "needs_revision") {
    scheme.status = "needs_revision";
  } else {
    scheme.status = "rejected";
    scheme.rejectedAt = now;
    scheme.rejectedByUserId = input.userId;
  }
  scheme.updatedByUserId = input.userId;
  await scheme.save();

  await SchemeReview.create({
    schoolId: input.schoolId,
    schemeId: sid,
    actorUserId: input.userId,
    decision: input.decision,
    note,
    actorRole: input.actorRole ?? null,
  });

  const auditAction =
    input.decision === "approved"
      ? "approved"
      : input.decision === "needs_revision"
        ? "needs_revision"
        : "rejected";
  await recordSchemeReviewAudit({
    schoolId: input.schoolId,
    userId: input.userId,
    schemeId: sid,
    action: auditAction,
    previousStatus: prev,
    nextStatus: scheme.status,
    note,
    metadata: {
      academicYearId: scheme.academicYearId ? String(scheme.academicYearId) : undefined,
      termId: scheme.termId ? String(scheme.termId) : undefined,
      gradeId: scheme.gradeId ? String(scheme.gradeId) : undefined,
      classGroupId: scheme.classGroupId ? String(scheme.classGroupId) : undefined,
      subjectId: scheme.subjectId ? String(scheme.subjectId) : undefined,
    },
  });

  return { ok: true };
}

export async function approveSchemeDirect(input: {
  schoolId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  schemeId: string;
  note?: string | null;
}) {
  return reviewSchemeDecision({
    schoolId: input.schoolId,
    userId: input.userId,
    schemeId: input.schemeId,
    decision: "approved",
    note: input.note,
    actorRole: "school_admin",
  });
}

export async function activateSchemeForSchool(input: {
  schoolId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  schemeId: string;
}) {
  const { schemeId } = input;
  if (!mongoose.Types.ObjectId.isValid(schemeId)) {
    return { error: NextResponse.json({ success: false, error: "Invalid scheme id" }, { status: 400 }) };
  }
  const sid = new mongoose.Types.ObjectId(schemeId);
  const scheme = await SchemeOfWork.findOne({ _id: sid, schoolId: input.schoolId });
  if (!scheme) {
    return { error: NextResponse.json({ success: false, error: "Scheme not found" }, { status: 404 }) };
  }

  if (scheme.status === "active") {
    return { ok: true, noop: true };
  }

  if (scheme.status !== "approved") {
    return {
      error: NextResponse.json(
        { success: false, error: "Only approved schemes can be activated" },
        { status: 409 }
      ),
    };
  }

  const conflictQuery: Record<string, unknown> = {
    _id: { $ne: scheme._id },
    schoolId: input.schoolId,
    status: "active",
    ...activationConflictFilter(scheme as ISchemeOfWork),
  };

  const existing = await SchemeOfWork.findOne(conflictQuery).select("_id title").lean();
  if (existing) {
    return {
      error: Response.json(
        {
          success: false,
          code: "ACTIVE_SCHEME_CONFLICT",
          message:
            "Another active scheme already exists for this academic year, term, grade, class group, and subject.",
          conflict: { id: String(existing._id), title: (existing as { title: string }).title },
        },
        { status: 409 }
      ),
    };
  }

  const prev = scheme.status;
  scheme.status = "active";
  scheme.activatedAt = new Date();
  scheme.activatedByUserId = input.userId;
  scheme.updatedByUserId = input.userId;
  await scheme.save();

  await SchemeReview.create({
    schoolId: input.schoolId,
    schemeId: sid,
    actorUserId: input.userId,
    decision: "activated",
    note: null,
    actorRole: null,
  });

  await recordSchemeReviewAudit({
    schoolId: input.schoolId,
    userId: input.userId,
    schemeId: sid,
    action: "activated",
    previousStatus: prev,
    nextStatus: "active",
    metadata: {
      academicYearId: scheme.academicYearId ? String(scheme.academicYearId) : undefined,
      termId: scheme.termId ? String(scheme.termId) : undefined,
      gradeId: scheme.gradeId ? String(scheme.gradeId) : undefined,
      classGroupId: scheme.classGroupId ? String(scheme.classGroupId) : undefined,
      subjectId: scheme.subjectId ? String(scheme.subjectId) : undefined,
    },
  });

  return { ok: true };
}

export async function archiveSchemeForSchool(input: {
  schoolId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  schemeId: string;
  note?: string | null;
}) {
  if (!mongoose.Types.ObjectId.isValid(input.schemeId)) {
    return { error: NextResponse.json({ success: false, error: "Invalid scheme id" }, { status: 400 }) };
  }
  const sid = new mongoose.Types.ObjectId(input.schemeId);
  const scheme = await SchemeOfWork.findOne({ _id: sid, schoolId: input.schoolId });
  if (!scheme) {
    return { error: NextResponse.json({ success: false, error: "Scheme not found" }, { status: 404 }) };
  }

  const prev = normalizeDbStatus(String(scheme.status));
  scheme.status = "archived";
  scheme.archivedAt = new Date();
  scheme.updatedByUserId = input.userId;
  await scheme.save();

  const note = input.note?.trim() || null;
  await SchemeReview.create({
    schoolId: input.schoolId,
    schemeId: sid,
    actorUserId: input.userId,
    decision: "archived",
    note,
    actorRole: null,
  });

  await recordSchemeReviewAudit({
    schoolId: input.schoolId,
    userId: input.userId,
    schemeId: sid,
    action: "archived",
    previousStatus: prev,
    nextStatus: "archived",
    note,
  });

  return { ok: true };
}

export async function deleteSchemeForSchool(input: {
  schoolId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  schemeId: string;
  unlinkLessonNotes?: boolean;
}) {
  if (!mongoose.Types.ObjectId.isValid(input.schemeId)) {
    return { error: NextResponse.json({ success: false, error: "Invalid scheme id" }, { status: 400 }) };
  }
  const sid = new mongoose.Types.ObjectId(input.schemeId);
  const scheme = await SchemeOfWork.findOne({ _id: sid, schoolId: input.schoolId });
  if (!scheme) {
    return { error: NextResponse.json({ success: false, error: "Scheme not found" }, { status: 404 }) };
  }

  const status = normalizeDbStatus(String(scheme.status));
  const blockReason = getSchemeDeleteBlockReason(status);
  if (blockReason) {
    return { error: NextResponse.json({ success: false, error: blockReason }, { status: 409 }) };
  }

  const linkedLessonNotes = await LessonNote.countDocuments({
    schoolId: input.schoolId,
    schemeId: sid,
  });
  if (linkedLessonNotes > 0 && !input.unlinkLessonNotes) {
    return {
      error: NextResponse.json(
        {
          success: false,
          code: SCHEME_LINKED_LESSON_NOTES_CODE,
          linkedLessonNoteCount: linkedLessonNotes,
          error: `This scheme is linked to ${linkedLessonNotes} lesson note${linkedLessonNotes === 1 ? "" : "s"}.`,
        },
        { status: 409 },
      ),
    };
  }

  const title = scheme.title;
  const previousStatus = status;

  if (linkedLessonNotes > 0 && input.unlinkLessonNotes) {
    await LessonNote.updateMany(
      { schoolId: input.schoolId, schemeId: sid },
      { $set: { schemeId: null, schemeItemIds: [] } },
    );
  }

  await SchemeItem.deleteMany({ schoolId: input.schoolId, schemeId: sid });
  await SchemeReview.deleteMany({ schoolId: input.schoolId, schemeId: sid });
  await SchemeOfWork.deleteOne({ _id: sid, schoolId: input.schoolId });

  try {
    await recordActivity({
      schoolId: input.schoolId,
      userId: input.userId,
      type: "scheme.deleted",
      entityType: "SchemeOfWork",
      entityId: sid,
      description: `Scheme of Learning deleted (${previousStatus})`,
      metadata: {
        schemeId: String(sid),
        title,
        previousStatus,
        unlinkedLessonNotes: linkedLessonNotes > 0 ? linkedLessonNotes : undefined,
      },
    });
  } catch (e) {
    console.error("[scheme-delete-audit]", e);
  }

  return { ok: true };
}
