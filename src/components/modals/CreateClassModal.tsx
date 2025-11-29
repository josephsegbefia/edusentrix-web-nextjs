import { useState } from "react";

export function CreateClassModal({
  onClose,
  onSubmit,
  isLoading,
}: {
  onClose: () => void;
  onSubmit: (data: { gradeId: string; name: string }) => void;
  isLoading?: boolean;
}) {
  const [gradeId, setGradeId] = useState("");
  const [name, setName] = useState("");

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!gradeId || !name) return;
        onSubmit({ gradeId, name });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/60 mb-1">Grade</div>
          <input
            value={gradeId}
            onChange={(e) => setGradeId(e.target.value)}
            placeholder="Select Grade (ID)"
            className="w-full bg-transparent outline-none"
          />
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/60 mb-1">Class Group Name</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., JHS 1 A"
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
          disabled={isLoading || !gradeId || !name}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
        >
          {isLoading ? "Creating..." : "Create"}
        </button>
      </div>
    </form>
  );
}
