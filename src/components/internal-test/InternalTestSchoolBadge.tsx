import mongoose from "mongoose";
import { Badge } from "@/components/ui/badge";
import { connectToDatabase } from "@/db/connectToDatabase";
import { loadSchoolInternalTestSnapshot } from "@/lib/internal-test/load-internal-test-context";

/** Shows when the school is an internal test school and badge visibility is enabled (Phase 5). */
export async function InternalTestSchoolBadge({ schoolId }: { schoolId: string }) {
  if (!mongoose.Types.ObjectId.isValid(schoolId)) return null;
  await connectToDatabase();
  const snap = await loadSchoolInternalTestSnapshot(new mongoose.Types.ObjectId(schoolId));
  if (!snap?.school.isInternalTestSchool || !snap.config?.showInternalTestBadge) return null;

  return (
    <Badge
      variant="outline"
      className="border-amber-500/40 bg-amber-500/15 text-amber-100 hover:bg-amber-500/20"
    >
      Internal test school
    </Badge>
  );
}
