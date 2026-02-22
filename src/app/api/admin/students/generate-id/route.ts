/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
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

export async function POST(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const body = await req.json();
    const { firstName, lastName, dateOfBirth } = body as {
      firstName?: string;
      lastName?: string;
      dateOfBirth?: string;
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

    const now = new Date();
    const enrollYear = String(now.getFullYear()).slice(-2);

    let birthPart = "00";
    if (dateOfBirth) {
      const dob = new Date(dateOfBirth);
      if (!isNaN(dob.getTime())) {
        birthPart = String(dob.getMonth() + 1).padStart(2, "0");
      }
    }

    // Get the next sequential number for this school
    const totalStudents = await Student.countDocuments({ schoolId });
    const seq = String(totalStudents + 1).padStart(4, "0");

    const admissionNo = `${schoolPrefix}-${enrollYear}${birthPart}-${initials}-${seq}`;

    // Verify uniqueness, append a suffix if collision (extremely unlikely)
    const exists = await Student.findOne({
      schoolId,
      admissionNo,
    }).lean();

    const finalId = exists
      ? `${admissionNo}${String(Math.floor(Math.random() * 9) + 1)}`
      : admissionNo;

    return NextResponse.json({
      success: true,
      admissionNo: finalId,
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
