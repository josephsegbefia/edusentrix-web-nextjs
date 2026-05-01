import type { serializeLibraryBookPatron } from "@/lib/library/library.serialize";
import type { LessonResourceKind, LessonResourceVisibility } from "@/models/LessonResource";

export type LessonResourcePatronBook = ReturnType<typeof serializeLibraryBookPatron>;

export interface LessonResourceDto {
  id: string;
  lessonId: string;
  kind: LessonResourceKind;
  title: string;
  description: string | null;
  url: string | null;
  linkType: string | null;
  libraryBookId: string | null;
  visibility: LessonResourceVisibility;
  order: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface TeacherLessonResourcesResponse {
  success: boolean;
  data: { items: LessonResourceDto[] };
  error?: string;
}

export type StudentLessonResourceRow =
  | {
      id: string;
      kind: "link";
      title: string;
      description: string | null;
      url: string;
      linkType: string | null;
      order: number;
    }
  | {
      id: string;
      kind: "library_book";
      title: string;
      description: string | null;
      order: number;
      libraryBookId: string;
      book: LessonResourcePatronBook | null;
      libraryPath: string;
    };

export interface StudentLessonResourcesResponse {
  success: boolean;
  data: { items: StudentLessonResourceRow[] };
  error?: string;
}
