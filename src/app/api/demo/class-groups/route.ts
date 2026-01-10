// src/app/api/demo/class-groups/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { getDemoContext } from "@/lib/demo/api-utils";
import { ClassGroup } from "@/models/ClassGroup";
import { Student } from "@/models/Student";

export async function GET(req: NextRequest) {
  try {
    const demoContext = await getDemoContext();

    if (!demoContext.isDemo || !demoContext.demoTenantId) {
      return NextResponse.json({ error: "Demo session required" }, { status: 401 });
    }

    await connectToDatabase();
    const filter = { demoTenantId: demoContext.demoTenantId };

    const classGroups = await ClassGroup.find(filter)
      .populate("homeroomTeacher", "firstName lastName")
      .sort({ gradeLabel: 1, name: 1 })
      .lean();

    // Get student counts for each class
    const classIds = classGroups.map((c) => c._id);
    const studentCounts = await Student.aggregate([
      { $match: { classGroupId: { $in: classIds }, demoTenantId: demoContext.demoTenantId } },
      { $group: { _id: "$classGroupId", count: { $sum: 1 } } },
    ]);

    const countMap = new Map(studentCounts.map((s) => [String(s._id), s.count]));

    const data = classGroups.map((c) => {
      const teacher = c.homeroomTeacher as { firstName?: string; lastName?: string } | null;
      return {
        _id: String(c._id),
        name: c.name,
        gradeLabel: c.gradeLabel,
        description: c.description,
        capacity: c.capacity,
        studentCount: countMap.get(String(c._id)) || 0,
        homeroomTeacher: teacher
          ? `${teacher.firstName || ""} ${teacher.lastName || ""}`.trim()
          : null,
        status: c.status || "active",
      };
    });

    return NextResponse.json({ data, total: data.length });
  } catch (error) {
    console.error("[Demo Class Groups] Error:", error);
    return NextResponse.json({ error: "Failed to fetch class groups" }, { status: 500 });
  }
}
