// src/app/(app)/teacher/layout.tsx
import { ReactNode } from "react";
import { requireUser } from "@/lib/auth/get-current-user";
import { assertRole } from "@/lib/auth/guards";

export default async function TeacherLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();
  assertRole(user, ["teacher"]);
  return <div className="p-4">{children}</div>;
}
