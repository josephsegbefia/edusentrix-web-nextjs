"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Loader2,
  Send,
  ShieldAlert,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  useAdminSchemeActivateMutation,
  useAdminSchemeArchiveMutation,
  useAdminSchemeDetail,
  useAdminSchemeReviewMutation,
} from "@/hooks/admin/useAdminSchemes";
import { useSchemeDeleteFlow } from "@/hooks/schemes/useSchemeDeleteFlow";
import { adminCanDeleteSchemeStatus } from "@/lib/schemes/scheme-delete";
import type { SchemeReviewDecisionType, SchemeStatus } from "@/types/schemes";
import { SchemeStatusBadge } from "@/components/schemes/SchemeStatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const glassPanel =
  "relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/35 backdrop-blur-xl";

function decisionLabel(d: SchemeReviewDecisionType): string {
  switch (d) {
    case "submitted":
      return "Submitted";
    case "approved":
      return "Approved";
    case "needs_revision":
      return "Revision requested";
    case "rejected":
      return "Rejected";
    case "activated":
      return "Activated";
    case "archived":
      return "Archived";
    default:
      return d;
  }
}

export default function AdminSchemeReviewDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === "string" ? params.id : "";

  const { data, isLoading, error } = useAdminSchemeDetail(id);
  const reviewMut = useAdminSchemeReviewMutation();
  const activateMut = useAdminSchemeActivateMutation();
  const archiveMut = useAdminSchemeArchiveMutation();
  const { requestDelete, confirmationDialog, linkedNotesDialog } = useSchemeDeleteFlow({
    apiBasePath: "/api/admin/schemes",
    onDeleted: () => {
      router.push("/admin/schemes");
    },
  });

  const [approveOpen, setApproveOpen] = React.useState(false);
  const [revisionOpen, setRevisionOpen] = React.useState(false);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [activateOpen, setActivateOpen] = React.useState(false);
  const [archiveOpen, setArchiveOpen] = React.useState(false);

  const [approveNote, setApproveNote] = React.useState("");
  const [revisionNote, setRevisionNote] = React.useState("");
  const [rejectNote, setRejectNote] = React.useState("");
  const [archiveNote, setArchiveNote] = React.useState("");

  const status = data?.scheme.status as SchemeStatus | undefined;

  async function onApprove() {
    if (!id) return;
    try {
      await reviewMut.mutateAsync({
        schemeId: id,
        decision: "approved",
        note: approveNote.trim() || undefined,
      });
      toast.success("Scheme approved");
      setApproveOpen(false);
      setApproveNote("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Approval failed");
    }
  }

  async function onRevision() {
    if (!id || !revisionNote.trim()) {
      toast.warning("Comment is required");
      return;
    }
    try {
      await reviewMut.mutateAsync({
        schemeId: id,
        decision: "needs_revision",
        note: revisionNote.trim(),
      });
      toast.success("Revision requested");
      setRevisionOpen(false);
      setRevisionNote("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Request failed");
    }
  }

  async function onReject() {
    if (!id || !rejectNote.trim()) {
      toast.warning("Reason is required");
      return;
    }
    try {
      await reviewMut.mutateAsync({
        schemeId: id,
        decision: "rejected",
        note: rejectNote.trim(),
      });
      toast.success("Scheme rejected");
      setRejectOpen(false);
      setRejectNote("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Rejection failed");
    }
  }

  async function onActivate() {
    if (!id) return;
    try {
      await activateMut.mutateAsync(id);
      toast.success("Scheme activated");
      setActivateOpen(false);
    } catch (e) {
      const err = e as Error & { code?: string; conflict?: { id: string; title: string } };
      if (err.code === "ACTIVE_SCHEME_CONFLICT") {
        toast.error(
          "Another active scheme already exists for this context. Archive it before activating this one."
        );
      } else {
        toast.error(err.message || "Activation failed");
      }
    }
  }

  async function onArchive() {
    if (!id) return;
    try {
      await archiveMut.mutateAsync({ schemeId: id, note: archiveNote.trim() || undefined });
      toast.success("Scheme archived");
      setArchiveOpen(false);
      setArchiveNote("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Archive failed");
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-white/55">
        <Loader2 className="h-8 w-8 animate-spin text-blue-200" />
        <p className="text-sm">Loading Scheme of Learning…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <p className="text-rose-300">{error?.message ?? "Scheme of Learning not found"}</p>
        <Button variant="outline" asChild className="mt-4 border-white/10 bg-white/5 text-white">
          <Link href="/admin/schemes">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to review desk
          </Link>
        </Button>
      </div>
    );
  }

  const ctx = data.academicContext;
  const scheme = data.scheme;

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6 p-4 md:p-6">
      {confirmationDialog}
      {linkedNotesDialog}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" asChild className="border-white/10 bg-white/5 text-white">
          <Link href="/admin/schemes">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Scheme review desk
          </Link>
        </Button>
      </div>

      <section className={cn(glassPanel, "p-5 md:p-8")}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-white">{scheme.title}</h1>
              <SchemeStatusBadge status={scheme.status as SchemeStatus} />
            </div>
            <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/60">
              <span>
                <span className="text-white/45">Subject:</span>{" "}
                {ctx.subject?.name ?? "—"}
              </span>
              <span>
                <span className="text-white/45">Grade / Class:</span>{" "}
                {ctx.grade?.name ?? "—"}
                {ctx.classGroup ? ` · ${ctx.classGroup.name}` : ""}
              </span>
              <span>
                <span className="text-white/45">Period:</span>{" "}
                {ctx.academicYear?.name ?? ctx.term?.name ?? "—"}
              </span>
              <span>
                <span className="text-white/45">Teacher:</span>{" "}
                {data.ownerTeacher?.name ?? "—"}
              </span>
            </p>
          </div>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-white/55">
          Approved Schemes of Learning have passed academic review. Active schemes are used by
          Lesson Notes and curriculum coverage tracking.
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card className={glassPanel}>
            <CardHeader className="border-b border-white/10">
              <CardTitle className="flex items-center gap-2 text-lg text-white">
                <BookOpen className="h-5 w-5 text-blue-200" />
                Scheme rows
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 bg-white/5 hover:bg-white/5">
                      <TableHead className="text-white/55">Week</TableHead>
                      <TableHead className="text-white/55">Order</TableHead>
                      <TableHead className="text-white/55">Topic</TableHead>
                      <TableHead className="text-white/55">Strand</TableHead>
                      <TableHead className="text-white/55">Indicator</TableHead>
                      <TableHead className="text-white/55">Objectives</TableHead>
                      <TableHead className="text-white/55">Resources</TableHead>
                      <TableHead className="text-white/55">Assessment</TableHead>
                      <TableHead className="text-white/55">Dates</TableHead>
                      <TableHead className="text-white/55">Coverage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="py-8 text-center text-white/45">
                          No scheme rows
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.items.map((item) => (
                        <TableRow
                          key={item.id}
                          className="border-white/5 align-top hover:bg-white/[0.03]"
                        >
                          <TableCell className="whitespace-nowrap text-white/80">
                            {item.weekNumber}
                          </TableCell>
                          <TableCell className="text-white/65">{item.lessonOrder ?? "—"}</TableCell>
                          <TableCell className="max-w-[200px] text-sm text-white/85">
                            <div className="font-medium">{item.topic}</div>
                            {item.subtopic ? (
                              <div className="mt-0.5 text-xs text-white/45">{item.subtopic}</div>
                            ) : null}
                          </TableCell>
                          <TableCell className="max-w-[160px] text-xs text-white/65">
                            {item.strand ?? "—"}
                            {item.subStrand ? (
                              <div className="text-white/45">{item.subStrand}</div>
                            ) : null}
                          </TableCell>
                          <TableCell className="max-w-[180px] text-xs text-white/65">
                            {item.indicator ?? "—"}
                          </TableCell>
                          <TableCell className="max-w-[220px] text-xs text-white/65">
                            {item.learningObjectives?.length
                              ? item.learningObjectives.join("; ")
                              : "—"}
                          </TableCell>
                          <TableCell className="max-w-[160px] text-xs text-white/55">
                            {item.teachingResources?.length
                              ? item.teachingResources.join("; ")
                              : "—"}
                          </TableCell>
                          <TableCell className="max-w-[160px] text-xs text-white/55">
                            {item.assessmentIdeas?.length
                              ? item.assessmentIdeas.join("; ")
                              : "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-white/55">
                            {item.plannedStartDate || item.plannedEndDate
                              ? `${item.plannedStartDate ? new Date(item.plannedStartDate).toLocaleDateString() : "—"} – ${item.plannedEndDate ? new Date(item.plannedEndDate).toLocaleDateString() : "—"}`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-xs capitalize text-white/55">
                            {item.coverageStatus ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className={glassPanel}>
            <CardHeader className="border-b border-white/10">
              <CardTitle className="text-lg text-white">Review history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              {data.reviews.length === 0 ? (
                <p className="text-sm text-white/45">No review events yet.</p>
              ) : (
                <ul className="space-y-4 border-l border-white/10 pl-4">
                  {data.reviews.map((r) => (
                    <li key={r.id} className="relative">
                      <div className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-blue-400/80 ring-4 ring-slate-950" />
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className="border-white/15 bg-white/5 text-xs text-white/75"
                        >
                          {decisionLabel(r.decision)}
                        </Badge>
                        <span className="text-xs text-white/45">
                          {new Date(r.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-white/70">
                        {r.actor?.name ?? "Reviewer"}
                        {r.actor?.role ? (
                          <span className="text-white/45"> · {r.actor.role}</span>
                        ) : null}
                      </p>
                      {r.note ? (
                        <p className="mt-2 rounded-lg border border-white/10 bg-white/[0.04] p-3 text-sm text-white/80">
                          {r.note}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className={cn(glassPanel, "h-fit xl:sticky xl:top-6")}>
          <CardHeader className="border-b border-white/10">
            <CardTitle className="text-lg text-white">Reviewer actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 p-4">
            {status === "submitted" ? (
              <>
                <Button
                  className="w-full justify-start gap-2 bg-blue-500/20 text-blue-100 hover:bg-blue-500/30"
                  onClick={() => setApproveOpen(true)}
                  disabled={reviewMut.isPending}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Approve
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 border-orange-300/25 bg-orange-500/10 text-orange-100"
                  onClick={() => setRevisionOpen(true)}
                  disabled={reviewMut.isPending}
                >
                  <ShieldAlert className="h-4 w-4" />
                  Request revision
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 border-rose-300/25 bg-rose-500/10 text-rose-100"
                  onClick={() => setRejectOpen(true)}
                  disabled={reviewMut.isPending}
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </Button>
              </>
            ) : null}

            {status === "approved" ? (
              <>
                <Button
                  className="w-full justify-start gap-2 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
                  onClick={() => setActivateOpen(true)}
                  disabled={activateMut.isPending}
                >
                  <Send className="h-4 w-4" />
                  Activate
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 border-white/10 bg-white/5 text-white/80"
                  onClick={() => setArchiveOpen(true)}
                  disabled={archiveMut.isPending}
                >
                  <Archive className="h-4 w-4" />
                  Archive
                </Button>
              </>
            ) : null}

            {status === "active" ? (
              <Button
                variant="outline"
                className="w-full justify-start gap-2 border-white/10 bg-white/5 text-white/80"
                onClick={() => setArchiveOpen(true)}
                disabled={archiveMut.isPending}
              >
                <Archive className="h-4 w-4" />
                Archive
              </Button>
            ) : null}

            {(status === "needs_revision" || status === "draft") && (
              <Button
                variant="outline"
                className="w-full justify-start gap-2 border-white/10 bg-white/5 text-white/80"
                onClick={() => setArchiveOpen(true)}
                disabled={archiveMut.isPending}
              >
                <Archive className="h-4 w-4" />
                Archive
              </Button>
            )}

            {status === "archived" || status === "rejected" ? (
              <p className="text-xs text-white/45">No further actions. This record is view only.</p>
            ) : null}

            {status && adminCanDeleteSchemeStatus(status) ? (
              <>
                <div className="my-1 border-t border-white/10" />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start gap-2 border-rose-300/25 bg-rose-500/10 text-rose-100 hover:bg-rose-500/15"
                  onClick={() =>
                    void requestDelete({ id, title: data.scheme.title })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                  Delete scheme
                </Button>
              </>
            ) : status === "active" ? (
              <p className="text-xs text-white/45">Archive this active scheme before deleting it.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent className="border-white/10 bg-slate-950 text-white">
          <DialogHeader>
            <DialogTitle>Approve Scheme of Learning</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-white/55">Optional note</Label>
            <Textarea
              value={approveNote}
              onChange={(e) => setApproveNote(e.target.value)}
              className="border-white/10 bg-white/5 text-white"
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setApproveOpen(false)} className="border-white/10">
              Cancel
            </Button>
            <Button onClick={() => void onApprove()} disabled={reviewMut.isPending}>
              Confirm approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={revisionOpen} onOpenChange={setRevisionOpen}>
        <DialogContent className="border-white/10 bg-slate-950 text-white">
          <DialogHeader>
            <DialogTitle>Request revision</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-white/55">Comment (required)</Label>
            <Textarea
              value={revisionNote}
              onChange={(e) => setRevisionNote(e.target.value)}
              className="border-white/10 bg-white/5 text-white"
              rows={4}
              placeholder="Explain what should be improved…"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRevisionOpen(false)} className="border-white/10">
              Cancel
            </Button>
            <Button onClick={() => void onRevision()} disabled={reviewMut.isPending}>
              Send back for revision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="border-white/10 bg-slate-950 text-white">
          <DialogHeader>
            <DialogTitle>Reject Scheme of Learning</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-white/55">Reason (required)</Label>
            <Textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              className="border-white/10 bg-white/5 text-white"
              rows={4}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRejectOpen(false)} className="border-white/10">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void onReject()}
              disabled={reviewMut.isPending}
            >
              Reject Scheme
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={activateOpen} onOpenChange={setActivateOpen}>
        <DialogContent className="border-white/10 bg-slate-950 text-white">
          <DialogHeader>
            <DialogTitle>Activate Scheme of Learning</DialogTitle>
          </DialogHeader>
          <p className="text-sm leading-6 text-white/65">
            Active Schemes of Learning power Lesson Notes suggestions and coverage tracking. Only
            one active scheme should exist for the same academic context: year, term, grade, class,
            and subject.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setActivateOpen(false)} className="border-white/10">
              Cancel
            </Button>
            <Button onClick={() => void onActivate()} disabled={activateMut.isPending}>
              Confirm activation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent className="border-white/10 bg-slate-950 text-white">
          <DialogHeader>
            <DialogTitle>Archive Scheme of Learning</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-white/55">Optional note</Label>
            <Textarea
              value={archiveNote}
              onChange={(e) => setArchiveNote(e.target.value)}
              className="border-white/10 bg-white/5 text-white"
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setArchiveOpen(false)} className="border-white/10">
              Cancel
            </Button>
            <Button onClick={() => void onArchive()} disabled={archiveMut.isPending}>
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
