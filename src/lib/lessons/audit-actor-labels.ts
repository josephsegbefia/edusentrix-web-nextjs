import mongoose from "mongoose";
import { User } from "@/models/User";

/** Display names for audit log actors (school admins / teachers as Users). */
export async function actorLabelsForUserIds(
  ids: mongoose.Types.ObjectId[]
): Promise<Map<string, string>> {
  const uniq = [...new Set(ids.map(String))].map((s) => new mongoose.Types.ObjectId(s));
  if (uniq.length === 0) return new Map();

  const users = (await User.find({ _id: { $in: uniq } })
    .select("firstName lastName email name")
    .lean()) as Array<{
    _id: mongoose.Types.ObjectId;
    firstName?: string;
    lastName?: string;
    email?: string;
    name?: string;
  }>;

  const map = new Map<string, string>();
  for (const u of users) {
    const parts = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
    const label = parts || u.name?.trim() || u.email?.trim() || String(u._id);
    map.set(String(u._id), label);
  }
  return map;
}
