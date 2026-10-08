"use client";

import { AdminReportRunsClient } from "@/components/admin/reports/AdminReportRunsClient";
import { WorkspaceScope } from "@/components/theme/workspace-scope";

export default function AdminReportRunsPage() {
  return (
    <WorkspaceScope>
      <div className="mx-auto w-full max-w-[1400px] p-4 md:p-6">
        <AdminReportRunsClient />
      </div>
    </WorkspaceScope>
  );
}
