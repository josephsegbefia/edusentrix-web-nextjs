import { Schema, model, models, type Model, type Types } from "mongoose";

export interface ICurriculumSubject {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  curriculumId: Types.ObjectId;
  subjectId: Types.ObjectId;
  gradeId?: Types.ObjectId | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const curriculumSubjectSchema = new Schema<ICurriculumSubject>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    curriculumId: {
      type: Schema.Types.ObjectId,
      ref: "Curriculum",
      required: true,
      index: true,
    },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true, index: true },
    gradeId: { type: Schema.Types.ObjectId, ref: "Grade", default: null, index: true },
    order: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true }
);

curriculumSubjectSchema.index(
  { schoolId: 1, curriculumId: 1, subjectId: 1, gradeId: 1 },
  { unique: true }
);

export const CurriculumSubject: Model<ICurriculumSubject> =
  (models.CurriculumSubject as Model<ICurriculumSubject>) ||
  model<ICurriculumSubject>("CurriculumSubject", curriculumSubjectSchema);
