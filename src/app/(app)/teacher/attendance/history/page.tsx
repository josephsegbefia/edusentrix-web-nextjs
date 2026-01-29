"use client";

import * as React from "react";
import { GraduationCap, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { useTeacherClasses } from "@/hooks/teacher/useTeacherClasses";
import { useClassRoster } from "@/hooks/teacher/useClassRoster";
import { useStudentAttendanceHistory } from "@/hooks/teacher/useStudentAttendanceHistory";
import { AttendanceHistory } from "@/components/teacher/attendance/AttendanceHistory";

export default function AttendanceHistoryPage() {
  const { data: classData, isLoading: classesLoading } = useTeacherClasses();
  const classes = classData?.data.classes ?? [];
  const [classGroupId, setClassGroupId] = React.useState<string>("");
  const [studentId, setStudentId] = React.useState<string>("");
  const [typeFilter, setTypeFilter] = React.useState<"homeroom" | "period">(
    "homeroom"
  );

  const { data: rosterData, isLoading: rosterLoading } = useClassRoster(classGroupId);
  const students = rosterData?.data.students ?? [];

  const { data: historyData, isLoading: historyLoading } = useStudentAttendanceHistory(
    studentId,
    typeFilter
  );

  React.useEffect(() => {
    setStudentId("");
  }, [classGroupId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Attendance History</h1>
        <p className="text-sm text-white/60">
          Review attendance patterns by class and student.
        </p>
      </div>

      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.2em] text-white/40">
              Class
            </label>
            <PremiumSelect value={classGroupId} onValueChange={setClassGroupId}>
              <PremiumSelectTrigger icon={<Users className="h-4 w-4" />}>
                <PremiumSelectValue placeholder="Select class" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {classesLoading && (
                  <PremiumSelectItem value="loading" disabled>
                    Loading...
                  </PremiumSelectItem>
                )}
                {classes.map((cls) => (
                  <PremiumSelectItem key={cls._id} value={cls._id}>
                    {cls.name} - {cls.subjectName}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.2em] text-white/40">
              Student
            </label>
            <PremiumSelect value={studentId} onValueChange={setStudentId}>
              <PremiumSelectTrigger icon={<GraduationCap className="h-4 w-4" />}>
                <PremiumSelectValue placeholder="Select student" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {rosterLoading && (
                  <PremiumSelectItem value="loading" disabled>
                    Loading...
                  </PremiumSelectItem>
                )}
                {students.map((student) => (
                  <PremiumSelectItem key={student._id} value={student._id}>
                    {student.firstName} {student.lastName}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.2em] text-white/40">
              Type
            </label>
            <PremiumSelect value={typeFilter} onValueChange={(value) => setTypeFilter(value as "homeroom" | "period")}>
              <PremiumSelectTrigger>
                <PremiumSelectValue />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                <PremiumSelectItem value="homeroom">Homeroom</PremiumSelectItem>
                <PremiumSelectItem value="period">Period</PremiumSelectItem>
              </PremiumSelectContent>
            </PremiumSelect>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg">History</CardTitle>
        </CardHeader>
        <CardContent>
          <AttendanceHistory
            records={historyData?.data.records ?? []}
            loading={historyLoading}
          />
        </CardContent>
      </Card>
    </div>
  );
}
