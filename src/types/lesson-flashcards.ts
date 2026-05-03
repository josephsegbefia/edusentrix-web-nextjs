import type { FlashcardProgressStatus } from "@/models/StudentFlashcardProgress";

export type LessonFlashcardDto = {
  id: string;
  deckId: string;
  lessonId: string;
  front: string;
  back: string;
  hint: string | null;
  explanation: string | null;
  imageUrl: string | null;
  difficulty: "easy" | "medium" | "hard" | null;
  cardType: "qa" | "term_definition" | "image_prompt" | "concept_example" | null;
  order: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type LessonFlashcardDeckDto = {
  id: string;
  lessonId: string;
  title: string;
  description: string | null;
  status: "draft" | "published" | "archived";
  publishToClassGroupIds: string[];
  availableFrom: string | null;
  availableUntil: string | null;
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
