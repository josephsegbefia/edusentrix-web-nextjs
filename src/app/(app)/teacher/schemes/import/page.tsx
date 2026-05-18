import Link from "next/link";
import { FileText } from "lucide-react";

export default function TeacherSchemeImportPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-3xl items-center justify-center p-4 md:p-6">
      <section className="w-full rounded-2xl border border-white/10 bg-slate-950/60 p-6 text-center text-white shadow-2xl shadow-black/25">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5">
          <FileText className="h-6 w-6 text-emerald-200" />
        </div>
        <h1 className="mt-4 text-xl font-semibold">Scheme uploads are admin-managed</h1>
        <p className="mt-2 text-sm leading-6 text-white/60">
          Teachers can review approved schemes for their assigned grades and subjects, but uploading,
          importing, editing, and approving schemes is handled by school admins.
        </p>
        <Link href="/teacher/schemes" className="mt-5 inline-flex text-sm font-medium text-sky-300 hover:text-sky-200">
          Back to schemes of learning
        </Link>
      </section>
    </div>
  );
}
