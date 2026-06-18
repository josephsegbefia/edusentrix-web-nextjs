"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { LessonContentBlocksRenderer } from "@/components/lessons/LessonContentBlocksRenderer";
import type { LessonContentBlock } from "@/types/lesson-content-blocks";

type Props = {
  classLabel: string;
  contentBlocks: LessonContentBlock[];
  title: string;
  planNotes: string;
};

export function TeacherSessionTaughtArchive({
  classLabel,
  contentBlocks,
  title,
  planNotes,
}: Props) {
  return (
    <Accordion type="multiple" defaultValue={[]} className="rounded-xl border border-white/10 bg-white/5 px-4">
      <AccordionItem value="content" className="border-white/10">
        <AccordionTrigger className="text-sm text-white/85 hover:no-underline">
          <div className="text-left">
            <p className="font-medium">Lesson taught</p>
            <p className="text-xs font-normal text-white/45">
              Read-only for {classLabel} · {contentBlocks.length} block
              {contentBlocks.length === 1 ? "" : "s"}
            </p>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pb-4">
          <LessonContentBlocksRenderer blocks={contentBlocks} viewMode="teacher" />
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="plan" className="border-white/10">
        <AccordionTrigger className="text-sm text-white/85 hover:no-underline">
          <div className="text-left">
            <p className="font-medium">Session plan</p>
            <p className="text-xs font-normal text-white/45">Private notes used while teaching</p>
          </div>
        </AccordionTrigger>
        <AccordionContent className="space-y-3 pb-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/40">Title</p>
            <p className="mt-1 text-sm text-white/85">{title || "Untitled session"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-white/40">Plan notes</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-white/75">
              {planNotes.trim() || "No plan notes recorded."}
            </p>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
