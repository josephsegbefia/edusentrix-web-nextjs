"use client";

import { LessonContentBlocksRenderer } from "@/components/lessons/LessonContentBlocksRenderer";
import { mapStudentPayloadBlocksToContentBlocks } from "@/lib/lessons/student-content-renderer";
import type { StudentLessonSessionContentDto } from "@/types/lesson-content-blocks";

type Props = {
  blocks: StudentLessonSessionContentDto["blocks"];
};

export function StudentSessionContentView({ blocks }: Props) {
  const renderBlocks = mapStudentPayloadBlocksToContentBlocks(blocks);

  if (renderBlocks.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/50">
        No content has been published for this session yet.
      </div>
    );
  }

  return (
    <LessonContentBlocksRenderer
      blocks={renderBlocks}
      viewMode="student"
      className="lesson-content"
    />
  );
}
