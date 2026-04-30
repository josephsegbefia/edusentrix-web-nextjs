import "server-only";
import mongoose from "mongoose";
import type { Types } from "mongoose";
import { Grade } from "@/models/Grade";
import { escapeRegex } from "@/lib/utils";
import { recommendLibraryBooksForGrade } from "@/lib/library/library-recommendations.service";
import type { LeoAssistantDraft } from "@/lib/leo/types";

async function resolveGradeIdFromMessage(
  schoolId: Types.ObjectId,
  message: string
): Promise<{ gradeId: Types.ObjectId; label: string } | null> {
  const oidMatch = message.match(/\b([a-f\d]{24})\b/i);
  if (oidMatch && mongoose.Types.ObjectId.isValid(oidMatch[1])) {
    const gid = new mongoose.Types.ObjectId(oidMatch[1]);
    const g = await Grade.findOne({ _id: gid, schoolId, isActive: true })
      .select("name")
      .lean();
    if (g) return { gradeId: gid, label: g.name };
  }

  const named = message.match(/\bgrade\s*[:\s]+([^\n,.!?]{1,48})/i);
  if (named) {
    const raw = named[1].trim().replace(/["']/g, "");
    if (raw.length > 0) {
      const exact = await Grade.findOne({
        schoolId,
        isActive: true,
        name: new RegExp(`^${escapeRegex(raw)}$`, "i"),
      })
        .select("_id name")
        .lean();
      if (exact) return { gradeId: exact._id, label: exact.name };
      const partial = await Grade.findOne({
        schoolId,
        isActive: true,
        name: new RegExp(escapeRegex(raw), "i"),
      })
        .select("_id name")
        .lean();
      if (partial) return { gradeId: partial._id, label: partial.name };
    }
  }

  return null;
}

export async function runLibraryRecommendBooksTool(args: {
  schoolId: Types.ObjectId;
  userMessage: string;
}): Promise<LeoAssistantDraft> {
  const resolved = await resolveGradeIdFromMessage(args.schoolId, args.userMessage);
  if (!resolved) {
    return {
      contentText: [
        "To list library titles for a grade, name the grade the same way it appears in your catalogue,",
        "or paste the grade’s ObjectId. Example: “Recommend library books for grade JHS 1”.",
      ].join("\n"),
      citations: [{ type: "route", label: "Library admin", ref: "/admin/library" }],
      toolsUsed: ["library_recommend_books"],
    };
  }

  const books = await recommendLibraryBooksForGrade(
    args.schoolId,
    resolved.gradeId,
    12
  );

  if (books.length === 0) {
    return {
      contentText: [
        `No active library titles with available copies are tagged for ${resolved.label} right now.`,
        "Add grade tags to books in the library catalogue, or check that copies are available.",
      ].join("\n"),
      citations: [
        { type: "route", label: "Library admin", ref: "/admin/library" },
        { type: "record", label: "Grade filter", ref: "src/lib/library/library-recommendations.service.ts" },
      ],
      toolsUsed: ["library_recommend_books"],
    };
  }

  const lines = [
    `Here are up to ${books.length} suggested titles tagged for ${resolved.label} (with available copies):`,
    "",
    ...books.map((b, i) => `${i + 1}. ${b.title}${b.author ? ` — ${b.author}` : ""}`),
  ];

  return {
    contentText: lines.join("\n"),
    citations: [
      { type: "route", label: "Library admin", ref: "/admin/library" },
      { type: "record", label: "Catalogue filter", ref: "LibraryBook.gradeLevelIds" },
    ],
    toolsUsed: ["library_recommend_books"],
  };
}
