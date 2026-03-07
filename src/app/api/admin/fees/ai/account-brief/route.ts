/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import OpenAI from "openai";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { Invoice } from "@/models/Invoice";
import { Payment } from "@/models/Payment";
import { Student } from "@/models/Student";
import { ClassGroup } from "@/models/ClassGroup";
import { AIFeatureCache } from "@/models/AIFeatureCache";
import {
  getSchoolAIBudgetSnapshot,
  hashFingerprint,
  isCacheFresh,
  recordAIFeatureUsage,
} from "@/lib/ai/feature-budget";
import { enforceSchoolLimit } from "@/lib/auth/checkLimit";
import { trackUsage } from "@/lib/billing/trackUsage";

const FEATURE_KEY = "fees_account_brief";
const PROMPT_VERSION = 1;
const MODEL_NAME = "gpt-4o-mini";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

type BriefRiskLevel = "low" | "medium" | "high";

type AccountBriefPayload = {
  headline: string;
  riskLevel: BriefRiskLevel;
  overview: string;
  keyPoints: string[];
  recommendedActions: string[];
};

function normalizeRiskLevel(value: unknown): BriefRiskLevel {
  const raw = String(value || "").toLowerCase();
  if (raw === "high" || raw === "medium") return raw;
  return "low";
}

function normalizeBriefPayload(input: any): AccountBriefPayload {
  const keyPoints = Array.isArray(input?.keyPoints)
    ? input.keyPoints
        .map((entry: unknown) => String(entry || "").trim())
        .filter(Boolean)
        .slice(0, 5)
    : [];
  const recommendedActions = Array.isArray(input?.recommendedActions)
    ? input.recommendedActions
        .map((entry: unknown) => String(entry || "").trim())
        .filter(Boolean)
        .slice(0, 5)
    : [];

  return {
    headline: String(input?.headline || "Account Brief").trim() || "Account Brief",
    riskLevel: normalizeRiskLevel(input?.riskLevel),
    overview:
      String(input?.overview || "No account brief is available yet.").trim() ||
      "No account brief is available yet.",
    keyPoints,
    recommendedActions,
  };
}

function toObjectIdOrNull(value: string | null | undefined) {
  if (!value) return null;
  if (!mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

function daysSince(dateValue: Date | null) {
  if (!dateValue) return null;
  const ms = Date.now() - dateValue.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function formatMinor(minor: number) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
  }).format((minor || 0) / 100);
}

