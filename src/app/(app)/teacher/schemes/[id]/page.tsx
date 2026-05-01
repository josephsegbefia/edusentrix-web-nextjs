"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  useTeacherCoverageSummary,
  useTeacherSchemeDetail,
  useTeacherSchemeItemCoverageUpdate,
  useTeacherSchemeItemCreate,
  useTeacherSchemeItems,
  useTeacherSchemeSubmit,
} from "@/hooks/teacher/useTeacherSchemes";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";
import type { SchemeItemCoverageStatus } from "@/types/schemes";

const COVERAGE_OPTIONS: { value: SchemeItemCoverageStatus; label: string }[] = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "covered", label: "Covered" },
  { value: "skipped", label: "Skipped" },
  { value: "moved", label: "Moved" },
  { value: "needs_review", label: "Needs review" },
];

export default function TeacherSchemeDetailPage() {
  const params = useParams<{ id: string }>();
  const schemeId = useMemo(() => String(params?.id || ""), [params]);
  const [itemTitle, setItemTitle] = useState("");

  const { data: ctxRes } = useTeacherContext();
  const permissions = (ctxRes?.data?.permissions ?? []) as Permission[];
  const teacherId = ctxRes?.data?.teacher?._id ?? "";
  const canPatchCoverage = can(permissions, PERMISSIONS.schemeItemUpdateCoverage);
  const isAdminUser = can(permissions, PERMISSIONS.schemeOfWorkApprove);

  const { data: scheme, isLoading: schemeLoading, error: schemeError } =
    useTeacherSchemeDetail(schemeId || null);
  const { data: items, isLoading: itemsLoading, error: itemsError } = useTeacherSchemeItems(
    schemeId || null
  );
  const { data: coverageBundle, error: coverageError } = useTeacherCoverageSummary(schemeId || null);
  const itemCreate = useTeacherSchemeItemCreate(schemeId);
  const submitMutation = useTeacherSchemeSubmit();
  const coverageMutation = useTeacherSchemeItemCoverageUpdate(schemeId || null);

  const summary = coverageBundle?.summary;
  const canEditCoverage =
    Boolean(scheme) &&
    canPatchCoverage &&
    (scheme!.status === "approved" || scheme!.status === "active") &&
    (isAdminUser ||
      !scheme!.ownerTeacherId ||
      scheme!.ownerTeacherId === teacherId);

  async function createItem() {
    const trimmed = itemTitle.trim();
    if (!trimmed) return;
    await itemCreate.mutateAsync({ title: trimmed });
    setItemTitle("");
  }

  async function submitScheme() {
    if (!schemeId) return;
    await submitMutation.mutateAsync(schemeId);
  }

  const loadError = schemeError?.message || itemsError?.message;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 md:p-6">
      <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/40">Scheme of work</p>
            <h1 className="text-xl font-semibold text-white">
              {schemeLoading ? "Loading…" : scheme?.title ?? "Scheme"}
            </h1>
            {scheme ? (
              <p className="mt-1 text-sm text-white/60">
                Status:{" "}
                <span className="text-white/80">{scheme.status.replace(/_/g, " ")}</span>
              </p>
            ) : null}
          </div>
          <Link
            href="/teacher/coverage"
            className="text-sm font-medium text-sky-400 hover:text-sky-300"
          >
            Coverage dashboard
          </Link>
        </div>
        <p className="mt-3 text-sm text-white/70">
          Add weekly plan entries, then submit this scheme for review. After approval, track coverage
          per row.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            value={itemTitle}
            onChange={(e) => setItemTitle(e.target.value)}
            placeholder="Item title (e.g. Week 1: Introduction)"
            className="min-w-[240px] flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40"
          />
          <button
            type="button"
            onClick={createItem}
            disabled={itemCreate.isPending || scheme?.status !== "draft"}
            className="rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {itemCreate.isPending ? "Adding..." : "Add item"}
          </button>
          <button
            type="button"
            onClick={submitScheme}
            disabled={submitMutation.isPending || scheme?.status !== "draft"}
            className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitMutation.isPending ? "Submitting..." : "Submit for review"}
          </button>
        </div>
        {scheme?.status === "draft" ? (
          <p className="mt-2 text-xs text-amber-200/90">
            Coverage status can be set after the scheme is approved or active.
          </p>
        ) : null}
      </div>

      {coverageError && scheme && (scheme.status === "approved" || scheme.status === "active") ? (
        <p className="text-sm text-amber-200/90">{coverageError.message}</p>
      ) : null}

      {summary && scheme && (scheme.status === "approved" || scheme.status === "active") ? (
        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          <h2 className="text-lg font-semibold text-white">Coverage overview</h2>
          <p className="mt-1 text-sm text-white/65">
            {summary.covered} of {summary.totalItems} planned rows marked covered (
            {summary.coveragePercentage}%).
          </p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-emerald-500 transition-[width]"
              style={{ width: `${summary.coveragePercentage}%` }}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/55">
            <span>Not started: {summary.notStarted}</span>
            <span>In progress: {summary.inProgress}</span>
            <span>Skipped: {summary.skipped}</span>
            <span>Moved: {summary.moved}</span>
            <span>Needs review: {summary.needsReview}</span>
          </div>
        </div>
      ) : null}

      {loadError ? <p className="text-sm text-rose-300">{loadError}</p> : null}
      {itemsLoading ? <p className="text-sm text-white/70">Loading items...</p> : null}

      <div className="space-y-2">
        {(items || []).map((item) => (
          <article key={item.id} className="rounded-xl border border-white/10 bg-slate-950/30 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-medium text-white">{item.title}</h2>
                  <span className="text-xs text-white/60">Week {item.weekNumber ?? "-"}</span>
                </div>
                {item.learningObjective ? (
                  <p className="mt-1 text-sm text-white/70">{item.learningObjective}</p>
                ) : null}
              </div>
              {canEditCoverage && item.status !== "dropped" ? (
                <div className="flex shrink-0 flex-col gap-1 sm:w-52">
                  <label className="text-[11px] uppercase tracking-wide text-white/45">
                    Coverage
                  </label>
                  <select
                    value={item.coverageStatus}
                    disabled={coverageMutation.isPending}
                    onChange={(e) => {
                      const value = e.target.value as SchemeItemCoverageStatus;
                      coverageMutation.mutate({ itemId: item.id, status: value });
                    }}
                    className="rounded-lg border border-white/15 bg-black/40 px-2 py-2 text-sm text-white outline-none"
                  >
                    {COVERAGE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="text-right text-xs text-white/50">
                  <span className="block text-[11px] uppercase tracking-wide text-white/45">
                    Coverage
                  </span>
                  <span className="text-sm text-white/75">
                    {COVERAGE_OPTIONS.find((o) => o.value === item.coverageStatus)?.label ??
                      item.coverageStatus}
                  </span>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
