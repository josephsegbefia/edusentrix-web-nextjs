"use client";

import * as React from "react";
import { StudentAttendanceRow, type AttendanceRowData } from "./StudentAttendanceRow";

export type AttendanceGridProps = {
  records: AttendanceRowData[];
  onChange: (records: AttendanceRowData[]) => void;
};

export function AttendanceGrid({ records, onChange }: AttendanceGridProps) {
  const handleRowChange = React.useCallback(
    (updated: AttendanceRowData) => {
      onChange(
        records.map((record) =>
          record.studentId === updated.studentId ? updated : record
        )
      );
    },
    [records, onChange]
  );

  return (
    <div className="space-y-3">
      {records.map((record) => (
        <StudentAttendanceRow
          key={record.studentId}
          data={record}
          onChange={handleRowChange}
        />
      ))}
    </div>
  );
}
