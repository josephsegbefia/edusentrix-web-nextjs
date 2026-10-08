"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const WorkspacePortalContext = React.createContext(false);

/** Light workspace canvas. Portaled menus inside it pick up the same tokens. */
export function WorkspaceScope({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <WorkspacePortalContext.Provider value={true}>
      <div className={cn("workspace workspace-page", className)}>{children}</div>
    </WorkspacePortalContext.Provider>
  );
}

/** Class for portaled content so it follows the workspace palette. */
export function useWorkspacePortalClass() {
  const active = React.useContext(WorkspacePortalContext);
  return active ? "workspace" : undefined;
}
