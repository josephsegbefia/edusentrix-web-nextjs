"use client";

import * as React from "react";
import {
  useForm,
  useWatch,
  Controller,
  useFieldArray,
  type Control,
  type FieldErrors,
  type UseFormSetValue,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CreateTeacherSchema,
  type CreateTeacherInput,
} from "@/schemas/teacher";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/providers/auth-provider";
import { ImageUploader } from "@/components/upload/ImageUploader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LeoIcon } from "@/components/icons/LeoIcon";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Search,
  Info,
  Plus,
  Trash2,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { formatClassGroupLabel } from "@/lib/utils/formatClassGroupLabel";

type Props = {
  onClose: () => void;
  onSubmit: (payload: CreateTeacherInput) => Promise<void>;
  isLoading?: boolean;
};

type ClassGroupLite = {
  id?: string;
  _id?: string;
  name: string;
  label?: string;
  gradeName?: string | null;
  gradeLabel?: string;
};

type GradeOption = { id: string; name: string };

function cgId(cg: ClassGroupLite): string {
  return String(cg.id || cg._id || "");
}

function FieldInfo({ text, label }: { text: string; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="shrink-0 rounded p-0.5 text-white/35 outline-none hover:bg-white/10 hover:text-white/75 focus-visible:ring-1 focus-visible:ring-brand"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <Info className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="right"
        align="center"
        className="z-400 max-w-xs border border-white/15 bg-zinc-950 px-3 py-2 text-xs leading-relaxed text-white/90 shadow-lg"
      >
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

const TOTAL_STEPS = 5;

type LeoSuggestionRow = {
  subjectId: string;
  classGroupId: string;
  gradeId: string;
  label?: string;
};

type LeoPreviewState = {
  confirmationText: string;
  leoSummary: string | null;
  suggestions: LeoSuggestionRow[];
  unmatched: string[];
};

type ReviewTeachingConflict = {
  key: string;
  subjectId: string;
  classGroupId: string;
  subjectName: string;
  classLabel: string;
  teacherNames: string[];
};

type ReviewHomeroomConflict = {
  classGroupId: string;
  classLabel: string;
  teacherName: string;
};

function LeoCallout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-violet-500/20 bg-violet-500/[0.07] p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-400/25 bg-violet-500/15">
        <LeoIcon className="h-5 w-5 text-violet-200" />
      </div>
      <div className="min-w-0 flex-1 text-sm text-white/85">{children}</div>
    </div>
  );
}

function getInitials(firstName?: string, lastName?: string): string {
  const first = firstName?.charAt(0)?.toUpperCase() || "";
  const last = lastName?.charAt(0)?.toUpperCase() || "";
  return first + last || "?";
}

