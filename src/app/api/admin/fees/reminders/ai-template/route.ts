/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import OpenAI from "openai";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { Invoice } from "@/models/Invoice";
import { Guardian } from "@/models/Guardian";
import { Student } from "@/models/Student";
import { AIFeatureCache } from "@/models/AIFeatureCache";
import {
  getSchoolAIBudgetSnapshot,
  hashFingerprint,
  isCacheFresh,
  recordAIFeatureUsage,
} from "@/lib/ai/feature-budget";

const FEATURE_KEY = "fees_reminder_template";
const PROMPT_VERSION = 1;
const MODEL_NAME = "gpt-4o-mini";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

const QuerySchema = z.object({
  channel: z.enum(["email", "sms", "whatsapp"]).default("email"),
  tone: z.enum(["friendly", "firm", "urgent"]).default("friendly"),
  onlyPrimaryGuardian: z.coerce.boolean().optional().default(false),
  classGroupId: z.string().optional(),
});

type Channel = "email" | "sms" | "whatsapp";
type Tone = "friendly" | "firm" | "urgent";

type ReminderTemplateOutput = {
  subject: string | null;
  message: string;
  rationale: string;
  tone: Tone;
};

function toObjectIdOrNull(value?: string | null) {
  if (!value) return null;
  if (!mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

function formatMinor(minor: number) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
  }).format((minor || 0) / 100);
}

function normalizeTemplateOutput(
  value: any,
  params: { channel: Channel; tone: Tone }
): ReminderTemplateOutput {
  const subjectRaw = String(value?.subject || "").trim();
  const messageRaw = String(value?.message || "").trim();
  const rationaleRaw = String(value?.rationale || "").trim();
  const toneRaw = String(value?.tone || "").toLowerCase();

  const tone: Tone =
    toneRaw === "firm" || toneRaw === "urgent" ? toneRaw : params.tone;

  return {
    subject:
      params.channel === "email"
        ? (subjectRaw || "Fee Reminder: Outstanding Balance")
            .slice(0, 160)
            .trim()
        : null,
    message: messageRaw.slice(0, params.channel === "sms" ? 320 : 1200).trim(),
    rationale:
      rationaleRaw ||
      "Template balances clarity, courtesy, and urgency for guardian action.",
    tone,
  };
}

