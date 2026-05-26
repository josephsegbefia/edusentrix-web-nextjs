import "server-only";

import { connectToDatabase } from "@/db/connectToDatabase";
import type { LearnMobileStudentContext } from "@/lib/learn/mobile-auth";
import { getStudentLearnAccess } from "@/lib/learn/access";
import {
  loadMobileStudentBundle,
  serializeMobileLoginStudent,
} from "@/lib/learn/mobile-student-profile";

const PLACEHOLDER_PATHS = [
  {
    id: "coding-logic-games",
    title: "Logic Games",
    description: "Short puzzles that build thinking skills before typing code.",
    level: "beginner" as const,
    status: "coming_soon" as const,
    estimatedLessons: 8,
    skillFocus: ["patterns", "sequences", "problem solving"],
  },
  {
    id: "coding-web-basics",
    title: "Web Basics",
    description: "Friendly HTML and CSS practice for older learners.",
    level: "intermediate" as const,
    status: "locked" as const,
    estimatedLessons: 12,
    skillFocus: ["HTML", "CSS", "creative projects"],
  },
  {
    id: "coding-ict-practice",
    title: "ICT Practice",
    description: "Digital skills aligned with school ICT lessons.",
    level: "beginner" as const,
    status: "available" as const,
    estimatedLessons: 10,
    skillFocus: ["computer basics", "safe browsing", "typing"],
  },
];

export async function buildMobileCodingPaths(context: LearnMobileStudentContext) {
  await connectToDatabase();

  const access = await getStudentLearnAccess({
    schoolId: context.schoolId,
    studentId: context.studentId,
    accountId: context.accountId,
  });

  if (!access.hasAccess) {
    return {
      ok: false as const,
      code: access.schoolEligible ? "LEARN_ACCESS_REQUIRED" : "SCHOOL_NOT_ELIGIBLE",
      message: access.blockedReason || "EduSentrix Learn access is required.",
      status: 403,
    };
  }

  const bundle = await loadMobileStudentBundle({
    studentId: context.studentId,
    schoolId: context.schoolId,
    accountId: context.accountId,
  });

  if (!bundle) {
    return {
      ok: false as const,
      code: "NO_STUDENT_PROFILE",
      message: "Student profile not found.",
      status: 404,
    };
  }

  const profile = serializeMobileLoginStudent(bundle);

  return {
    ok: true as const,
    data: {
      studentId: profile.studentId,
      moduleStatus: "coming_soon" as const,
      premiumLabel: "Premium digital skills (preview)",
      intro: "Coding and digital skills are coming to EduSentrix Learn. Paths below are safe previews only.",
      leoHelperMessage:
        "Leo can already help with ICT vocabulary and logic puzzles in chat — full coding games arrive later.",
      paths: PLACEHOLDER_PATHS,
    },
  };
}