async function buildAccountBriefSource(params: {
  schoolId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  periodId: mongoose.Types.ObjectId | null;
}) {
  const studentRaw = await Student.findOne({
    _id: params.studentId,
    schoolId: params.schoolId,
  })
    .select("firstName lastName admissionNo classGroupId")
    .lean();
  const student = Array.isArray(studentRaw) ? studentRaw[0] : studentRaw;
  if (!student) {
    throw new Error("Student not found");
  }

  const classGroupName = student.classGroupId
    ? (
        await ClassGroup.findById(student.classGroupId).select("name").lean()
      )?.name || null
    : null;

  const invoiceMatch: Record<string, unknown> = {
    schoolId: params.schoolId,
    studentId: params.studentId,
    status: { $nin: ["draft", "cancelled"] },
  };
  if (params.periodId) {
    invoiceMatch.academicPeriodId = params.periodId;
  }

  const invoices = await Invoice.find(invoiceMatch)
    .select(
      "_id invoiceNumber status dueDate issueDate totalAmountMinor totalPaidMinor totalOutstandingMinor"
    )
    .lean();

  const invoiceIds = invoices.map((invoice: any) => invoice._id);

  const paymentMatch: Record<string, unknown> = {
    schoolId: params.schoolId,
    studentId: params.studentId,
  };
  if (invoiceIds.length > 0) {
    paymentMatch.invoiceId = { $in: invoiceIds };
  } else {
    paymentMatch.invoiceId = { $in: [] };
  }

  const [payments, pendingApprovals, unreconciledCount] = await Promise.all([
    Payment.find(paymentMatch)
      .select("amountMinor status approvalStatus paymentDate reconciliationStatus")
      .lean(),
    Payment.countDocuments({
      ...paymentMatch,
      status: "pending",
      approvalStatus: "pending",
    }),
    Payment.countDocuments({
      ...paymentMatch,
      status: "completed",
      reconciliationStatus: { $ne: "fully_reconciled" },
    }),
  ]);

  const totalBilledMinor = invoices.reduce(
    (sum, invoice: any) => sum + Number(invoice.totalAmountMinor || 0),
    0
  );
  const totalPaidMinor = invoices.reduce(
    (sum, invoice: any) => sum + Number(invoice.totalPaidMinor || 0),
    0
  );
  const totalOutstandingMinor = invoices.reduce(
    (sum, invoice: any) => sum + Number(invoice.totalOutstandingMinor || 0),
    0
  );

  const overdueInvoices = invoices.filter((invoice: any) => invoice.status === "overdue");
  const oldestOverdueDate = overdueInvoices
    .map((invoice: any) => (invoice.dueDate ? new Date(invoice.dueDate) : null))
    .filter((value: Date | null): value is Date => Boolean(value))
    .sort((a, b) => a.getTime() - b.getTime())[0] || null;
  const oldestOverdueDays = daysSince(oldestOverdueDate);

  const completedPayments = payments
    .filter((payment: any) => payment.status === "completed")
    .sort(
      (a: any, b: any) =>
        new Date(b.paymentDate || 0).getTime() - new Date(a.paymentDate || 0).getTime()
    );
  const lastPaymentDate = completedPayments[0]?.paymentDate
    ? new Date(completedPayments[0].paymentDate)
    : null;
  const completedPaymentCount = completedPayments.length;

  const riskLevel: BriefRiskLevel =
    overdueInvoices.length > 0 || totalOutstandingMinor > 0 && pendingApprovals > 2
      ? oldestOverdueDays !== null && oldestOverdueDays >= 30
        ? "high"
        : "medium"
      : totalOutstandingMinor > 0 || unreconciledCount > 0
      ? "medium"
      : "low";

  return {
    student: {
      id: String(student._id),
      name: [student.firstName, student.lastName].filter(Boolean).join(" ").trim(),
      admissionNo: student.admissionNo || null,
      classGroupName,
    },
    scope: {
      periodId: params.periodId ? String(params.periodId) : null,
      scopeLabel: params.periodId ? "selected_period" : "all_periods",
    },
    metrics: {
      invoiceCount: invoices.length,
      overdueInvoiceCount: overdueInvoices.length,
      pendingApprovalCount: pendingApprovals,
      unreconciledPaymentCount: unreconciledCount,
      completedPaymentCount,
      totalBilledMinor,
      totalPaidMinor,
      totalOutstandingMinor,
      oldestOverdueDays,
      lastPaymentDate: lastPaymentDate ? lastPaymentDate.toISOString() : null,
    },
    riskLevel,
  };
}

