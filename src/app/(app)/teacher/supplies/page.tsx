"use client";

import * as React from "react";
import { ClipboardList, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type HomeroomData = {
  homeroomClassGroupId: string | null;
  students: Array<{
    studentId: string;
    name: string;
    programs: Array<{
      programId: string;
      programName: string;
      periodLabel: string;
      requiredDone: number;
      requiredTotal: number;
      allRequiredComplete: boolean;
    }>;
  }>;
  message?: string;
};

export default function TeacherSupplyListsPage() {
  const [homeroom, setHomeroom] = React.useState<HomeroomData | null>(null);
  const [subjects, setSubjects] = React.useState<
    { id: string; name: string }[]
  >([]);
  const [subjectId, setSubjectId] = React.useState<string>("");
  const [subjectData, setSubjectData] = React.useState<{
    lineDefinitions: { id: string; programId: string; quantityExpected: number }[];
    students: Array<{
      studentId: string;
      name: string;
      lines: Array<{
        lineId: string;
        quantityExpected: number;
        quantityPaid: number;
        hasMaterial: boolean;
      }>;
    }>;
  } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [subjectLoading, setSubjectLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [hRes, sRes] = await Promise.all([
          fetch("/api/teacher/supply-programs/homeroom", { cache: "no-store" }),
          fetch("/api/teacher/supply-programs/my-subjects", { cache: "no-store" }),
        ]);
        const hJson = await hRes.json().catch(() => null);
        const sJson = await sRes.json().catch(() => null);
        if (!cancelled && hJson?.success && hJson.data) setHomeroom(hJson.data);
        if (!cancelled && sJson?.success && Array.isArray(sJson.data)) {
          setSubjects(sJson.data);
          if (sJson.data[0]) setSubjectId(sJson.data[0].id);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!subjectId) {
      setSubjectData(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setSubjectLoading(true);
      try {
        const res = await fetch(
          `/api/teacher/supply-programs/by-subject?subjectId=${encodeURIComponent(subjectId)}`,
          { cache: "no-store" }
        );
        const json = await res.json().catch(() => null);
        if (!cancelled && json?.success && json.data) setSubjectData(json.data);
      } finally {
        if (!cancelled) setSubjectLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [subjectId]);

  if (loading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center gap-2 text-white/60">
        <Loader2 className="h-6 w-6 animate-spin" />
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
          <ClipboardList className="h-7 w-7 text-brand" />
          Supply lists
        </h1>
        <p className="text-sm text-white/60 mt-1 max-w-2xl">
          Homeroom: required-item completion by class. Subject: textbook lines for your
          assigned subjects. Editing is limited to administrators and storekeepers.
        </p>
      </div>

      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-white text-base">Homeroom class</CardTitle>
          {homeroom?.message ? (
            <p className="text-sm text-amber-200/90">{homeroom.message}</p>
          ) : null}
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {!homeroom?.homeroomClassGroupId ? (
            <p className="text-sm text-white/50">No homeroom assigned.</p>
          ) : homeroom.students.length === 0 ? (
            <p className="text-sm text-white/50">No active students in this class.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-white/70">Student</TableHead>
                  <TableHead className="text-white/70">Program</TableHead>
                  <TableHead className="text-white/70">Required</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {homeroom.students.flatMap((st) =>
                  st.programs.length === 0
                    ? [
                        <TableRow key={`${st.studentId}-none`} className="border-white/10">
                          <TableCell className="text-white">{st.name}</TableCell>
                          <TableCell className="text-white/50" colSpan={2}>
                            No matching programs
                          </TableCell>
                        </TableRow>,
                      ]
                    : st.programs.map((p) => (
                        <TableRow key={`${st.studentId}-${p.programId}`} className="border-white/10">
                          <TableCell className="text-white">{st.name}</TableCell>
                          <TableCell className="text-white/80 text-sm">
                            {p.programName}
                            {p.periodLabel ? (
                              <span className="text-white/40"> · {p.periodLabel}</span>
                            ) : null}
                          </TableCell>
                          <TableCell
                            className={
                              p.allRequiredComplete ? "text-emerald-400" : "text-amber-200/90"
                            }
                          >
                            {p.requiredDone}/{p.requiredTotal}
                          </TableCell>
                        </TableRow>
                      ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/5">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <CardTitle className="text-white text-base">Subject materials</CardTitle>
          {subjects.length > 0 ? (
            <div className="w-full sm:w-72">
              <span className="text-xs text-white/50 block mb-1">Subject</span>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <p className="text-sm text-white/50">No subjects assigned to your profile.</p>
          )}
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {subjectLoading ? (
            <p className="text-white/50 text-sm">Loading…</p>
          ) : !subjectData || subjectData.lineDefinitions.length === 0 ? (
            <p className="text-white/50 text-sm">
              No supply lines linked to this subject yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-white/70">Student</TableHead>
                  {subjectData.lineDefinitions.map((ln) => (
                    <TableHead key={ln.id} className="text-white/70 text-xs max-w-[120px]">
                      Line {ln.id.slice(-4)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {subjectData.students.map((st) => (
                  <TableRow key={st.studentId} className="border-white/10">
                    <TableCell className="text-white text-sm">{st.name}</TableCell>
                    {subjectData.lineDefinitions.map((ln) => {
                      const cell = st.lines.find((x) => x.lineId === ln.id);
                      return (
                        <TableCell key={ln.id} className="text-sm">
                          {cell ? (
                            <span
                              className={
                                cell.hasMaterial ? "text-emerald-400" : "text-amber-200/90"
                              }
                            >
                              {cell.quantityPaid}/{cell.quantityExpected}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
