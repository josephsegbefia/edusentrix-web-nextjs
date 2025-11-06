import { Suspense } from "react";
import { ApplicationsTable } from "./table.client";
import { ApplicationsFilters } from "./filters.client";

export default function ApplicationsPage() {
  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-50 py-8 px-4">
      <div className="mx-auto max-w-5xl">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="bg-linear-to-r from-blue-600 to-indigo-700 px-8 py-6 text-white">
            <h1 className="text-3xl font-bold mb-1">Applications</h1>
            <p className="text-blue-100 opacity-90">
              Review, approve, or reject new school requests
            </p>
          </div>
          <div className="p-6">
            <ApplicationsFilters />
            <Suspense fallback={<div className="text-gray-600">Loading…</div>}>
              <ApplicationsTable />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
