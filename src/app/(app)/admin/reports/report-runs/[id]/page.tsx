"use client";

import * as React from "react";
import { AdminReportRunDetailClient } from "@/components/admin/reports/AdminReportRunDetailClient";

type AdminReportRunDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default function AdminReportRunDetailPage({ params }: AdminReportRunDetailPageProps) {
  const { id } = React.use(params);

  return (
    <div className="mx-auto w-full max-w-[1400px] p-4 md:p-6">
      <AdminReportRunDetailClient runId={id} />
    </div>
  );
}
