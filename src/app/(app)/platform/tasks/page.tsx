import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { connectToDatabase } from "@/db/connectToDatabase";
import { PlatformTasksConsole } from "@/components/platform/tasks/PlatformTasksConsole";
import { PlatformMetricCard, PlatformMetricGrid, PlatformPageHeader } from "@/components/platform/platform-page-primitives";
import { hasPlatformPermission } from "@/lib/platform/auth/has-platform-permission";
import { requirePlatformUser } from "@/lib/platform/auth/require-platform-user";
import { PlatformStaffProfile } from "@/models/PlatformStaffProfile";
import { PlatformTask } from "@/models/PlatformTask";
import { School } from "@/models/School";

export const dynamic = "force-dynamic";

export default async function PlatformTasksPage() {
  const auth = await requirePlatformUser();
  if (!auth.ok) redirect("/dashboard");
  if (!hasPlatformPermission(auth.actor, "platform.implementation.read")) redirect("/platform");

  await connectToDatabase();
  const [tasks, schools, staffProfiles, openCount, blockedCount] = await Promise.all([
    PlatformTask.find({}).sort({ status: 1, dueAt: 1, createdAt: -1 }).limit(200).lean(),
    School.find({}).select("name").sort({ name: 1 }).lean<Array<{ _id: unknown; name?: string }>>(),
    PlatformStaffProfile.find({ status: { $ne: "suspended" } }).select("userId fullName").sort({ fullName: 1 }).lean<Array<{ _id: unknown; userId: unknown; fullName: string }>>(),
    PlatformTask.countDocuments({ status: { $in: ["todo", "in_progress", "blocked", "in_review"] } }),
    PlatformTask.countDocuments({ status: "blocked" }),
  ]);

  const schoolMap = new Map(schools.map((school) => [String(school._id), school.name || "Unnamed School"]));
  const staffMap = new Map(staffProfiles.map((staff) => [String(staff.userId), staff.fullName]));

  return (
    <div className="space-y-6 p-2 md:p-4">
      <PlatformPageHeader
        eyebrow="Platform Operations"
        title="Tasks"
        description="Assign implementation, training, billing, support, and follow-up work to EduSentrix staff."
      />
      <PlatformMetricGrid>
        <PlatformMetricCard icon={ClipboardList} label="Tasks" value={tasks.length.toLocaleString()} note="Recent platform task records." tone="cyan" />
        <PlatformMetricCard icon={ClipboardList} label="Open" value={openCount.toLocaleString()} note="Work still requiring attention." tone="amber" />
        <PlatformMetricCard icon={ClipboardList} label="Blocked" value={blockedCount.toLocaleString()} note="Tasks that need escalation." tone="rose" />
        <PlatformMetricCard icon={ClipboardList} label="Assignable Staff" value={staffProfiles.length.toLocaleString()} note="Non-suspended staff profiles." tone="violet" />
      </PlatformMetricGrid>
      <PlatformTasksConsole
        tasks={tasks.map((task) => ({
          id: String(task._id),
          schoolName: task.schoolId ? schoolMap.get(String(task.schoolId)) || null : null,
          title: task.title,
          category: task.category,
          priority: task.priority,
          status: task.status,
          assignedToName: task.assignedToUserId ? staffMap.get(String(task.assignedToUserId)) || null : null,
          dueAt: task.dueAt?.toISOString() || null,
        }))}
        schoolOptions={schools.map((school) => ({ id: String(school._id), name: school.name || "Unnamed School" }))}
        staffOptions={staffProfiles.map((staff) => ({ id: String(staff._id), userId: String(staff.userId), name: staff.fullName }))}
      />
    </div>
  );
}