function buildRuleBasedBrief(source: Awaited<ReturnType<typeof buildAccountBriefSource>>) {
  const metrics = source.metrics;
  const hasOutstanding = metrics.totalOutstandingMinor > 0;
  const overview = hasOutstanding
    ? `Outstanding balance is ${formatMinor(
        metrics.totalOutstandingMinor
      )} across ${metrics.invoiceCount} invoice(s). ${
        metrics.overdueInvoiceCount > 0
          ? `${metrics.overdueInvoiceCount} invoice(s) are overdue.`
          : "No overdue invoices right now."
      }`
    : "Account is currently clear with no outstanding invoice balance.";

  const keyPoints = [
    `Total billed: ${formatMinor(metrics.totalBilledMinor)}.`,
    `Total paid: ${formatMinor(metrics.totalPaidMinor)}.`,
    metrics.pendingApprovalCount > 0
      ? `${metrics.pendingApprovalCount} payment proof(s) are pending review.`
      : "No payment proofs are pending approval.",
    metrics.unreconciledPaymentCount > 0
      ? `${metrics.unreconciledPaymentCount} completed payment(s) still need reconciliation.`
      : "All completed payments are currently reconciled.",
  ];

  const actions = [
    hasOutstanding
      ? "Send a fee reminder and include payment channels in the message."
      : "Keep monitoring upcoming invoices and maintain current payment momentum.",
    metrics.pendingApprovalCount > 0
      ? "Review pending proofs to avoid delays in ledger updates."
      : "No approval backlog action needed.",
    metrics.unreconciledPaymentCount > 0
      ? "Resolve unreconciled items before end-of-day closure."
      : "No reconciliation exceptions require immediate action.",
  ].filter(Boolean);

  return {
    headline: hasOutstanding ? "Outstanding balance needs follow-up" : "Account is healthy",
    riskLevel: source.riskLevel,
    overview,
    keyPoints,
    recommendedActions: actions,
  } satisfies AccountBriefPayload;
}

function buildPrompt(source: Awaited<ReturnType<typeof buildAccountBriefSource>>) {
  const { student, metrics } = source;

  return `Create a concise fees account brief for school finance staff in Ghana.

Student: ${student.name || "Student"}
Admission No: ${student.admissionNo || "N/A"}
Class: ${student.classGroupName || "N/A"}
Scope: ${source.scope.scopeLabel}

Metrics:
- Total billed: ${formatMinor(metrics.totalBilledMinor)}
- Total paid: ${formatMinor(metrics.totalPaidMinor)}
- Total outstanding: ${formatMinor(metrics.totalOutstandingMinor)}
- Invoice count: ${metrics.invoiceCount}
- Overdue invoices: ${metrics.overdueInvoiceCount}
- Oldest overdue age (days): ${metrics.oldestOverdueDays ?? "N/A"}
- Pending payment approvals: ${metrics.pendingApprovalCount}
- Unreconciled completed payments: ${metrics.unreconciledPaymentCount}
- Last completed payment date: ${metrics.lastPaymentDate || "N/A"}

Return JSON only:
{
  "headline": "short title",
  "riskLevel": "low|medium|high",
  "overview": "2 short sentences, clear and practical",
  "keyPoints": ["point 1", "point 2", "point 3"],
  "recommendedActions": ["action 1", "action 2", "action 3"]
}

Rules:
- Keep language simple and operational.
- Never invent values.
- Keep each point/action under 18 words.`;
}

async function generateAIBrief(
  source: Awaited<ReturnType<typeof buildAccountBriefSource>>
) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model: MODEL_NAME,
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a finance copilot for school bursars. Return valid JSON only.",
      },
      {
        role: "user",
        content: buildPrompt(source),
      },
    ],
  });

  const text = completion.choices[0]?.message?.content;
  if (!text) {
    throw new Error("No AI response received.");
  }

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Unable to parse AI response.");
    parsed = JSON.parse(match[0]);
  }

  return {
    brief: normalizeBriefPayload(parsed),
    tokenUsage: completion.usage
      ? {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
        }
      : null,
    modelUsed: MODEL_NAME,
  };
}

function buildVariantKey(periodId: mongoose.Types.ObjectId | null) {
  return `period:${periodId ? String(periodId) : "all"}`;
}

async function loadCached(params: {
  schoolId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  variantKey: string;
}) {
  const cachedRaw = await AIFeatureCache.findOne({
    schoolId: params.schoolId,
    feature: FEATURE_KEY,
    scopeType: "student",
    scopeId: params.studentId,
    variantKey: params.variantKey,
    promptVersion: PROMPT_VERSION,
  }).lean();

  return Array.isArray(cachedRaw) ? cachedRaw[0] : cachedRaw;
}

