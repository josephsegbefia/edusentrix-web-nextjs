import { Schema, model, models, Types, type Model } from "mongoose";

export interface IRuleBasedInsights {
  riskLevel: "low" | "medium" | "high";
  trend: "up" | "down" | "stable";
  trendDelta: number | null;
  attendanceRate: number | null;
  attendanceFlag: boolean;
  feesStatus: "clear" | "partial" | "owing" | null;
  overdueInvoices: number;
  strengths: Array<{
    subject: string;
    score: number;
    classAvg: number | null;
  }>;
  weaknesses: Array<{
    subject: string;
    score: number;
    classAvg: number | null;
  }>;
  caVsExamGap: number | null;
  classPosition: number | null;
  classSize: number | null;
  positionMovement: number | null;
  attendanceBreakdown: {
    present: number;
    absent: number;
    late: number;
    excused: number;
    total: number;
  } | null;
  mostMissedDay: string | null;
  avgLateMinutes: number | null;
  paymentConsistency: number | null;
  teacherCommentCount: number;
}

export interface IAIGeneratedInsights {
  summary: string;
  riskLevel: "low" | "medium" | "high";
  academic: {
    narrative: string;
    strengths: Array<{ subject: string; reason: string; score: number }>;
    weaknesses: Array<{
      subject: string;
      reason: string;
      score: number;
      trend: string;
    }>;
    prioritySubjects: string[];
  };
  attendance: {
    narrative: string;
    patterns: string[];
    correlationWithGrades: string;
  };
  financial: {
    narrative: string;
    riskAssessment: string;
  };
  behaviour: {
    narrative: string;
    observations: string[];
  };
  recommendations: {
    student: string[];
    parent: string[];
    teacher: string[];
  };
  additionalInsights: {
    overallTrend: string;
    examVsCA: string;
    classComparison: string;
    learningStyle: string | null;
  };
}

export interface IAIInsightCache {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
  ruleBased: IRuleBasedInsights;
  aiGenerated: IAIGeneratedInsights | null;
  generatedBy: Types.ObjectId;
  generatedAt: Date;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null;
  modelUsed: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const ruleBasedSchema = new Schema(
  {
    riskLevel: {
      type: String,
      enum: ["low", "medium", "high"],
      required: true,
    },
    trend: { type: String, enum: ["up", "down", "stable"], required: true },
    trendDelta: { type: Number, default: null },
    attendanceRate: { type: Number, default: null },
    attendanceFlag: { type: Boolean, default: false },
    feesStatus: {
      type: String,
      enum: ["clear", "partial", "owing", null],
      default: null,
    },
    overdueInvoices: { type: Number, default: 0 },
    strengths: [
      {
        subject: String,
        score: Number,
        classAvg: { type: Number, default: null },
      },
    ],
    weaknesses: [
      {
        subject: String,
        score: Number,
        classAvg: { type: Number, default: null },
      },
    ],
    caVsExamGap: { type: Number, default: null },
    classPosition: { type: Number, default: null },
    classSize: { type: Number, default: null },
    positionMovement: { type: Number, default: null },
    attendanceBreakdown: {
      type: {
        present: Number,
        absent: Number,
        late: Number,
        excused: Number,
        total: Number,
      },
      default: null,
    },
    mostMissedDay: { type: String, default: null },
    avgLateMinutes: { type: Number, default: null },
    paymentConsistency: { type: Number, default: null },
    teacherCommentCount: { type: Number, default: 0 },
  },
  { _id: false }
);

const aiGeneratedSchema = new Schema(
  {
    summary: { type: String, required: true },
    riskLevel: {
      type: String,
      enum: ["low", "medium", "high"],
      required: true,
    },
    academic: {
      narrative: String,
      strengths: [{ subject: String, reason: String, score: Number }],
      weaknesses: [
        { subject: String, reason: String, score: Number, trend: String },
      ],
      prioritySubjects: [String],
    },
    attendance: {
      narrative: String,
      patterns: [String],
      correlationWithGrades: String,
    },
    financial: {
      narrative: String,
      riskAssessment: String,
    },
    behaviour: {
      narrative: String,
      observations: [String],
    },
    recommendations: {
      student: [String],
      parent: [String],
      teacher: [String],
    },
    additionalInsights: {
      overallTrend: String,
      examVsCA: String,
      classComparison: String,
      learningStyle: { type: String, default: null },
    },
  },
  { _id: false }
);

const aiInsightCacheSchema = new Schema<IAIInsightCache>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    academicPeriodId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicPeriod",
      required: true,
      index: true,
    },
    ruleBased: { type: ruleBasedSchema, required: true },
    aiGenerated: { type: aiGeneratedSchema, default: null },
    generatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    generatedAt: { type: Date, default: Date.now },
    tokenUsage: {
      type: {
        promptTokens: Number,
        completionTokens: Number,
        totalTokens: Number,
      },
      default: null,
    },
    modelUsed: { type: String, default: null },
  },
  { timestamps: true }
);

aiInsightCacheSchema.index(
  { studentId: 1, academicPeriodId: 1 },
  { unique: true, name: "unique_student_period_insight" }
);
aiInsightCacheSchema.index(
  { schoolId: 1, academicPeriodId: 1 },
  { name: "by_school_period" }
);

export const AIInsightCache: Model<IAIInsightCache> =
  (models.AIInsightCache as Model<IAIInsightCache>) ||
  model<IAIInsightCache>("AIInsightCache", aiInsightCacheSchema);
