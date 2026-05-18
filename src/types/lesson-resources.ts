import type { serializeLibraryBookPatron } from "@/lib/library/library.serialize";
import type {
  LessonResourceFileType,
  LessonResourceKind,
  LessonResourceVisibility,
} from "@/models/LessonResource";

export type LessonResourcePatronBook = ReturnType<typeof serializeLibraryBookPatron>;

export interface LessonResourceDto {
  id: string;
  lessonId: string | null;
  sessionId?: string | null;
  kind: LessonResourceKind;
  title: string;
  description: string | null;
  url: string | null;
  fileUrl: string | null;
  uploadThingKey: string | null;
  fileName: string | null;
  fileSizeBytes: number | null;
  mimeType: string | null;
  fileType: LessonResourceFileType | null;
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
      kind: "file";
      title: string;
      description: string | null;
      fileUrl: string;
      fileName: string | null;
      fileSizeBytes: number | null;
      mimeType: string | null;
      fileType: LessonResourceFileType | null;
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