function serializeResponse(params: {
  studentId: mongoose.Types.ObjectId;
  periodId: mongoose.Types.ObjectId | null;
  brief: AccountBriefPayload;
  budget: Awaited<ReturnType<typeof getSchoolAIBudgetSnapshot>>;
  source: "cache" | "rule_based" | "ai";
  cacheStatus: "fresh" | "stale" | "missing";
  generatedAt: string | null;
  tokenUsage?: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
  modelUsed?: string | null;
  dataFingerprint: string;
}) {
  return NextResponse.json({
    success: true,
    data: {
      feature: FEATURE_KEY,
      studentId: String(params.studentId),
      periodId: params.periodId ? String(params.periodId) : null,
      source: params.source,
      cacheStatus: params.cacheStatus,
      generatedAt: params.generatedAt,
      promptVersion: PROMPT_VERSION,
      dataFingerprint: params.dataFingerprint,
      modelUsed: params.modelUsed || null,
      tokenUsage: params.tokenUsage || null,
      budget: params.budget,
      brief: params.brief,
    },
  });
}

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireFinanceStaff();
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const studentId = toObjectIdOrNull(req.nextUrl.searchParams.get("studentId"));
    const periodId = toObjectIdOrNull(req.nextUrl.searchParams.get("periodId"));
    if (!studentId) {
      return NextResponse.json(
        { success: false, error: "Valid studentId is required." },
        { status: 400 }
      );
    }

    const source = await buildAccountBriefSource({
      schoolId: schoolIdObj,
      studentId,
      periodId,
    });
    const dataFingerprint = hashFingerprint({
      studentId: source.student.id,
      scope: source.scope,
      metrics: source.metrics,
      promptVersion: PROMPT_VERSION,
    });
    const variantKey = buildVariantKey(periodId);
    const budget = await getSchoolAIBudgetSnapshot(schoolIdObj);
    const cached = await loadCached({
      schoolId: schoolIdObj,
      studentId,
      variantKey,
    });

    if (
      cached &&
      cached.status === "ready" &&
      cached.dataFingerprint === dataFingerprint &&
      isCacheFresh(cached.expiresAt)
    ) {
      return serializeResponse({
        studentId,
        periodId,
        brief: normalizeBriefPayload(cached.output),
        budget,
        source: "cache",
        cacheStatus: "fresh",
        generatedAt: cached.generatedAt ? new Date(cached.generatedAt).toISOString() : null,
        tokenUsage: cached.tokenUsage || null,
        modelUsed: cached.modelUsed || null,
        dataFingerprint,
      });
    }

    return serializeResponse({
      studentId,
      periodId,
      brief: buildRuleBasedBrief(source),
      budget,
      source: "rule_based",
      cacheStatus: cached ? "stale" : "missing",
      generatedAt: cached?.generatedAt
        ? new Date(cached.generatedAt).toISOString()
        : null,
      tokenUsage: cached?.tokenUsage || null,
      modelUsed: cached?.modelUsed || null,
      dataFingerprint,
    });
  } catch (error: any) {
    if (error instanceof NextResponse) return error;
    const message = String(error?.message || "");
    const status =
      message === "Student not found"
        ? 404
        : message.includes("OPENAI_API_KEY")
        ? 503
        : 500;
    return NextResponse.json(
      { success: false, error: message || "Failed to load account brief." },
      { status }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { schoolId, userId } = await requireFinanceStaff();
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const body = await req.json().catch(() => ({}));
    const studentId = toObjectIdOrNull(body.studentId);
    const periodId = toObjectIdOrNull(body.periodId || null);
    const force = body.force === true;

    if (!studentId) {
      return NextResponse.json(
        { success: false, error: "Valid studentId is required." },
        { status: 400 }
      );
    }

    const source = await buildAccountBriefSource({
      schoolId: schoolIdObj,
      studentId,
      periodId,
    });
    const dataFingerprint = hashFingerprint({
      studentId: source.student.id,
      scope: source.scope,
      metrics: source.metrics,
      promptVersion: PROMPT_VERSION,
    });
    const variantKey = buildVariantKey(periodId);
    const budget = await getSchoolAIBudgetSnapshot(schoolIdObj);
    const cached = await loadCached({
      schoolId: schoolIdObj,
      studentId,
      variantKey,
    });

    if (
      !force &&
      cached &&
      cached.status === "ready" &&
      cached.dataFingerprint === dataFingerprint &&
      isCacheFresh(cached.expiresAt)
    ) {
      return serializeResponse({
        studentId,
        periodId,
        brief: normalizeBriefPayload(cached.output),
        budget,
        source: "cache",
        cacheStatus: "fresh",
        generatedAt: cached.generatedAt ? new Date(cached.generatedAt).toISOString() : null,
        tokenUsage: cached.tokenUsage || null,
        modelUsed: cached.modelUsed || null,
        dataFingerprint,
      });
    }

    await enforceSchoolLimit({
      schoolId,
      limitKey: "maxAICallsPerMonth",
      message:
        "The monthly AI account-brief limit has been reached for this school.",
    });

    if (!budget.canGenerate) {
      return NextResponse.json(
        {
          success: false,
          error: budget.reason || "Daily AI budget reached.",
          code: "ai_budget_exceeded",
          budget,
          fallback: buildRuleBasedBrief(source),
        },
        { status: 429 }
      );
    }

    const generated = await generateAIBrief(source);
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS);

    await recordAIFeatureUsage({
      schoolId: schoolIdObj,
      feature: FEATURE_KEY,
      scopeType: "student",
      scopeId: studentId,
      variantKey,
      generatedBy: userId || null,
      modelUsed: generated.modelUsed,
      tokenUsage: generated.tokenUsage,
    });
    await trackUsage({
      schoolId,
      provider: "openai",
      metricKey: "ai_calls",
      quantity: 1,
      unitLabel: "calls",
      allocationMethod: "direct",
      sourceType: "manual",
      notes: "Fees account-brief AI generation.",
    });
    await trackUsage({
      schoolId,
      provider: "openai",
      metricKey: "total_tokens",
      quantity: Math.max(0, Number(generated.tokenUsage?.totalTokens || 0)),
      unitLabel: "tokens",
      allocationMethod: "direct",
      sourceType: "manual",
      notes: "Fees account-brief AI token usage.",
    });

    await AIFeatureCache.findOneAndUpdate(
      {
        schoolId: schoolIdObj,
        feature: FEATURE_KEY,
        scopeType: "student",
        scopeId: studentId,
        variantKey,
        promptVersion: PROMPT_VERSION,
      },
      {
        schoolId: schoolIdObj,
        feature: FEATURE_KEY,
        scopeType: "student",
        scopeId: studentId,
        variantKey,
        promptVersion: PROMPT_VERSION,
        dataFingerprint,
        inputSnapshot: source,
        output: generated.brief,
        status: "ready",
        errorMessage: null,
        generatedBy: userId || null,
        generatedAt: new Date(),
        expiresAt,
        modelUsed: generated.modelUsed,
        tokenUsage: generated.tokenUsage,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const refreshedBudget = await getSchoolAIBudgetSnapshot(schoolIdObj);
    return serializeResponse({
      studentId,
      periodId,
      brief: generated.brief,
      budget: refreshedBudget,
      source: "ai",
      cacheStatus: "fresh",
      generatedAt: new Date().toISOString(),
      tokenUsage: generated.tokenUsage,
      modelUsed: generated.modelUsed,
      dataFingerprint,
    });
  } catch (error: any) {
    if (error instanceof Response) return error;
    const message = String(error?.message || "");
    const status =
      message === "Student not found"
        ? 404
        : message.includes("OPENAI_API_KEY")
        ? 503
        : 500;
    return NextResponse.json(
      {
        success: false,
        error: message || "Failed to generate account brief.",
      },
      { status }
    );
  }
}
