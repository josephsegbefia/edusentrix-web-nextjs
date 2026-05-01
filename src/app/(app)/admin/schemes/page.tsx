"use client";

import { useAdminSchemeStatusAction, useAdminSchemes } from "@/hooks/admin/useAdminSchemes";

export default function AdminSchemesPage() {
  const { data, isLoading, error } = useAdminSchemes();
  const approve = useAdminSchemeStatusAction("approve");
  const activate = useAdminSchemeStatusAction("activate");
  const archive = useAdminSchemeStatusAction("archive");

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 md:p-6">
      <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
        <h1 className="text-xl font-semibold text-white">Scheme review desk</h1>
        <p className="mt-1 text-sm text-white/70">
          Review submitted schemes and progress them to approved/active states.
        </p>
      </div>

      {error ? <p className="text-sm text-rose-300">{error.message}</p> : null}
      {isLoading ? <p className="text-sm text-white/70">Loading schemes...</p> : null}

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/30">
        <table className="min-w-full text-sm">
          <thead className="bg-white/5 text-left text-white/70">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(data || []).map((scheme) => (
              <tr key={scheme.id} className="border-t border-white/5">
                <td className="px-4 py-3 text-white">{scheme.title}</td>
                <td className="px-4 py-3 text-white/75">{scheme.status}</td>
                <td className="px-4 py-3 text-white/60">
                  {new Date(scheme.updatedAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => approve.mutate(scheme.id)}
                      className="rounded-md bg-blue-500 px-2.5 py-1 text-xs font-medium text-white"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => activate.mutate(scheme.id)}
                      className="rounded-md bg-emerald-500 px-2.5 py-1 text-xs font-medium text-white"
                    >
                      Activate
                    </button>
                    <button
                      onClick={() => archive.mutate(scheme.id)}
                      className="rounded-md bg-amber-500 px-2.5 py-1 text-xs font-medium text-black"
                    >
                      Archive
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
