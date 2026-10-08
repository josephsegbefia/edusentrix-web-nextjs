"use client";

import { BackgroundTaskCenter } from "@/components/background/BackgroundTaskCenter";
import { WorkspaceScope } from "@/components/theme/workspace-scope";

export default function AdminBackgroundTasksPage() {
  return (
    <WorkspaceScope>
      <BackgroundTaskCenter backHref="/admin" />
    </WorkspaceScope>
  );
}
