// src/app/(app)/admin/teachers/reports/page.tsx
"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, Users, BookOpen, BarChart3, Calendar } from "lucide-react";

// Simple bar chart component
function SimpleBarChart({
  data,
  height = 200,
}: {
  data: Array<{ label: string; value: number; color?: string }>;
  height?: number;
}) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="flex items-end justify-between gap-2" style={{ height }}>
      {data.map((item, idx) => {
        const percentage = (item.value / maxValue) * 100;
        return (
          <div key={idx} className="flex-1 flex flex-col items-center gap-1">
            <div className="relative w-full" style={{ height: height - 40 }}>
              <div
                className={`w-full rounded-t transition-all ${
                  item.color || "bg-blue-500/30"
                }`}
                style={{ height: `${percentage}%` }}
              />
            </div>
            <div className="text-xs text-muted-foreground text-center truncate w-full">
              {item.label}
            </div>
            <div className="text-xs font-semibold text-white/80">
              {item.value.toFixed(1)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function TeachersReportsPage() {
  const [activeTab, setActiveTab] = React.useState<"workload" | "assignments" | "performance" | "attendance">("workload");
  // Fetch workload report
  const { data: workloadData, isLoading: workloadLoading } = useQuery({
    queryKey: ["teachers-reports-workload"],
    queryFn: async () => {
      const res = await fetch("/api/admin/teachers/reports/workload");
      if (!res.ok) throw new Error("Failed to fetch workload report");
      return res.json();
    },
  });

  // Fetch assignments report
  const { data: assignmentsData, isLoading: assignmentsLoading } = useQuery({
    queryKey: ["teachers-reports-assignments"],
    queryFn: async () => {
      const res = await fetch("/api/admin/teachers/reports/assignments");
      if (!res.ok) throw new Error("Failed to fetch assignments report");
      return res.json();
    },
  });

  // Fetch performance report
  const { data: performanceData, isLoading: performanceLoading } = useQuery({
    queryKey: ["teachers-reports-performance"],
    queryFn: async () => {
      const res = await fetch("/api/admin/teachers/reports/performance");
      if (!res.ok) throw new Error("Failed to fetch performance report");
      return res.json();
    },
  });

  // Fetch attendance report
  const { data: attendanceData, isLoading: attendanceLoading } = useQuery({
    queryKey: ["teachers-reports-attendance"],
    queryFn: async () => {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      const res = await fetch(
        `/api/admin/teachers/reports/attendance?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
      );
      if (!res.ok) throw new Error("Failed to fetch attendance report");
      return res.json();
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="mb-2 text-3xl font-bold">Teacher Reports</h1>
        <p className="text-muted-foreground">
          Analytics and insights for teacher management
        </p>
      </div>

      <div className="space-y-4">
        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-white/10">
          <Button
            variant={activeTab === "workload" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("workload")}
          >
            Workload
          </Button>
          <Button
            variant={activeTab === "assignments" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("assignments")}
          >
            Assignments
          </Button>
          <Button
            variant={activeTab === "performance" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("performance")}
          >
            Performance
          </Button>
          <Button
            variant={activeTab === "attendance" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("attendance")}
          >
            Attendance
          </Button>
        </div>

        {/* Workload Report */}
        {activeTab === "workload" && (
          <div className="space-y-4">
          {workloadLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary/60" />
              </CardContent>
            </Card>
          ) : workloadData?.data ? (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Teachers</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {workloadData.data.summary.totalTeachers}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Avg Classes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {workloadData.data.summary.avgClasses}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Avg Students</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {workloadData.data.summary.avgStudents}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Over Capacity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-400">
                      {workloadData.data.summary.overCapacityCount}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Workload Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <SimpleBarChart
                    data={workloadData.data.teachers
                      .slice(0, 10)
                      .map((t: any) => ({
                        label: t.name.split(" ")[0] || "Unknown",
                        value: t.currentClasses,
                        color: t.isOverCapacity ? "bg-red-500/30" : "bg-blue-500/30",
                      }))}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Teachers Over Capacity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {workloadData.data.overCapacity.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No teachers over capacity</p>
                    ) : (
                      workloadData.data.overCapacity.map((t: any) => (
                        <div
                          key={t.teacherId}
                          className="flex items-center justify-between rounded-lg border border-red-500/20 bg-red-500/10 p-3"
                        >
                          <div>
                            <p className="font-medium">{t.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {t.currentClasses} classes, {t.currentStudents} students
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-red-400">
                              {t.classUtilization?.toFixed(1)}% utilization
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
          </div>
        )}

        {/* Assignments Report */}
        {activeTab === "assignments" && (
          <div className="space-y-4">
          {assignmentsLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary/60" />
              </CardContent>
            </Card>
          ) : assignmentsData?.data ? (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Assignments</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {assignmentsData.data.summary.totalAssignments}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Teachers</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {assignmentsData.data.summary.totalTeachers}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Subjects</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {assignmentsData.data.summary.totalSubjects}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Classes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {assignmentsData.data.summary.totalClasses}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Top Subjects</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {assignmentsData.data.bySubject.slice(0, 5).map((s: any) => (
                        <div
                          key={s.subjectId}
                          className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3"
                        >
                          <div>
                            <p className="font-medium">{s.subjectName}</p>
                            <p className="text-xs text-muted-foreground">
                              {s.teacherCount} teachers, {s.classCount} classes
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">{s.assignmentCount} assignments</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Top Teachers</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {assignmentsData.data.byTeacher.slice(0, 5).map((t: any) => (
                        <div
                          key={t.teacherId}
                          className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3"
                        >
                          <div>
                            <p className="font-medium">{t.teacherName}</p>
                            <p className="text-xs text-muted-foreground">
                              {t.subjectCount} subjects, {t.classCount} classes
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">{t.assignmentCount} assignments</p>
                            <p className="text-xs text-muted-foreground">
                              {t.totalWorkloadHours}h
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
          </div>
        )}

        {/* Performance Report */}
        {activeTab === "performance" && (
          <div className="space-y-4">
          {performanceLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary/60" />
              </CardContent>
            </Card>
          ) : performanceData?.data ? (
            <>
              <div className="grid gap-4 md:grid-cols-5">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Teachers</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {performanceData.data.summary.totalTeachers}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Avg Grade</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {performanceData.data.summary.avgGrade?.toFixed(1) || "N/A"}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Avg Pass Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {performanceData.data.summary.avgPassRate?.toFixed(1) || "N/A"}%
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Avg Rating</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {performanceData.data.summary.avgRating?.toFixed(1) || "N/A"}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">With Data</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {performanceData.data.summary.teachersWithData}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Performance Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {performanceData.data.teachers
                      .filter((t: any) => t.hasPerformanceData)
                      .slice(0, 10)
                      .map((t: any) => (
                        <div
                          key={t.teacherId}
                          className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3"
                        >
                          <div>
                            <p className="font-medium">{t.name}</p>
                            <p className="text-xs text-muted-foreground">{t.department || "No department"}</p>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            {t.averageRating && (
                              <div className="text-right">
                                <p className="text-muted-foreground">Rating</p>
                                <p className="font-medium">{t.averageRating.toFixed(1)}/5</p>
                              </div>
                            )}
                            {t.averageStudentGrade && (
                              <div className="text-right">
                                <p className="text-muted-foreground">Avg Grade</p>
                                <p className="font-medium">{t.averageStudentGrade.toFixed(1)}</p>
                              </div>
                            )}
                            {t.studentPassRate !== null && (
                              <div className="text-right">
                                <p className="text-muted-foreground">Pass Rate</p>
                                <p className="font-medium">{t.studentPassRate.toFixed(1)}%</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
          </div>
        )}

        {/* Attendance Report */}
        {activeTab === "attendance" && (
          <div className="space-y-4">
          {attendanceLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary/60" />
              </CardContent>
            </Card>
          ) : attendanceData?.data ? (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Teachers</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {attendanceData.data.summary.totalTeachers}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Avg Attendance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {attendanceData.data.summary.avgAttendanceRate.toFixed(1)}%
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Absent Days</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-400">
                      {attendanceData.data.summary.totalAbsentDays}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Leave Days</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {attendanceData.data.summary.totalLeaveDays}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Attendance by Teacher</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {attendanceData.data.teachers.slice(0, 15).map((t: any) => (
                      <div
                        key={t.teacherId}
                        className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3"
                      >
                        <div>
                          <p className="font-medium">{t.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {t.presentDays} present, {t.absentDays} absent, {t.lateDays} late
                          </p>
                        </div>
                        <div className="text-right">
                          <p
                            className={`text-sm font-medium ${
                              t.attendanceRate < 90 ? "text-red-400" : "text-green-400"
                            }`}
                          >
                            {t.attendanceRate.toFixed(1)}%
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t.totalDays} days
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
