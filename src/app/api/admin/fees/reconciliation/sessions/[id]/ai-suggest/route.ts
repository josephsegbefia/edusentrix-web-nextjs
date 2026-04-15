import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import OpenAI from "openai";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { ReconciliationIngestion } from "@/models/ReconciliationIngestion";
import { Payment } from "@/models/Payment";
import { toMajorUnits } from "@/lib/fees/money";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { schoolId } = await requireFinanceStaff();
    await connectToDatabase();

    const { id: sessionId } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return NextResponse.json({ ok: false, error: "Invalid session ID" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const ingestionIds: string[] = Array.isArray(body.ingestionIds) ? body.ingestionIds : [];
    const limit =
      ingestionIds.length > 0
        ? Math.min(10, Math.max(1, ingestionIds.length))
        : 10;

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));

    const filter: Record<string, unknown> = {
      schoolId: schoolIdObj,
      status: "ambiguous",
    };
    if (ingestionIds.length > 0) {
      filter._id = {
        $in: ingestionIds
          .filter((id) => mongoose.Types.ObjectId.isValid(id))
          .map((id) => new mongoose.Types.ObjectId(id)),
      };
    }

    const ambiguousItems = await ReconciliationIngestion.find(filter)
      .sort({ transactionDate: -1 })
      .limit(limit)
      .lean();

    if (ambiguousItems.length === 0) {
      return NextResponse.json({
        ok: true,
        data: { suggestions: [], message: "No ambiguous items to analyze." },
      });
    }

    const candidatePaymentIds = [
      ...new Set(
        ambiguousItems.flatMap((item) =>
          (item.candidatePaymentIds || []).map(String)
        )
      ),
    ];

    const payments = await Payment.find({
      _id: { $in: candidatePaymentIds },
      schoolId: schoolIdObj,
    })
      .select(
        "_id amountMinor paymentDate paymentMethod paystackReference externalReference receiptNumber reconciliationStatus studentId invoiceId"
      )
      .lean();

    const paymentMap = new Map(payments.map((p) => [String(p._id), p]));

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        ok: true,
        data: {
          suggestions: ambiguousItems.map((item) => ({
            ingestionId: String(item._id),
            suggestion: null,
            reason: "AI analysis is unavailable. Please match manually.",
          })),
          message: "AI service is not configured.",
        },
      });
    }

    const itemDescriptions = ambiguousItems.map((item) => {
      const candidates = (item.candidatePaymentIds || []).map((pid) => {
        const p = paymentMap.get(String(pid));
        if (!p) return { id: String(pid), note: "Payment not found" };
        return {
          id: String(p._id),
          amount: `GHS ${toMajorUnits(p.amountMinor || 0).toFixed(2)}`,
          date: p.paymentDate
            ? new Date(p.paymentDate).toISOString().slice(0, 10)
            : "unknown",
          method: p.paymentMethod || "unknown",
          references: [p.paystackReference, p.externalReference, p.receiptNumber]
            .filter(Boolean)
            .join(", ") || "none",
          reconciliationStatus: p.reconciliationStatus || "unmatched",
        };
      });

      return {
        ingestionId: String(item._id),
        sourceType: item.sourceType,
        externalTxnId: item.externalTxnId,
        amount: `GHS ${toMajorUnits(item.amountMinor || 0).toFixed(2)}`,
        date: item.transactionDate
          ? new Date(item.transactionDate).toISOString().slice(0, 10)
          : "unknown",
        payerName: item.payerName || "unknown",
        reference: item.rawReference || item.normalizedReference || "none",
        candidates,
      };
    });

    const prompt = `You are a school finance reconciliation assistant. Analyze these ambiguous reconciliation items and suggest the best match for each.

For each item, recommend ONE candidate payment to match, or "none" if no candidate is a confident match.
Explain your reasoning briefly.

Items:
${JSON.stringify(itemDescriptions, null, 2)}

Respond ONLY with valid JSON, no markdown:
{
  "suggestions": [
    {
      "ingestionId": "...",
      "recommendedPaymentId": "..." or null,
      "confidence": 0-100,
      "reasoning": "Brief explanation"
    }
  ]
}`;

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an experienced school finance officer specializing in payment reconciliation. Always respond with valid JSON only, no markdown.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
      max_tokens: 2000,
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error("No response from AI service");
    }

    let parsed: {
      suggestions?: Array<{
        ingestionId: string;
        recommendedPaymentId: string | null;
        confidence: number;
        reasoning: string;
      }>;
    };
    try {
      parsed = JSON.parse(responseText);
    } catch {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to parse AI response");
      }
    }

    const suggestions = (parsed.suggestions || []).map((s) => ({
      ingestionId: s.ingestionId,
      recommendedPaymentId: s.recommendedPaymentId || null,
      confidence: Math.min(100, Math.max(0, s.confidence || 0)),
      reasoning: s.reasoning || "",
    }));

    return NextResponse.json({
      ok: true,
      data: { suggestions },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    const message = error instanceof Error ? error.message : "Failed to generate AI suggestions.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
