// src/components/admin/fees/StudentCreditSection.tsx
"use client";

import * as React from "react";
import { StudentCreditManager } from "./StudentCreditManager";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";

type Props = {
  studentId: string;
};

function StudentCreditSection({ studentId }: Props) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["studentCredit", studentId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/fees/credit/${studentId}`);
      if (!res.ok) throw new Error("Failed to fetch credit balance");
      return res.json();
    },
    enabled: !!studentId,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <StudentCreditManager
      studentId={studentId}
      studentName={`${data.student.firstName} ${data.student.lastName}`}
      creditBalance={data.creditBalance.balanceMinor}
      entries={data.creditBalance.entries || []}
      invoices={data.invoices || []}
      onCreditApplied={() => {
        refetch();
      }}
    />
  );
}

export default StudentCreditSection;
