import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import mongoose from "mongoose";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { connectToDatabase } from "@/db/connectToDatabase";
import { PlatformPageHeader, PlatformPill, PlatformSection } from "@/components/platform/platform-page-primitives";
import { hasPlatformPermission } from "@/lib/platform/auth/has-platform-permission";
import { requirePlatformUser } from "@/lib/platform/auth/require-platform-user";
import { School } from "@/models/School";
import { SchoolImplementationProject } from "@/models/SchoolImplementationProject";

export const dynamic = "force-dynamic";

export default async function SchoolImplementationPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformUser();
  if (!auth.ok) redirect("/dashboard");
  if (!hasPlatformPermission(auth.actor, "platform.implementation.read")) redirect("/platform");
  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) notFound();

  await connectToDatabase();
  const school = await School.findById(id).select("name").lean<{ _id: unknown; name?: string } | null>();
  if (!school) notFound();
  const project = await SchoolImplementationProject.findOneAndUpdate(
    { schoolId: new mongoose.Types.ObjectId(id) },
    { $setOnInsert: { schoolId: new mongoose.Types.ObjectId(id), status: "not_started" } },
    { upsert: true, new: true }
  ).lean();
  if (!project) notFound();

  const done = project.checklist.filter((item) => item.status === "done").length;

  return (
    <div className="space-y-6 p-2 md:p-4">
      <PlatformPageHeader
        eyebrow="Implementation Workspace"
        title={school.name || "School implementation"}
        description={`${done}/${project.checklist.length} setup items completed.`}
        actions={<Link href={`/platform/schools/${id}`} className="inline-flex items-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 hover:bg-white/10"><ArrowLeft className="mr-3 h-4 w-4" />Back to school</Link>}
      />
      <PlatformSection title="Go-live Checklist" description="Platform-side setup workspace for onboarding and readiness review.">
        <div className="grid gap-3 md:grid-cols-2">
          {project.checklist.map((item) => (
            <div key={item.key} className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-white">{item.label}</p>
                  <p className="mt-1 text-xs text-white/40">{item.key.replace(/_/g, " ")}</p>
                </div>
                <PlatformPill tone={item.status === "done" ? "emerald" : item.status === "blocked" ? "rose" : item.status === "in_progress" ? "amber" : "slate"}>
                  {item.status.replace(/_/g, " ")}
                </PlatformPill>
              </div>
            </div>
          ))}
        </div>
      </PlatformSection>
      <PlatformSection title="Readiness" description="This workspace is now the platform-side home for setup review before go-live.">
        <div className="flex items-center gap-3 text-white">
          <CheckCircle2 className="h-5 w-5 text-emerald-300" />
          <span>{done} completed items</span>
        </div>
      </PlatformSection>
    </div>
  );
}
