import { useState } from "react";

export function CreateStudentModal({
  onClose,
  onSubmit,
  isLoading,
}: {
  onClose: () => void;
  onSubmit: (data: {
    firstName: string;
    lastName: string;
    gradeId: string;
    classGroupId: string;
  }) => void;
  isLoading?: boolean;
}) {
  const [firstName, setFirst] = useState("");
  const [lastName, setLast] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [classGroupId, setClassGroupId] = useState("");

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!firstName || !lastName || !gradeId || !classGroupId) return;
        onSubmit({ firstName, lastName, gradeId, classGroupId });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/60 mb-1">First Name</div>
          <input
            value={firstName}
            onChange={(e) => setFirst(e.target.value)}
            className="w-full bg-transparent outline-none"
          />
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/60 mb-1">Last Name</div>
          <input
            value={lastName}
            onChange={(e) => setLast(e.target.value)}
            className="w-full bg-transparent outline-none"
          />
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/60 mb-1">Grade</div>
          <input
            value={gradeId}
            onChange={(e) => setGradeId(e.target.value)}
            className="w-full bg-transparent outline-none"
          />
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/60 mb-1">Class Group</div>
          <input
            value={classGroupId}
            onChange={(e) => setClassGroupId(e.target.value)}
            className="w-full bg-transparent outline-none"
          />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={
            isLoading || !firstName || !lastName || !gradeId || !classGroupId
          }
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
        >
          {isLoading ? "Creating..." : "Create"}
        </button>
      </div>
    </form>
  );
}
