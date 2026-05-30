import mongoose, { Types } from "mongoose";
import { z } from "zod";
import { EXAM_VENUE_TYPES } from "@/constants/academics/exam-scheduling-engine";
import { ExamTimetableEntry } from "@/models/ExamTimetableEntry";
import { ExamVenue, type IExamVenue } from "@/models/ExamVenue";
import type { ExamVenueDTO } from "@/types/academics/exam-scheduling-engine";

const objectIdSchema = z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), {
  message: "Invalid ObjectId",
});

const createExamVenueBodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().max(40).nullable().optional(),
  type: z.enum(EXAM_VENUE_TYPES).optional(),
  capacity: z.number().int().min(1).nullable().optional(),
  locationNote: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
});

const updateExamVenueBodySchema = createExamVenueBodySchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });

export class ExamVenueServiceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ExamVenueServiceError";
    this.status = status;
  }
}

export function serializeExamVenue(doc: IExamVenue): ExamVenueDTO {
  return {
    id: String(doc._id),
    schoolId: String(doc.schoolId),
    name: doc.name,
    code: doc.code ?? null,
    type: doc.type,
    capacity: doc.capacity ?? null,
    locationNote: doc.locationNote ?? null,
    isActive: doc.isActive,
    createdBy: String(doc.createdBy),
    updatedBy: doc.updatedBy ? String(doc.updatedBy) : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function parseCreateExamVenueBody(body: unknown) {
  const parsed = createExamVenueBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid request body.",
    };
  }
  return { ok: true as const, data: parsed.data };
}

export function parseUpdateExamVenueBody(body: unknown) {
  const parsed = updateExamVenueBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid request body.",
    };
  }
  return { ok: true as const, data: parsed.data };
}

export async function createExamVenue(input: {
  schoolId: Types.ObjectId;
  actorId: Types.ObjectId;
  body: z.infer<typeof createExamVenueBodySchema>;
}) {
  const created = await ExamVenue.create({
    schoolId: input.schoolId,
    name: input.body.name,
    code: input.body.code ?? null,
    type: input.body.type ?? "classroom",
    capacity: input.body.capacity ?? null,
    locationNote: input.body.locationNote ?? null,
    isActive: input.body.isActive ?? true,
    createdBy: input.actorId,
    updatedBy: input.actorId,
  });

  return serializeExamVenue(created);
}

export async function listExamVenues(input: {
  schoolId: Types.ObjectId;
  activeOnly?: boolean;
}) {
  const filter: Record<string, unknown> = { schoolId: input.schoolId };
  if (input.activeOnly) {
    filter.isActive = true;
  }

  const rows = await ExamVenue.find(filter).sort({ isActive: -1, name: 1 });
  return rows.map(serializeExamVenue);
}

export async function getExamVenueById(input: {
  schoolId: Types.ObjectId;
  venueId: string;
}) {
  if (!mongoose.Types.ObjectId.isValid(input.venueId)) {
    throw new ExamVenueServiceError("Invalid venue id.", 400);
  }

  const venue = await ExamVenue.findOne({
    _id: input.venueId,
    schoolId: input.schoolId,
  });

  if (!venue) {
    throw new ExamVenueServiceError("Exam venue not found.", 404);
  }

  return serializeExamVenue(venue);
}

export async function updateExamVenue(input: {
  schoolId: Types.ObjectId;
  actorId: Types.ObjectId;
  venueId: string;
  body: z.infer<typeof updateExamVenueBodySchema>;
}) {
  if (!mongoose.Types.ObjectId.isValid(input.venueId)) {
    throw new ExamVenueServiceError("Invalid venue id.", 400);
  }

  const venue = await ExamVenue.findOne({
    _id: input.venueId,
    schoolId: input.schoolId,
  });

  if (!venue) {
    throw new ExamVenueServiceError("Exam venue not found.", 404);
  }

  if (input.body.name !== undefined) venue.name = input.body.name;
  if (input.body.code !== undefined) venue.code = input.body.code;
  if (input.body.type !== undefined) venue.type = input.body.type;
  if (input.body.capacity !== undefined) venue.capacity = input.body.capacity;
  if (input.body.locationNote !== undefined) venue.locationNote = input.body.locationNote;
  if (input.body.isActive !== undefined) venue.isActive = input.body.isActive;

  venue.updatedBy = input.actorId;
  await venue.save();

  return serializeExamVenue(venue);
}

export async function deactivateExamVenue(input: {
  schoolId: Types.ObjectId;
  actorId: Types.ObjectId;
  venueId: string;
}) {
  if (!mongoose.Types.ObjectId.isValid(input.venueId)) {
    throw new ExamVenueServiceError("Invalid venue id.", 400);
  }

  const venue = await ExamVenue.findOne({
    _id: input.venueId,
    schoolId: input.schoolId,
  });

  if (!venue) {
    throw new ExamVenueServiceError("Exam venue not found.", 404);
  }

  venue.isActive = false;
  venue.updatedBy = input.actorId;
  await venue.save();

  return serializeExamVenue(venue);
}

export async function venueHasTimetableUsage(input: {
  schoolId: Types.ObjectId;
  venueId: string;
}) {
  if (!mongoose.Types.ObjectId.isValid(input.venueId)) return false;

  const count = await ExamTimetableEntry.countDocuments({
    schoolId: input.schoolId,
    venueId: input.venueId,
  });

  return count > 0;
}
