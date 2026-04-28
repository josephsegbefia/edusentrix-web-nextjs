/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import mongoose from "mongoose";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { School } from "@/models/School";
import { Student } from "@/models/Student";

/**
 * Generates a meaningful student admission number.
 *
 * Format: {SCHOOL_PREFIX}-{YEAR}{MONTH}-{INITIALS}-{SEQ}
 *
 * Example: For "Joseph Segbefia" at "Saint Anthony's School", born 28 Sep 2024,
 * enrolled in 2025 → SAS-2509-JS-0042
 *
 * Breakdown:
 *   SAS      — School initials (Saint Anthony's School)
 *   25       — Enrollment year (last 2 digits)
 *   09       — Birth month (September = 09)
 *   JS       — Student initials (first + last)
 *   0042     — Sequential number within the school (zero-padded)
 */
function buildSchoolPrefix(schoolName: string): string {
  const words = schoolName
    .replace(/[^a-zA-Z\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return "SCH";

  // Skip common filler words for more meaningful abbreviation
  const skip = new Set([
    "the",
    "of",
    "and",
    "school",
    "academy",
    "college",
    "international",
    "preparatory",
    "prep",
    "basic",
    "primary",
    "junior",
    "senior",
    "high",
    "complex",
  ]);

  const significant = words.filter((w) => !skip.has(w.toLowerCase()));
  const source = significant.length > 0 ? significant : words;

  if (source.length === 1) {
    return source[0].substring(0, 3).toUpperCase();
  }

  // Take first letter of each significant word (max 4 chars)
  return source
    .slice(0, 4)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function buildStudentInitials(firstName: string, lastName: string): string {
  const f = firstName.trim().charAt(0).toUpperCase();
  const l = lastName.trim().charAt(0).toUpperCase();
  return `${f}${l}`;
}

function sanitizeAdmissionCandidate(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

async function ensureUniqueAdmissionNo(
  schoolId: mongoose.Types.ObjectId,
  base: string
): Promise<string> {
  let candidate = base;
  let n = 0;
  for (;;) {
    const exists = await Student.findOne({ schoolId, admissionNo: candidate }).lean();
    if (!exists) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
  }
}

async function suggestAdmissionWithLeo(input: {
  patternHint: string;
  schoolName: string;
  schoolPrefix: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
}): Promise<{ admissionNo: string; explanation: string } | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.35,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You help schools design one student admission / learner ID string. Return ONLY valid JSON: { "admissionNo": string, "explanation": string }.

admissionNo rules:
- Characters: letters, digits, hyphens only. No spaces.
- Length 6–40.
- Follow the administrator's pattern hint using school name, student name, and date of birth when relevant.

Real-world context (for explanation only): many schools use (1) a short school or district code + intake year + sequential roll number; (2) initials + birth date (e.g. YYYYMMDD) + sequence; (3) ministry/region codes plus a unique numeric tail. Uniqueness in a database is usually enforced with a serial or checking collisions—not by the ID format alone.

Produce one concrete ID that matches the hint; if the hint is vague, combine school prefix, year, initials, and a short numeric suffix.`,
      },
      {
        role: "user",
        content: JSON.stringify({
          patternHint: input.patternHint,
          schoolName: input.schoolName,
          suggestedPrefix: input.schoolPrefix,
          firstName: input.firstName,
          lastName: input.lastName,
          dateOfBirth: input.dateOfBirth ?? null,
        }),
      },
    ],
  });

  const text = completion.choices[0]?.message?.content;
  if (!text) return null;
  try {
    const data = JSON.parse(text) as {
      admissionNo?: string;
      explanation?: string;
    };
    const admissionNo = sanitizeAdmissionCandidate(String(data.admissionNo || ""));
    const explanation =
      typeof data.explanation === "string" ? data.explanation.trim() : "";
    if (admissionNo.length < 4) return null;
    return { admissionNo, explanation };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedAnyPermission([
      "students.edit",
    ]);
    await connectToDatabase();

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    const body = await req.json();
    const { firstName, lastName, dateOfBirth, patternHint } = body as {
      firstName?: string;
      lastName?: string;
      dateOfBirth?: string;
      patternHint?: string;
    };

    if (!firstName || !lastName) {
      return NextResponse.json(
        { success: false, error: "First name and last name are required" },
        { status: 400 }
      );
    }

    const school = await School.findById(schoolId).select("name").lean();
    const schoolName: string = (school as any)?.name ?? "School";

    const schoolPrefix = buildSchoolPrefix(schoolName);
    const initials = buildStudentInitials(firstName, lastName);

    const hint = typeof patternHint === "string" ? patternHint.trim() : "";
    let leoFallbackNote: string | undefined;

    if (hint.length >= 3) {
      const leo = await suggestAdmissionWithLeo({
        patternHint: hint,
        schoolName,
        schoolPrefix,
        firstName,
        lastName,
        dateOfBirth,
      });
      if (leo) {
        const unique = await ensureUniqueAdmissionNo(schoolIdObj, leo.admissionNo);
        return NextResponse.json({
          success: true,
          admissionNo: unique,
          source: "leo" as const,
          leoExplanation: leo.explanation,
          breakdown: {
            schoolPrefix,
            enrollYear: "—",
            birthMonth: "—",
            initials,
            sequence: "—",
          },
        });
      }
      leoFallbackNote = !process.env.OPENAI_API_KEY
        ? "OpenAI isn’t configured; used the standard format below."
        : "Leo couldn’t build an ID from that hint; used the standard format below.";
    }

    const now = new Date();
    const enrollYear = String(now.getFullYear()).slice(-2);

    let birthPart = "00";
    if (dateOfBirth) {
      const dob = new Date(dateOfBirth);
      if (!isNaN(dob.getTime())) {
        birthPart = String(dob.getMonth() + 1).padStart(2, "0");
      }
    }

    const totalStudents = await Student.countDocuments({ schoolId });
    const seq = String(totalStudents + 1).padStart(4, "0");

    const admissionNo = `${schoolPrefix}-${enrollYear}${birthPart}-${initials}-${seq}`;
    const finalId = await ensureUniqueAdmissionNo(schoolIdObj, admissionNo);

    return NextResponse.json({
      success: true,
      admissionNo: finalId,
      source: "deterministic" as const,
      ...(leoFallbackNote ? { leoFallbackNote } : {}),
      breakdown: {
        schoolPrefix,
        enrollYear,
        birthMonth: birthPart,
        initials,
        sequence: seq,
      },
    });
  } catch (e: unknown) {
    console.error("Generate student ID error:", e);
    const message =
      e instanceof Error ? e.message : "Failed to generate student ID";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
