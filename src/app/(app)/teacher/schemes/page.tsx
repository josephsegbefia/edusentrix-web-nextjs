"use client";

import Link from "next/link";
import { useState } from "react";
import { useTeacherSchemeCreate, useTeacherSchemes } from "@/hooks/teacher/useTeacherSchemes";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";

export default function TeacherSchemesPage() {
  const [title, setTitle] = useState("");
  const { data, isLoading, error } = useTeacherSchemes();
  const createMutation = useTeacherSchemeCreate();
  const { data: ctxRes } = useTeacherContext();
  const permissions = (ctxRes?.data?.permissions ?? []) as Permission[];
  const canImport = can(permissions, PERMISSIONS.schemeImportUpload);

  async function createScheme() {
    const trimmed = title.trim();
    if (!trimmed) return;
    await createMutation.mutateAsync({ title: trimmed });
    setTitle("");
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 md:p-6">
      <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
        <h1 className="text-xl font-semibold text-white">Schemes of work</h1>
        <p className="mt-1 text-sm text-white/70">
          Phase 1 foundation: create draft schemes and prepare for review.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="New scheme title"
            className="min-w-[240px] flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40"
          />
          <button
            type="button"
            onClick={createScheme}
            disabled={createMutation.isPending}
            className="rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {createMutation.isPending ? "Creating..." : "Create scheme"}
          </button>
          {canImport ? (
            <Link
              href="/teacher/schemes/import"
              className="rounded-lg border border-white/20 px-3 py-2 text-sm font-medium text-white/90 hover:bg-white/5"
            >
              Import CSV / Excel
            </Link>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-sm text-rose-300">{error.message}</p> : null}
      {isLoading ? <p className="text-sm text-white/70">Loading schemes...</p> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {(data || []).map((scheme) => (
          <Link
            key={scheme.id}
            href={`/teacher/schemes/${scheme.id}`}
            className="rounded-xl border border-white/10 bg-slate-950/30 p-4 transition hover:border-white/25"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-medium text-white">{scheme.title}</h2>
              <span className="rounded-full border border-white/20 px-2 py-0.5 text-xs text-white/75">
                {scheme.status}
              </span>
            </div>
            <p className="mt-2 text-xs text-white/60">
              Updated {new Date(scheme.updatedAt).toLocaleDateString()}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
