import { Types } from "mongoose";
import { ExamPaper } from "@/models/ExamPaper";
import { ExamPaperSection } from "@/models/ExamPaperSection";
import { ExamQuestion } from "@/models/ExamQuestion";
import {
  serializeExamPaper,
  serializeExamPaperSection,
  serializeExamQuestion,
} from "@/lib/examinations/serializers";

export function parseExamPaperId(value: string) {
  if (!Types.ObjectId.isValid(value)) return null;
  return new Types.ObjectId(value);
}

export async function getSerializedExamPaperDetail(input: {
  schoolId: Types.ObjectId;
  examPaperId: Types.ObjectId;
}) {
  const [paper, sections, questions] = await Promise.all([
    ExamPaper.findOne({
      _id: input.examPaperId,
      schoolId: input.schoolId,
    }).lean(),
    ExamPaperSection.find({
      examPaperId: input.examPaperId,
      schoolId: input.schoolId,
    })
      .sort({ order: 1, createdAt: 1 })
      .lean(),
    ExamQuestion.find({
      examPaperId: input.examPaperId,
      schoolId: input.schoolId,
    })
      .sort({ sectionId: 1, order: 1, createdAt: 1 })
      .lean(),
  ]);

  if (!paper) return null;

  return {
    paper: serializeExamPaper(paper),
    sections: sections.map(serializeExamPaperSection),
    questions: questions.map(serializeExamQuestion),
  };
}
