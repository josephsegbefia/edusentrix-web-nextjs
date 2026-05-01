import type { FlashcardProgressStatus } from "@/models/StudentFlashcardProgress";

export type LessonFlashcardDto = {
  id: string;
  deckId: string;
  lessonId: string;
  front: string;
  back: string;
  order: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type LessonFlashcardDeckDto = {
  id: string;
  lessonId: string;
  title: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export interface TeacherLessonFlashcardsResponse {
  success: boolean;
  data: {
    deck: LessonFlashcardDeckDto;
    cards: LessonFlashcardDto[];
  };
  error?: string;
}

export interface StudentLessonFlashcardsResponse {
  success: boolean;
  data: {
    deck: Pick<LessonFlashcardDeckDto, "id" | "title"> | null;
    cards: Array<
      LessonFlashcardDto & {
        progress: { status: FlashcardProgressStatus; reviewCount: number } | null;
      }
    >;
  };
  error?: string;
}

export type FlashcardProgressUpdatePayload = {
  status: FlashcardProgressStatus;
};
