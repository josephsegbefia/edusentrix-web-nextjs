"use client";

import { AdmissionsWorkspace } from "@/components/admissions/AdmissionsWorkspace";
import { WorkspaceScope } from "@/components/theme/workspace-scope";

export default function AdminAdmissionsPage() {
  return (
    <WorkspaceScope>
      <AdmissionsWorkspace isAdmin />
    </WorkspaceScope>
  );
}