async function buildReminderContext(params: {
  schoolId: mongoose.Types.ObjectId;
  onlyPrimaryGuardian: boolean;
  classGroupId: mongoose.Types.ObjectId | null;
}) {
  const invoiceMatch: Record<string, unknown> = {
    schoolId: params.schoolId,
    totalOutstandingMinor: { $gt: 0 },
    status: { $in: ["issued", "partially_paid", "overdue"] },
  };

  const invoiceRows = await Invoice.aggregate<{
    _id: mongoose.Types.ObjectId;
    totalOutstandingMinor: number;
    overdueInvoiceCount: number;
  }>([
    { $match: invoiceMatch },
    {
      $group: {
        _id: "$studentId",
        totalOutstandingMinor: { $sum: "$totalOutstandingMinor" },
        overdueInvoiceCount: {
          $sum: { $cond: [{ $eq: ["$status", "overdue"] }, 1, 0] },
        },
      },
    },
  ]);

  if (invoiceRows.length === 0) {
    return {
      recipientCount: 0,
      studentCount: 0,
      totalOutstandingMinor: 0,
      overdueInvoiceCount: 0,
      topOutstandingStudents: [] as Array<{ name: string; outstandingMinor: number }>,
    };
  }

  const allStudentIds = invoiceRows.map((row) => row._id);
  const studentQuery: Record<string, unknown> = {
    _id: { $in: allStudentIds },
    schoolId: params.schoolId,
  };
  if (params.classGroupId) {
    studentQuery.classGroupId = params.classGroupId;
  }

  const students = await Student.find(studentQuery)
    .select("firstName lastName")
    .lean();
  const studentIds = students.map((student: any) => student._id);
  if (!studentIds.length) {
    return {
      recipientCount: 0,
      studentCount: 0,
      totalOutstandingMinor: 0,
      overdueInvoiceCount: 0,
      topOutstandingStudents: [] as Array<{ name: string; outstandingMinor: number }>,
    };
  }

  const rowMap = new Map(
    invoiceRows.map((row) => [
      String(row._id),
      {
        totalOutstandingMinor: Number(row.totalOutstandingMinor || 0),
        overdueInvoiceCount: Number(row.overdueInvoiceCount || 0),
      },
    ])
  );

  const totalOutstandingMinor = students.reduce(
    (sum, student: any) =>
      sum + Number(rowMap.get(String(student._id))?.totalOutstandingMinor || 0),
    0
  );
  const overdueInvoiceCount = students.reduce(
    (sum, student: any) =>
      sum + Number(rowMap.get(String(student._id))?.overdueInvoiceCount || 0),
    0
  );

  const guardianDistinct = await Guardian.distinct("userId", {
    studentId: { $in: studentIds },
    userId: { $ne: null },
    ...(params.onlyPrimaryGuardian ? { isPrimary: true } : {}),
  });

  const topOutstandingStudents = students
    .map((student: any) => {
      const fullName = [student.firstName, student.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();
      return {
        name: fullName || "Student",
        outstandingMinor: Number(
          rowMap.get(String(student._id))?.totalOutstandingMinor || 0
        ),
      };
    })
    .sort((a, b) => b.outstandingMinor - a.outstandingMinor)
    .slice(0, 3);

  return {
    recipientCount: guardianDistinct.length,
    studentCount: students.length,
    totalOutstandingMinor,
    overdueInvoiceCount,
    topOutstandingStudents,
  };
}

function buildRuleTemplate(params: {
  channel: Channel;
  tone: Tone;
  context: Awaited<ReturnType<typeof buildReminderContext>>;
}) {
  const urgencyLine =
    params.context.overdueInvoiceCount > 0
      ? `Some balances are overdue and need prompt attention.`
      : "Kindly settle the balance at your earliest convenience.";

  const toneLead =
    params.tone === "urgent"
      ? "This is an urgent fee reminder."
      : params.tone === "firm"
      ? "This is a formal reminder regarding outstanding school fees."
      : "We hope you are well. This is a friendly reminder about outstanding school fees.";

  const message = `${toneLead} Our records show outstanding fees for your ward(s). ${urgencyLine} Please use the available payment channels and share proof where needed. Thank you for your continued support.`;

  return {
    subject:
      params.channel === "email" ? "Fee Reminder: Outstanding Balance" : null,
    message:
      params.channel === "sms"
        ? message.slice(0, 320)
        : message.slice(0, 1200),
    rationale:
      "Rule-based fallback generated from current outstanding-fee metrics.",
    tone: params.tone,
  } satisfies ReminderTemplateOutput;
}

function buildPrompt(params: {
  channel: Channel;
  tone: Tone;
  context: Awaited<ReturnType<typeof buildReminderContext>>;
}) {
  const topStudents = params.context.topOutstandingStudents
    .map((item) => `${item.name} (${formatMinor(item.outstandingMinor)})`)
    .join(", ");

  return `Draft a ${params.channel.toUpperCase()} reminder template for guardians with outstanding fees in a Ghanaian school.

Tone: ${params.tone}
Recipients (guardians): ${params.context.recipientCount}
Students affected: ${params.context.studentCount}
Total outstanding: ${formatMinor(params.context.totalOutstandingMinor)}
Overdue invoices: ${params.context.overdueInvoiceCount}
Top outstanding wards: ${topStudents || "N/A"}

Constraints:
- Do not include individual names or exact figures.
- Be clear, respectful, and action-oriented.
- Mention payment channels and proof submission.
- Keep plain language.
- For SMS, keep message under 320 chars.
- For Email/WhatsApp, keep message under 600 chars.

Return JSON only:
{
  "subject": "email subject or empty for non-email",
  "message": "message body",
  "rationale": "short explanation of wording choice",
  "tone": "${params.tone}"
}`;
}

async function generateAITemplate(params: {
  channel: Channel;
  tone: Tone;
  context: Awaited<ReturnType<typeof buildReminderContext>>;
}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model: MODEL_NAME,
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a school finance communications assistant. Return valid JSON only.",
      },
      {
        role: "user",
        content: buildPrompt(params),
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
    template: normalizeTemplateOutput(parsed, {
      channel: params.channel,
      tone: params.tone,
    }),
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

function buildVariantKey(params: { tone: Tone; onlyPrimaryGuardian: boolean; classGroupId: string | null }) {
  return `tone:${params.tone}|primary:${params.onlyPrimaryGuardian ? "1" : "0"}|class:${params.classGroupId || "all"}`;
}

function serializeResponse(params: {
  channel: Channel;
  tone: Tone;
  template: ReminderTemplateOutput;
  source: "cache" | "rule_based" | "ai";
  cacheStatus: "fresh" | "stale" | "missing";
  dataFingerprint: string;
  generatedAt: string | null;
  modelUsed?: string | null;
  tokenUsage?: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
  budget: Awaited<ReturnType<typeof getSchoolAIBudgetSnapshot>>;
}) {
  return NextResponse.json({
    success: true,
    data: {
      feature: FEATURE_KEY,
      channel: params.channel,
      tone: params.tone,
      source: params.source,
      cacheStatus: params.cacheStatus,
      generatedAt: params.generatedAt,
      promptVersion: PROMPT_VERSION,
      dataFingerprint: params.dataFingerprint,
      modelUsed: params.modelUsed || null,
      tokenUsage: params.tokenUsage || null,
      budget: params.budget,
      template: params.template,
    },
  });
}

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireFinanceStaff();
    await connectToDatabase();

    const parsed = QuerySchema.safeParse({
      channel: req.nextUrl.searchParams.get("channel") || "email",
      tone: req.nextUrl.searchParams.get("tone") || "friendly",
      onlyPrimaryGuardian:
        req.nextUrl.searchParams.get("onlyPrimaryGuardian") || "false",
      classGroupId: req.nextUrl.searchParams.get("classGroupId") || undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid request parameters." },
        { status: 400 }
      );
    }

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const channel = parsed.data.channel;
    const tone = parsed.data.tone;
    const classGroupId = toObjectIdOrNull(parsed.data.classGroupId || null);
    if (parsed.data.classGroupId && !classGroupId) {
      return NextResponse.json(
        { success: false, error: "Invalid classGroupId." },
        { status: 400 }
      );
    }

    const context = await buildReminderContext({
      schoolId: schoolIdObj,
      onlyPrimaryGuardian: parsed.data.onlyPrimaryGuardian,
      classGroupId,
    });
    const dataFingerprint = hashFingerprint({
      channel,
      tone,
      onlyPrimaryGuardian: parsed.data.onlyPrimaryGuardian,
      classGroupId: classGroupId ? String(classGroupId) : null,
      context,
      promptVersion: PROMPT_VERSION,
    });
    const variantKey = buildVariantKey({
      tone,
      onlyPrimaryGuardian: parsed.data.onlyPrimaryGuardian,
      classGroupId: classGroupId ? String(classGroupId) : null,
    });
    const budget = await getSchoolAIBudgetSnapshot(schoolIdObj);

    const cachedRaw = await AIFeatureCache.findOne({
      schoolId: schoolIdObj,
      feature: FEATURE_KEY,
      scopeType: "school",
      scopeId: null,
      variantKey,
      promptVersion: PROMPT_VERSION,
    }).lean();
    const cached = Array.isArray(cachedRaw) ? cachedRaw[0] : cachedRaw;

    if (
      cached &&
      cached.status === "ready" &&
      cached.dataFingerprint === dataFingerprint &&
      isCacheFresh(cached.expiresAt)
    ) {
      return serializeResponse({
        channel,
        tone,
        template: normalizeTemplateOutput(cached.output, { channel, tone }),
        source: "cache",
        cacheStatus: "fresh",
        dataFingerprint,
        generatedAt: cached.generatedAt ? new Date(cached.generatedAt).toISOString() : null,
        modelUsed: cached.modelUsed || null,
        tokenUsage: cached.tokenUsage || null,
        budget,
      });
    }

    return serializeResponse({
      channel,
      tone,
      template: buildRuleTemplate({ channel, tone, context }),
      source: "rule_based",
      cacheStatus: cached ? "stale" : "missing",
      dataFingerprint,
      generatedAt: cached?.generatedAt
        ? new Date(cached.generatedAt).toISOString()
        : null,
      modelUsed: cached?.modelUsed || null,
      tokenUsage: cached?.tokenUsage || null,
      budget,
    });
  } catch (error: any) {
    if (error instanceof NextResponse) return error;
    const message = String(error?.message || "");
    const status = message.includes("OPENAI_API_KEY") ? 503 : 500;
    return NextResponse.json(
      { success: false, error: message || "Failed to load AI reminder template." },
      { status }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { schoolId, userId } = await requireFinanceStaff();
    await connectToDatabase();

    const body = await req.json().catch(() => ({}));
    const parsed = QuerySchema.extend({
      force: z.boolean().optional().default(false),
    }).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid request payload." },
        { status: 400 }
      );
    }

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const channel = parsed.data.channel;
    const tone = parsed.data.tone;
    const classGroupId = toObjectIdOrNull(parsed.data.classGroupId || null);
    if (parsed.data.classGroupId && !classGroupId) {
      return NextResponse.json(
        { success: false, error: "Invalid classGroupId." },
        { status: 400 }
      );
    }

    const context = await buildReminderContext({
      schoolId: schoolIdObj,
      onlyPrimaryGuardian: parsed.data.onlyPrimaryGuardian,
      classGroupId,
    });
    const dataFingerprint = hashFingerprint({
      channel,
      tone,
      onlyPrimaryGuardian: parsed.data.onlyPrimaryGuardian,
      classGroupId: classGroupId ? String(classGroupId) : null,
      context,
      promptVersion: PROMPT_VERSION,
    });
    const variantKey = buildVariantKey({
      tone,
      onlyPrimaryGuardian: parsed.data.onlyPrimaryGuardian,
      classGroupId: classGroupId ? String(classGroupId) : null,
    });

    const cachedRaw = await AIFeatureCache.findOne({
      schoolId: schoolIdObj,
      feature: FEATURE_KEY,
      scopeType: "school",
      scopeId: null,
      variantKey,
      promptVersion: PROMPT_VERSION,
    }).lean();
    const cached = Array.isArray(cachedRaw) ? cachedRaw[0] : cachedRaw;

    const budget = await getSchoolAIBudgetSnapshot(schoolIdObj);
    if (
      !parsed.data.force &&
      cached &&
      cached.status === "ready" &&
      cached.dataFingerprint === dataFingerprint &&
      isCacheFresh(cached.expiresAt)
    ) {
      return serializeResponse({
        channel,
        tone,
        template: normalizeTemplateOutput(cached.output, { channel, tone }),
        source: "cache",
        cacheStatus: "fresh",
        dataFingerprint,
        generatedAt: cached.generatedAt ? new Date(cached.generatedAt).toISOString() : null,
        modelUsed: cached.modelUsed || null,
        tokenUsage: cached.tokenUsage || null,
        budget,
      });
    }

    if (!budget.canGenerate) {
      return NextResponse.json(
        {
          success: false,
          error: budget.reason || "Daily AI budget reached.",
          code: "ai_budget_exceeded",
          budget,
          fallback: buildRuleTemplate({ channel, tone, context }),
        },
        { status: 429 }
      );
    }

    const generated = await generateAITemplate({ channel, tone, context });
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS);

    await recordAIFeatureUsage({
      schoolId: schoolIdObj,
      feature: FEATURE_KEY,
      scopeType: "school",
      scopeId: null,
      variantKey,
      generatedBy: userId || null,
      modelUsed: generated.modelUsed,
      tokenUsage: generated.tokenUsage,
    });

    await AIFeatureCache.findOneAndUpdate(
      {
        schoolId: schoolIdObj,
        feature: FEATURE_KEY,
        scopeType: "school",
        scopeId: null,
        variantKey,
        promptVersion: PROMPT_VERSION,
      },
      {
        schoolId: schoolIdObj,
        feature: FEATURE_KEY,
        scopeType: "school",
        scopeId: null,
        variantKey,
        promptVersion: PROMPT_VERSION,
        dataFingerprint,
        inputSnapshot: {
          channel,
          tone,
          onlyPrimaryGuardian: parsed.data.onlyPrimaryGuardian,
          classGroupId: classGroupId ? String(classGroupId) : null,
          context,
        },
        output: generated.template,
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
      channel,
      tone,
      template: generated.template,
      source: "ai",
      cacheStatus: "fresh",
      dataFingerprint,
      generatedAt: new Date().toISOString(),
      modelUsed: generated.modelUsed,
      tokenUsage: generated.tokenUsage,
      budget: refreshedBudget,
    });
  } catch (error: any) {
    if (error instanceof NextResponse) return error;
    const message = String(error?.message || "");
    const status = message.includes("OPENAI_API_KEY") ? 503 : 500;
    return NextResponse.json(
      { success: false, error: message || "Failed to generate AI reminder template." },
      { status }
    );
  }
}
