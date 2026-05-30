import { redirect } from "next/navigation";

/** Legacy gradebook list — redirects to Marks & Reports (Slice 23). */
export default function TeacherGradebookPage() {
  redirect("/teacher/marks");
}