function TeachingAssignmentRow({
  index,
  control,
  setValue,
  errors,
  grades,
  isOnlyRow,
  onRemove,
}: {
  index: number;
  control: Control<CreateTeacherInput>;
  setValue: UseFormSetValue<CreateTeacherInput>;
  errors: FieldErrors<CreateTeacherInput>;
  grades: GradeOption[];
  isOnlyRow: boolean;
  onRemove: () => void;
}) {
  const gradeId = useWatch({
    control,
    name: `teachingAssignments.${index}.gradeId`,
  });
  const subjectId = useWatch({
    control,
    name: `teachingAssignments.${index}.subjectId`,
  });

  const [qSubj, setQSubj] = React.useState("");
  const dqSubj = useDebouncedValue(qSubj, 320);
  const [subjectResults, setSubjectResults] = React.useState<
    { id: string; name: string }[]
  >([]);
  const [subjectsLoading, setSubjectsLoading] = React.useState(false);
  const [subjectDisplay, setSubjectDisplay] = React.useState("");

  const [classOpts, setClassOpts] = React.useState<ClassGroupLite[]>([]);
  const [classLoading, setClassLoading] = React.useState(false);

  const rowErr = errors.teachingAssignments?.[index];

  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (dqSubj.trim().length < 1) {
        setSubjectResults([]);
        return;
      }
      setSubjectsLoading(true);
      try {
        const res = await fetch(
          `/api/admin/subjects/search?q=${encodeURIComponent(dqSubj)}&limit=12`,
          { cache: "no-store" }
        );
        const json = await res.json();
        if (alive && json?.success) setSubjectResults(json.data || []);
      } catch {
      } finally {
        if (alive) setSubjectsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [dqSubj]);

  React.useEffect(() => {
    let alive = true;
    if (!gradeId) {
      setClassOpts([]);
      setValue(`teachingAssignments.${index}.classGroupId`, "", {
        shouldValidate: true,
      });
      return;
    }
    setClassLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/admin/class-groups/search?gradeId=${encodeURIComponent(
            gradeId
          )}&limit=40`,
          { cache: "no-store" }
        );
        const json = await res.json();
        if (alive && json?.success) setClassOpts(json.data || []);
      } catch {
        if (alive) setClassOpts([]);
      } finally {
        if (alive) setClassLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [gradeId, index, setValue]);

  React.useEffect(() => {
    if (!subjectId) {
      setSubjectDisplay("");
      return;
    }
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/admin/subjects/${subjectId}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (alive && json?.success && json.data?.name) {
          setSubjectDisplay(String(json.data.name));
        }
      } catch {
        if (alive) setSubjectDisplay("");
      }
    })();
    return () => {
      alive = false;
    };
  }, [subjectId]);

  return (
    <div className="rounded-xl border border-white/10 bg-white/3 p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-[0.15em] text-white/50">
          Class {index + 1}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-rose-300 hover:text-rose-200 hover:bg-rose-500/10"
          onClick={onRemove}
          title={isOnlyRow ? "Clear row" : "Remove row"}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-2 md:col-span-1">
          <div className="flex items-center gap-1.5">
            <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
              Subject
            </Label>
            <FieldInfo
              label="About subject"
              text="The subject this teacher teaches in the class you select. You can add more rows for other subjects or other class groups."
            />
          </div>
          {subjectDisplay && subjectId && (
            <div className="text-xs text-brand font-medium truncate">
              Selected: {subjectDisplay}
            </div>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <Input
              type="text"
              placeholder="Search subjects…"
              value={qSubj}
              onChange={(e) => setQSubj(e.target.value)}
              className="pl-10 border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
            />
          </div>
          <div className="max-h-36 overflow-y-auto rounded-lg border border-white/10 bg-white/5 p-2 space-y-1">
            {subjectsLoading ? (
              <div className="text-xs text-white/45 py-2 text-center">
                Loading…
              </div>
            ) : subjectResults.length === 0 ? (
              <div className="text-xs text-white/45 py-2 text-center">
                {qSubj.trim() ? "No match" : "Type to search"}
              </div>
            ) : (
              subjectResults.map((s) => {
                const sel = subjectId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setValue(
                        `teachingAssignments.${index}.subjectId`,
                        s.id,
                        { shouldValidate: true }
                      );
                      setSubjectDisplay(s.name);
                    }}
                    className={`w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                      sel
                        ? "bg-brand/25 text-brand font-medium"
                        : "text-white/80 hover:bg-white/10"
                    }`}
                  >
                    {s.name}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
              Grade
            </Label>
            <FieldInfo
              label="About grade"
              text="Grade level for the class group. After you choose a grade, we list class streams (e.g. A, B) for that level."
            />
          </div>
          <Controller
            name={`teachingAssignments.${index}.gradeId`}
            control={control}
            render={({ field }) => (
              <select
                {...field}
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-brand focus:ring-1 focus:ring-brand"
              >
                <option value="">Select grade…</option>
                {grades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            )}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
              Class group
            </Label>
            <FieldInfo
              label="About class group"
              text="The stream or section (often a letter or name) within the grade. Assignments are saved for the current academic term."
            />
          </div>
          <Controller
            name={`teachingAssignments.${index}.classGroupId`}
            control={control}
            render={({ field }) => (
              <select
                {...field}
                disabled={!gradeId || classLoading}
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-brand focus:ring-1 focus:ring-brand disabled:opacity-50"
              >
                <option value="">
                  {!gradeId
                    ? "Choose a grade first"
                    : classLoading
                      ? "Loading…"
                      : "Select class…"}
                </option>
                {classOpts.map((cg) => {
                  const id = cgId(cg);
                  const lab =
                    cg.label ||
                    formatClassGroupLabel(
                      cg.gradeName ?? cg.gradeLabel,
                      cg.name
                    );
                  return (
                    <option key={id} value={id}>
                      {lab}
                    </option>
                  );
                })}
              </select>
            )}
          />
        </div>
      </div>

      {rowErr?.classGroupId?.message && (
        <div className="text-xs text-rose-300">{rowErr.classGroupId.message}</div>
      )}
      {rowErr?.subjectId?.message && (
        <div className="text-xs text-rose-300">{rowErr.subjectId.message}</div>
      )}
    </div>
  );
}

export default function CreateTeacherModal({
  onClose,
  onSubmit,
  isLoading,
}: Props) {
  const busy = useBusyToast();
  const { success: toastSuccess, error: toastError } = useToast();
  const { me } = useAuth();
  const [currentStep, setCurrentStep] = React.useState(1);

  const {
    register,
    handleSubmit,
    control,
    trigger,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<CreateTeacherInput>({
    resolver: zodResolver(CreateTeacherSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      photoUrl: undefined,
      subjectIds: [],
      teachingAssignments: [
        { subjectId: "", classGroupId: "", gradeId: "" },
      ],
      homeroomClassGroupId: undefined,
      status: "active",
      teachingAssignmentResolution: "add_alongside",
    },
    mode: "onBlur",
    shouldUnregister: false,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "teachingAssignments",
  });

  const firstName = useWatch({ control, name: "firstName" });
  const lastName = useWatch({ control, name: "lastName" });
  const photoUrl = useWatch({ control, name: "photoUrl" });

  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === TOTAL_STEPS;

  const [qClass, setQClass] = React.useState("");
  const dqClass = useDebouncedValue(qClass, 350);
  const [classResults, setClassResults] = React.useState<ClassGroupLite[]>([]);
  const [classLoading, setClassLoading] = React.useState(false);

  const [grades, setGrades] = React.useState<GradeOption[]>([]);
  const [leoHint, setLeoHint] = React.useState("");
  const [leoLoading, setLeoLoading] = React.useState(false);
  const [leoPreview, setLeoPreview] = React.useState<LeoPreviewState | null>(
    null
  );

  const watchedAssignments = useWatch({ control, name: "teachingAssignments" });
  const watchedHomeroom = useWatch({ control, name: "homeroomClassGroupId" });
  const watchedEmail = useWatch({ control, name: "email" });
  const watchedPhone = useWatch({ control, name: "phone" });
  const watchedStatus = useWatch({ control, name: "status" });
  const watchedAssignmentResolution = useWatch({
    control,
    name: "teachingAssignmentResolution",
  });

  const [reviewLines, setReviewLines] = React.useState<
    { subject: string; klass: string }[]
  >([]);
  const [reviewHomeroomLabel, setReviewHomeroomLabel] = React.useState<
    string | null
  >(null);
  const [reviewLoading, setReviewLoading] = React.useState(false);
  const [reviewTeachingConflicts, setReviewTeachingConflicts] =
    React.useState<ReviewTeachingConflict[]>([]);
  const [reviewHomeroomConflict, setReviewHomeroomConflict] =
    React.useState<ReviewHomeroomConflict | null>(null);
  const [reviewConflictLoading, setReviewConflictLoading] =
    React.useState(false);
  const [reviewConflictError, setReviewConflictError] = React.useState<
    string | null
  >(null);

  React.useEffect(() => {
    if (currentStep !== 5) return;
    let cancelled = false;
    (async () => {
      setReviewLoading(true);
      const rows = (getValues("teachingAssignments") || []).filter(
        (r) => String(r.subjectId || "").trim() && String(r.classGroupId || "").trim()
      );
      const lines: { subject: string; klass: string }[] = [];
      for (const r of rows) {
        let subjectLabel = String(r.subjectId);
        let classLabel = String(r.classGroupId);
        try {
          const sRes = await fetch(`/api/admin/subjects/${r.subjectId}`, {
            cache: "no-store",
          });
          const sJson = await sRes.json();
          if (sJson?.success && sJson.data?.name) {
            subjectLabel = String(sJson.data.name);
          }
        } catch {
          /* keep id */
        }
        try {
          const gradeIds = r.gradeId
            ? [r.gradeId]
            : grades.map((g) => g.id);
          let foundLabel: string | null = null;
          for (const gid of gradeIds) {
            const cgRes = await fetch(
              `/api/admin/class-groups/search?gradeId=${encodeURIComponent(
                gid
              )}&limit=50`,
              { cache: "no-store" }
            );
            const cgJson = await cgRes.json();
            if (cgJson?.success) {
              const hit = (cgJson.data || []).find(
                (cg: { id: string }) => String(cg.id) === String(r.classGroupId)
              );
              if (hit?.label) {
                foundLabel = String(hit.label);
                break;
              }
              if (hit?.name) {
                foundLabel = String(hit.name);
                break;
              }
            }
          }
          if (foundLabel) classLabel = foundLabel;
        } catch {
          /* keep id */
        }
        lines.push({ subject: subjectLabel, klass: classLabel });
      }

      let homeroomLabel: string | null = null;
      const hid = watchedHomeroom;
      if (hid) {
        try {
          for (const g of grades) {
            const cgRes = await fetch(
              `/api/admin/class-groups/search?gradeId=${encodeURIComponent(
                g.id
              )}&limit=50`,
              { cache: "no-store" }
            );
            const cgJson = await cgRes.json();
            if (cgJson?.success) {
              const hit = (cgJson.data || []).find(
                (cg: { id: string }) => String(cg.id) === String(hid)
              );
              if (hit?.label) {
                homeroomLabel = String(hit.label);
                break;
              }
              if (hit?.name) {
                homeroomLabel = String(hit.name);
                break;
              }
            }
          }
        } catch {
          homeroomLabel = "Homeroom class selected";
        }
        if (!homeroomLabel) homeroomLabel = "Homeroom class selected";
      }

      if (!cancelled) {
        setReviewLines(lines);
        setReviewHomeroomLabel(homeroomLabel);
      }
      if (!cancelled) setReviewLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    currentStep,
    getValues,
    grades,
    watchedAssignments,
    watchedHomeroom,
  ]);

  React.useEffect(() => {
    if (currentStep !== 5) return;

    const assignmentRows = Array.from(
      new Map(
        (watchedAssignments || [])
          .filter(
            (row) =>
              String(row?.subjectId || "").trim() &&
              String(row?.classGroupId || "").trim()
          )
          .map((row) => [
            `${String(row.subjectId).trim()}|${String(row.classGroupId).trim()}`,
            {
              subjectId: String(row.subjectId).trim(),
              classGroupId: String(row.classGroupId).trim(),
            },
          ])
      ).values()
    );

    const classGroupIds = Array.from(
      new Set(
        [
          ...assignmentRows.map((row) => row.classGroupId),
          String(watchedHomeroom || "").trim(),
        ].filter(Boolean)
      )
    );

    if (classGroupIds.length === 0) {
      setReviewTeachingConflicts([]);
      setReviewHomeroomConflict(null);
      setReviewConflictError(null);
      setReviewConflictLoading(false);
      return;
    }

    let cancelled = false;

    const buildTeacherName = (teacher: {
      fullName?: string | null;
      firstName?: string | null;
      lastName?: string | null;
    }) =>
      teacher.fullName?.trim() ||
      `${teacher.firstName || ""} ${teacher.lastName || ""}`.trim() ||
      "Teacher";

    (async () => {
      setReviewConflictLoading(true);
      setReviewConflictError(null);

      try {
        const classPayloads = await Promise.all(
          classGroupIds.map(async (classGroupId) => {
            const [classRes, subjectTeachersRes] = await Promise.all([
              fetch(`/api/admin/classes/${classGroupId}`, {
                cache: "no-store",
              }),
              fetch(`/api/admin/classes/${classGroupId}/subject-teachers`, {
                cache: "no-store",
              }),
            ]);

            const classJson = await classRes
              .json()
              .catch(() => ({ success: false }));
            const subjectTeachersJson = await subjectTeachersRes
              .json()
              .catch(() => ({ success: false }));

            if (!classRes.ok || !classJson?.success) {
              throw new Error(
                classJson?.error || "Failed to load class details for review."
              );
            }

            if (!subjectTeachersRes.ok || !subjectTeachersJson?.success) {
              throw new Error(
                subjectTeachersJson?.error ||
                  "Failed to check current teaching assignments."
              );
            }

            return {
              classGroupId,
              classData: classJson.data as {
                fullLabel?: string;
                name?: string;
                homeroomTeacher?: {
                  fullName?: string | null;
                  firstName?: string | null;
                  lastName?: string | null;
                } | null;
              },
              subjectTeacherData: (subjectTeachersJson.data ||
                []) as Array<{
                subjectId: string;
                subjectName?: string;
                teachers?: Array<{
                  fullName?: string | null;
                  firstName?: string | null;
                  lastName?: string | null;
                }>;
              }>,
            };
          })
        );

        const classMetaById = new Map<
          string,
          { classLabel: string; homeroomTeacherName: string | null }
        >();
        const subjectTeacherBySlot = new Map<
          string,
          { subjectName: string; teacherNames: string[] }
        >();

        for (const payload of classPayloads) {
          classMetaById.set(payload.classGroupId, {
            classLabel:
              payload.classData.fullLabel?.trim() ||
              payload.classData.name?.trim() ||
              payload.classGroupId,
            homeroomTeacherName: payload.classData.homeroomTeacher
              ? buildTeacherName(payload.classData.homeroomTeacher)
              : null,
          });

          for (const subjectRow of payload.subjectTeacherData) {
            subjectTeacherBySlot.set(
              `${payload.classGroupId}|${String(subjectRow.subjectId)}`,
              {
                subjectName:
                  String(subjectRow.subjectName || "").trim() ||
                  String(subjectRow.subjectId),
                teacherNames: Array.from(
                  new Set(
                    (subjectRow.teachers || [])
                      .map(buildTeacherName)
                      .filter(Boolean)
                  )
                ),
              }
            );
          }
        }

        const nextTeachingConflicts: ReviewTeachingConflict[] = assignmentRows
          .map((row) => {
            const slot = subjectTeacherBySlot.get(
              `${row.classGroupId}|${row.subjectId}`
            );
            if (!slot || slot.teacherNames.length === 0) return null;
            return {
              key: `${row.subjectId}|${row.classGroupId}`,
              subjectId: row.subjectId,
              classGroupId: row.classGroupId,
              subjectName: slot.subjectName,
              classLabel:
                classMetaById.get(row.classGroupId)?.classLabel ||
                row.classGroupId,
              teacherNames: slot.teacherNames,
            };
          })
          .filter((item): item is ReviewTeachingConflict => item !== null);

        const homeroomId = String(watchedHomeroom || "").trim();
        const homeroomMeta = homeroomId
          ? classMetaById.get(homeroomId) || null
          : null;
        const nextHomeroomConflict =
          homeroomId && homeroomMeta?.homeroomTeacherName
            ? {
                classGroupId: homeroomId,
                classLabel: homeroomMeta.classLabel,
                teacherName: homeroomMeta.homeroomTeacherName,
              }
            : null;

        if (!cancelled) {
          setReviewTeachingConflicts(nextTeachingConflicts);
          setReviewHomeroomConflict(nextHomeroomConflict);
          setReviewConflictError(null);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setReviewTeachingConflicts([]);
          setReviewHomeroomConflict(null);
          setReviewConflictError(
            e instanceof Error
              ? e.message
              : "Could not check current teaching and homeroom conflicts."
          );
        }
      } finally {
        if (!cancelled) setReviewConflictLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentStep, watchedAssignments, watchedHomeroom]);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (!me?.schoolId) return;
      try {
        const res = await fetch("/api/admin/grades?active=1", {
          cache: "no-store",
        });
        const json = await res.json();
        if (alive && Array.isArray(json?.data)) {
          setGrades(
            json.data.map((g: { id: string; name: string }) => ({
              id: g.id,
              name: g.name,
            }))
          );
        }
      } catch {
      }
    })();
    return () => {
      alive = false;
    };
  }, [me?.schoolId]);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (dqClass.trim().length < 1) {
        setClassResults([]);
        return;
      }
      setClassLoading(true);
      try {
        const res = await fetch(
          `/api/admin/class-groups/search?q=${encodeURIComponent(
            dqClass
          )}&limit=12`,
          { cache: "no-store" }
        );
        const json = await res.json();
        if (alive && json?.success) setClassResults(json.data || []);
      } catch {
      } finally {
        if (alive) setClassLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [dqClass]);

  async function runLeoSuggest() {
    const hint = leoHint.trim();
    if (hint.length < 3) {
      toastError("Add a few words for Leo", {
        description: "e.g. “Teaches Math in P4 A and P4 B, Science in JHS1 A”.",
      });
      return;
    }
    setLeoLoading(true);
    setLeoPreview(null);
    try {
      const res = await fetch("/api/admin/teachers/leo-suggest-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hint }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Could not get suggestions");
      }
      if (json.fallback && !(json.suggestions || []).length) {
        toastError("Leo can’t suggest rows yet", {
          description:
            json.leoSummary ||
            "Configure OpenAI, or add grades, classes, and subjects first.",
        });
        return;
      }

      const suggestions: LeoSuggestionRow[] = Array.isArray(json.suggestions)
        ? json.suggestions
        : [];
      const unmatched: string[] = Array.isArray(json.unmatched)
        ? json.unmatched
        : [];
      const confirmationText = String(
        json.confirmationText ||
          json.leoSummary ||
          "Review the assignments below, then accept or dismiss."
      );

      setLeoPreview({
        confirmationText,
        leoSummary: json.leoSummary ? String(json.leoSummary) : null,
        suggestions,
        unmatched,
      });

      if (suggestions.length === 0) {
        toastError("No classes matched", {
          description:
            unmatched.length > 0
              ? "Check the note below or spell grade/stream names like in your directory."
              : "Try naming subjects and grades the same way they appear under Admin.",
        });
      }
    } catch (e: unknown) {
      toastError("Leo could not help right now", {
        description: e instanceof Error ? e.message : "Try again later.",
      });
    } finally {
      setLeoLoading(false);
    }
  }

  function applyLeoPreview() {
    if (!leoPreview?.suggestions.length) return;
    for (const s of leoPreview.suggestions) {
      append({
        subjectId: s.subjectId,
        classGroupId: s.classGroupId,
        gradeId: s.gradeId || "",
      });
    }
    toastSuccess("Teaching rows added", {
      description: "You can still edit each row before creating the teacher.",
    });
    setLeoPreview(null);
  }

  async function handleNext() {
    if (currentStep === 1) {
      const ok = await trigger(["firstName", "lastName", "email", "phone"]);
      if (!ok) return;
    }
    if (currentStep === 2) {
      const ok = await trigger(["photoUrl", "status"]);
      if (!ok) return;
    }
    if (currentStep === 3) {
      const ok = await trigger();
      if (!ok) return;
    }
    setCurrentStep((s) => Math.min(TOTAL_STEPS, s + 1));
  }

  function handlePrevious() {
    setCurrentStep((s) => Math.max(1, s - 1));
  }

  function handleRemovePhoto() {
    setValue("photoUrl", undefined, { shouldValidate: true });
  }

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLastStep) {
      handleSubmit(internalSubmit)(e);
    } else {
      void handleNext();
    }
  };

  async function internalSubmit(values: CreateTeacherInput) {
    const teachingAssignments = (values.teachingAssignments || [])
      .filter((r) => r.subjectId && r.classGroupId)
      .map(({ subjectId, classGroupId }) => ({ subjectId, classGroupId }));

    const payload: CreateTeacherInput = {
      ...values,
      subjectIds: (values.subjectIds || []).filter(Boolean),
      teachingAssignments,
      homeroomClassGroupId: values.homeroomClassGroupId || undefined,
      status: values.status ?? "active",
      teachingAssignmentResolution:
        values.teachingAssignmentResolution ?? "add_alongside",
    };
    try {
      await onSubmit(payload);
      toastSuccess("Teacher created", {
        description:
          "We've sent an invite email so they can set a password and onboard.",
      });
      onClose();
    } catch (e: unknown) {
      const errorMessage =
        e instanceof Error ? e.message : "Please check inputs and try again.";
      toastError("Could not add teacher", {
        description: errorMessage,
      });
    }
  }

  if (!me?.schoolId) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center">
        <div className="text-sm text-white/60">School ID not available</div>
      </div>
    );
  }

  const initials = getInitials(firstName, lastName);

  return (
    <TooltipProvider delayDuration={200}>
      <form
        onSubmit={handleFormSubmit}
        onKeyDown={(e) => {
          if (!isLastStep && e.key === "Enter") {
            e.preventDefault();
            void handleNext();
          }
        }}
        className="space-y-8"
      >
        <div className="flex items-center justify-between pb-6">
          <div className="text-sm text-white/70">
            Step <span className="font-semibold">{currentStep}</span> of{" "}
            {TOTAL_STEPS}
          </div>
          <div className="flex gap-1 flex-wrap justify-end max-w-[min(100%,280px)]">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((i) => (
              <span
                key={i}
                className={`h-1.5 w-8 rounded-full transition-all ${
                  i <= currentStep ? "bg-brand" : "bg-white/20"
                }`}
              />
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {currentStep === 1 && (
              <section className="space-y-4">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                  Personal Details
                </h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label
                      htmlFor="firstName"
                      className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                    >
                      First name *
                    </Label>
                    <Input
                      id="firstName"
                      {...register("firstName")}
                      placeholder="John"
                      className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                    />
                    {errors.firstName && (
                      <div className="text-xs text-rose-300">
                        {errors.firstName.message}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="lastName"
                      className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                    >
                      Last name *
                    </Label>
                    <Input
                      id="lastName"
                      {...register("lastName")}
                      placeholder="Doe"
                      className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                    />
                    {errors.lastName && (
                      <div className="text-xs text-rose-300">
                        {errors.lastName.message}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label
                      htmlFor="email"
                      className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                    >
                      Email *
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      {...register("email")}
                      placeholder="john.doe@example.com"
                      className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                    />
                    {errors.email && (
                      <div className="text-xs text-rose-300">
                        {errors.email.message}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="phone"
                      className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                    >
                      Phone
                    </Label>
                    <Input
                      id="phone"
                      {...register("phone")}
                      placeholder="+233 XX XXX XXXX"
                      className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                    />
                  </div>
                </div>
              </section>
            )}

            {currentStep === 2 && (
              <section className="space-y-6">
                <div className="space-y-4">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                    Teacher Photo
                  </h2>
                  <div className="flex flex-col items-center gap-4">
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.3 }}
                      className="relative"
                    >
                      <div className="relative w-36 h-36 rounded-full border-4 border-white/10 bg-white/5 overflow-hidden shadow-lg">
                        <AnimatePresence mode="wait">
                          {photoUrl ? (
                            <motion.div
                              key="photo"
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.9 }}
                              transition={{ duration: 0.2 }}
                              className="relative w-full h-full"
                            >
                              <Image
                                src={photoUrl}
                                alt="Teacher photo"
                                fill
                                className="object-cover rounded-full"
                                sizes="144px"
                                priority
                              />
                            </motion.div>
                          ) : (
                            <motion.div
                              key="initials"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="w-full h-full flex items-center justify-center bg-linear-to-br from-brand/20 to-brand/10"
                            >
                              <span className="text-4xl font-bold text-brand">
                                {initials}
                              </span>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      {photoUrl && (
                        <motion.button
                          type="button"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          onClick={handleRemovePhoto}
                          className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-rose-500 hover:bg-rose-600 border-2 border-white/10 flex items-center justify-center text-white shadow-lg transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </motion.button>
                      )}
                    </motion.div>
                    <div className="w-full">
                      <ImageUploader
                        schoolId={me.schoolId}
                        subjectRole="teachers"
                        onUploaded={(payload) => {
                          setValue("photoUrl", payload.url, {
                            shouldValidate: true,
                          });
                        }}
                        onError={(msg) => {
                          busy.error(msg);
                        }}
                        className="w-full"
                        label=""
                      />
                    </div>
                  </div>
                  {errors.photoUrl && (
                    <div className="text-xs text-rose-300 text-center">
                      {errors.photoUrl.message}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                    Status
                  </h2>
                  <Controller
                    name="status"
                    control={control}
                    render={({ field }) => (
                      <div className="grid grid-cols-2 gap-3">
                        {(["active", "inactive"] as const).map((s) => (
                          <motion.label
                            key={s}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-all cursor-pointer ${
                              field.value === s
                                ? "border-brand bg-brand/20 text-brand"
                                : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80"
                            }`}
                          >
                            <input
                              type="radio"
                              value={s}
                              checked={field.value === s}
                              onChange={() => field.onChange(s)}
                              className="sr-only"
                            />
                            <span className="capitalize">{s}</span>
                          </motion.label>
                        ))}
                      </div>
                    )}
                  />
                </div>
              </section>
            )}

            {currentStep === 3 && (
              <section className="space-y-6">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                    Teaching load
                  </h2>
                  <FieldInfo
                    label="About teaching load"
                    text="Each row is one subject in one class group. Add several rows for multiple subjects, grades, or streams. Assignments are saved for the current academic term when you finish the wizard."
                  />
                </div>

                <LeoCallout>
                  <p className="font-medium text-violet-100 mb-2">
                    Hi, I&apos;m{" "}
                    <span className="font-semibold text-violet-200">Leo</span>.
                  </p>
                  <p className="text-white/80 text-sm mb-3">
                    Describe what they teach in plain language (e.g. &quot;Math
                    in JHS 2A and B, Science in JHS 1&quot;). I&apos;ll show a
                    short plan you can confirm before any rows are added.
                  </p>
                  <Textarea
                    value={leoHint}
                    onChange={(e) => setLeoHint(e.target.value)}
                    placeholder='Example: "Mathematics in JHS 2A and B; Science in JHS 1"'
                    className="min-h-[88px] border-white/10 bg-white/5 text-white placeholder:text-white/35 mb-3"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={leoLoading}
                    onClick={() => void runLeoSuggest()}
                    className="gap-2 border-violet-400/30 bg-violet-500/10 text-violet-100 hover:bg-violet-500/20"
                  >
                    <Sparkles className="h-4 w-4" />
                    {leoLoading ? "Leo is thinking…" : "Ask Leo"}
                  </Button>
                </LeoCallout>

                {leoPreview && (
                  <div className="rounded-xl border border-violet-400/30 bg-violet-500/12 p-4 space-y-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-200/90">
                      Confirm with Leo
                    </div>
                    <p className="text-sm text-white/90 leading-relaxed">
                      {leoPreview.confirmationText}
                    </p>
                    {leoPreview.leoSummary &&
                      leoPreview.leoSummary !== leoPreview.confirmationText && (
                        <p className="text-xs text-white/55">
                          {leoPreview.leoSummary}
                        </p>
                      )}
                    {leoPreview.suggestions.length > 0 && (
                      <ul className="text-xs text-white/75 space-y-1 border-t border-white/10 pt-3">
                        {leoPreview.suggestions.map((s, i) => (
                          <li key={`${s.subjectId}-${s.classGroupId}-${i}`}>
                            {s.label || `${s.subjectId} · ${s.classGroupId}`}
                          </li>
                        ))}
                      </ul>
                    )}
                    {leoPreview.unmatched.length > 0 && (
                      <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/95">
                        Couldn&apos;t match: {leoPreview.unmatched.join("; ")}.
                        Add those manually or adjust your note and try again.
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        type="button"
                        disabled={leoPreview.suggestions.length < 1}
                        onClick={applyLeoPreview}
                        className="gap-2 bg-brand text-black hover:opacity-90"
                      >
                        <Check className="h-4 w-4" />
                        Accept and add rows
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setLeoPreview(null)}
                        className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {fields.map((field, index) => (
                    <TeachingAssignmentRow
                      key={field.id}
                      index={index}
                      control={control}
                      setValue={setValue}
                      errors={errors}
                      grades={grades}
                      isOnlyRow={fields.length === 1}
                      onRemove={() => {
                        if (fields.length === 1) {
                          setValue(
                            `teachingAssignments.0.subjectId`,
                            "",
                            { shouldValidate: true }
                          );
                          setValue(
                            `teachingAssignments.0.classGroupId`,
                            "",
                            { shouldValidate: true }
                          );
                          setValue(
                            `teachingAssignments.0.gradeId`,
                            "",
                            { shouldValidate: true }
                          );
                          return;
                        }
                        remove(index);
                      }}
                    />
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2 border-dashed border-white/20 text-white/80 hover:bg-white/5"
                    onClick={() =>
                      append({
                        subjectId: "",
                        classGroupId: "",
                        gradeId: "",
                      })
                    }
                  >
                    <Plus className="h-4 w-4" />
                    Add another subject / class group
                  </Button>
                </div>

                {typeof errors.teachingAssignments === "object" &&
                  errors.teachingAssignments !== null &&
                  "message" in errors.teachingAssignments &&
                  typeof (errors.teachingAssignments as { message?: string })
                    .message === "string" && (
                    <div className="text-xs text-rose-300">
                      {(errors.teachingAssignments as { message: string }).message}
                    </div>
                  )}
              </section>
            )}

            {currentStep === 4 && (
              <section className="space-y-6">
                <LeoCallout>
                  <p className="text-sm text-white/85">
                    <span className="font-semibold text-violet-200">Leo</span>{" "}
                    helped on the teaching step. Homeroom is optional—pick the
                    class this teacher leads as a form teacher, or skip.
                  </p>
                </LeoCallout>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                      Homeroom (optional)
                    </h2>
                    <FieldInfo
                      label="About homeroom"
                      text="Homeroom is separate from subject teaching: it’s the class this teacher leads as a form teacher, if applicable."
                    />
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                    <Input
                      type="text"
                      placeholder="Search class groups..."
                      value={qClass}
                      onChange={(e) => setQClass(e.target.value)}
                      className="pl-10 border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                    />
                  </div>

                  <Controller
                    name="homeroomClassGroupId"
                    control={control}
                    render={({ field }) => (
                      <div className="space-y-2">
                        <div className="max-h-72 overflow-y-auto rounded-lg border border-white/10 bg-white/5 p-4">
                          {classLoading ? (
                            <div className="text-xs text-white/50 py-4 text-center">
                              Loading class groups…
                            </div>
                          ) : classResults.length === 0 ? (
                            <div className="text-xs text-white/50 py-4 text-center">
                              {qClass.trim()
                                ? "No class groups found matching your search"
                                : "Search to pick a homeroom class group."}
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                              <motion.button
                                type="button"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => field.onChange(undefined)}
                                className={`relative rounded-lg border-2 px-4 py-3 text-left transition-all ${
                                  !field.value
                                    ? "border-brand bg-brand/10 text-brand"
                                    : "border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:bg-white/10"
                                }`}
                              >
                                {!field.value && (
                                  <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-brand text-black flex items-center justify-center"
                                  >
                                    <Check className="h-4 w-4" />
                                  </motion.div>
                                )}
                                <div className="font-semibold">No homeroom</div>
                                <div className="text-xs text-white/60">
                                  Skip for now
                                </div>
                              </motion.button>

                              {classResults.map((cg) => {
                                const id = cgId(cg);
                                const selected = field.value === id;
                                const sub =
                                  cg.label ||
                                  cg.gradeLabel ||
                                  cg.gradeName ||
                                  "";
                                return (
                                  <motion.button
                                    key={id}
                                    type="button"
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => field.onChange(id)}
                                    className={`relative rounded-lg border-2 px-4 py-3 text-left transition-all ${
                                      selected
                                        ? "border-brand bg-brand/20 text-brand shadow-lg shadow-brand/20"
                                        : "border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:bg-white/10"
                                    }`}
                                  >
                                    {selected && (
                                      <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-brand text-black flex items-center justify-center"
                                      >
                                        <Check className="h-4 w-4" />
                                      </motion.div>
                                    )}
                                    <div className="font-semibold">
                                      {cg.name}
                                    </div>
                                    {sub ? (
                                      <div className="text-xs text-white/60">
                                        {sub}
                                      </div>
                                    ) : null}
                                  </motion.button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  />
                </div>
              </section>
            )}

            {currentStep === 5 && (
              <section className="space-y-6">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                  Review &amp; invite
                </h2>
                <p className="text-sm text-white/70">
                  Nothing is saved until you create the teacher. We&apos;ll send a
                  secure email invite so they can set a password and sign in.
                </p>

                {reviewConflictLoading ? (
                  <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/65">
                    Checking existing teaching and homeroom assignments…
                  </div>
                ) : null}

                {reviewConflictError ? (
                  <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
                    {reviewConflictError}
                  </div>
                ) : null}

                {reviewHomeroomConflict ? (
                  <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-100/90">
                      Homeroom already assigned
                    </p>
                    <p className="text-sm leading-relaxed text-amber-50/95">
                      <span className="font-medium">
                        {reviewHomeroomConflict.classLabel}
                      </span>{" "}
                      already has{" "}
                      <span className="font-medium">
                        {reviewHomeroomConflict.teacherName}
                      </span>{" "}
                      as homeroom teacher. Creating this teacher with that
                      homeroom will replace the current homeroom teacher.
                    </p>
                  </div>
                ) : null}

                {reviewTeachingConflicts.length > 0 ? (
                  <div className="rounded-xl border border-violet-400/20 bg-violet-500/10 p-4 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-200/90">
                      Teaching slots already assigned
                    </p>
                    <p className="text-xs leading-relaxed text-white/60">
                      These subject and class combinations already have another
                      teacher in the current academic term. Choose how to handle
                      those conflicts before creating this teacher.
                    </p>
                    <ul className="space-y-2 border-t border-white/10 pt-3">
                      {reviewTeachingConflicts.map((conflict) => (
                        <li
                          key={conflict.key}
                          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                        >
                          <div className="text-sm text-white">
                            <span className="font-medium text-brand">
                              {conflict.subjectName}
                            </span>
                            <span className="text-white/40"> · </span>
                            {conflict.classLabel}
                          </div>
                          <div className="mt-1 text-xs text-white/60">
                            Already assigned to{" "}
                            {conflict.teacherNames.join(", ")}.
                          </div>
                        </li>
                      ))}
                    </ul>
                    <Controller
                      name="teachingAssignmentResolution"
                      control={control}
                      render={({ field }) => (
                        <RadioGroup
                          value={field.value ?? "add_alongside"}
                          onValueChange={field.onChange}
                          className="grid gap-2"
                        >
                          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-3 text-left hover:bg-white/[0.07]">
                            <RadioGroupItem
                              value="add_alongside"
                              id="tar-coteach"
                              className="mt-0.5"
                            />
                            <span className="min-w-0">
                              <span className="text-sm font-medium text-white">
                                Add as co-teacher
                              </span>
                              <span className="mt-0.5 block text-xs text-white/55">
                                Keep the existing teacher and add this new teacher on the same slot.
                              </span>
                            </span>
                          </label>
                          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-3 text-left hover:bg-white/[0.07]">
                            <RadioGroupItem
                              value="replace"
                              id="tar-replace"
                              className="mt-0.5"
                            />
                            <span className="min-w-0">
                              <span className="text-sm font-medium text-white">
                                Replace the previous teacher
                              </span>
                              <span className="mt-0.5 block text-xs text-white/55">
                                End the other teacher&apos;s assignment for this term and assign this teacher instead.
                              </span>
                            </span>
                          </label>
                          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-3 text-left hover:bg-white/[0.07]">
                            <RadioGroupItem
                              value="skip"
                              id="tar-skip"
                              className="mt-0.5"
                            />
                            <span className="min-w-0">
                              <span className="text-sm font-medium text-white">
                                Skip conflicting rows
                              </span>
                              <span className="mt-0.5 block text-xs text-white/55">
                                Do not create assignments where another teacher is already assigned; you can fix these later.
                              </span>
                            </span>
                          </label>
                        </RadioGroup>
                      )}
                    />
                  </div>
                ) : null}

                <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4 text-sm">
                  <div>
                    <div className="text-xs uppercase tracking-[0.15em] text-white/45 mb-1">
                      Name
                    </div>
                    <div className="text-white font-medium">
                      {firstName} {lastName}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-[0.15em] text-white/45 mb-1">
                        Email
                      </div>
                      <div className="text-white/90">{watchedEmail || "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.15em] text-white/45 mb-1">
                        Phone
                      </div>
                      <div className="text-white/90">
                        {watchedPhone?.trim() ? watchedPhone : "—"}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.15em] text-white/45 mb-1">
                      Status
                    </div>
                    <div className="capitalize text-white/90">
                      {watchedStatus || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.15em] text-white/45 mb-2">
                      Teaching assignments
                    </div>
                    {reviewLoading ? (
                      <div className="text-xs text-white/50">Loading…</div>
                    ) : reviewLines.length === 0 ? (
                      <div className="text-xs text-rose-300">
                        Add at least one assignment on the previous step.
                      </div>
                    ) : (
                      <ul className="space-y-1.5 text-white/85">
                        {reviewLines.map((line, i) => (
                          <li key={i}>
                            <span className="font-medium text-brand">
                              {line.subject}
                            </span>
                            <span className="text-white/45"> · </span>
                            {line.klass}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {reviewTeachingConflicts.length > 0 ? (
                    <div>
                      <div className="text-xs uppercase tracking-[0.15em] text-white/45 mb-1">
                        Teaching conflict handling
                      </div>
                      <div className="text-sm text-white/90">
                        {watchedAssignmentResolution === "replace"
                          ? "Replace the previous teacher for conflicting teaching slots"
                          : watchedAssignmentResolution === "skip"
                            ? "Skip conflicting teaching assignments and add them later if needed"
                            : "Add this teacher alongside the existing teacher on conflicting slots"}
                      </div>
                    </div>
                  ) : null}
                  <div>
                    <div className="text-xs uppercase tracking-[0.15em] text-white/45 mb-1">
                      Homeroom
                    </div>
                    <div className="text-white/90">
                      {watchedHomeroom
                        ? reviewLoading
                          ? "…"
                          : reviewHomeroomLabel || "Selected"
                        : "None"}
                    </div>
                    {reviewHomeroomConflict ? (
                      <div className="mt-1 text-xs text-amber-200/90">
                        This will replace{" "}
                        {reviewHomeroomConflict.teacherName} as the current
                        homeroom teacher.
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center justify-between pt-6 border-t border-white/10">
          <Button
            type="button"
            variant="outline"
            onClick={isFirstStep ? onClose : handlePrevious}
            disabled={isSubmitting || isLoading}
            className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10"
          >
            <ChevronLeft className="h-4 w-4" />
            {isFirstStep ? "Cancel" : "Previous"}
          </Button>

          <div className="flex gap-2">
            {!isLastStep ? (
              <Button
                type="button"
                onClick={() => void handleNext()}
                disabled={isSubmitting || isLoading}
                className="gap-2 bg-brand text-black hover:opacity-90"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  isLoading ||
                  reviewLoading ||
                  reviewConflictLoading ||
                  reviewLines.length < 1
                }
                className="gap-2 bg-brand text-black hover:opacity-90"
              >
                {isSubmitting || isLoading ? (
                  "Creating…"
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Create Teacher
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </form>
    </TooltipProvider>
  );
}
