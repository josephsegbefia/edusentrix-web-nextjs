"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity as ActivityIcon } from "lucide-react";
import type { StudentDetailDTO } from "@/hooks/admin/useStudentDetail";

type Props = {
  student: StudentDetailDTO;
};

export function StudentActivityLogTab({ student }: Props) {
  const { recentActivity } = student;

  return (
    <div className="mt-4">
      <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardHeader className="relative z-10 flex items-center justify-between pb-3">
          <CardTitle className="text-sm font-semibold text-white/80">
            Activity Log
          </CardTitle>
          <Badge className="bg-white/10 text-[10px]">
            {recentActivity.length} event
            {recentActivity.length === 1 ? "" : "s"}
          </Badge>
        </CardHeader>
        <CardContent className="relative z-10 text-xs">
          {recentActivity.length === 0 ? (
            <p className="text-[11px] text-muted-foreground/85">
              No activity has been logged yet for this student. As admins and
              teachers make changes (enrolment, class assignments, payments,
              incidents), those actions will appear here.
            </p>
          ) : (
            <ul className="space-y-2">
              {recentActivity.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start gap-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2"
                >
                  <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-white/5">
                    <ActivityIcon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] text-foreground">
                        {item.description}
                      </span>
                      <span className="text-[10px] text-muted-foreground/80">
                        {new Date(item.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground/80">
                      <Badge
                        variant="outline"
                        className="border-white/20 bg-black/20 text-[9px]"
                      >
                        {item.type}
                      </Badge>
                      {item.user && (
                        <span>
                          By {item.user.firstName} {item.user.lastName}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
