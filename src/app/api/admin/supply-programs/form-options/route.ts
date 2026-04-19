import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { StoreProduct } from "@/models/StoreProduct";
import { Subject } from "@/models/Subject";

/** Grades, class groups, subjects, and store products for supply program forms (finance staff). */
export async function GET() {
  try {
    const { schoolId } = await requireFinanceStaff();
    await connectToDatabase();

    const oid = new mongoose.Types.ObjectId(String(schoolId));

    const [grades, classGroups, subjects, products] = await Promise.all([
      Grade.find({ schoolId: oid, isActive: true })
        .select("name order")
        .sort({ order: 1, name: 1 })
        .lean(),
      ClassGroup.find({ schoolId: oid, isActive: true })
        .select("name gradeId")
        .sort({ name: 1 })
        .lean(),
      Subject.find({ schoolId: oid, isActive: true })
        .select("name code")
        .sort({ name: 1 })
        .lean(),
      StoreProduct.find({ schoolId: oid })
        .select("name priceMinor isActive")
        .sort({ sortOrder: 1, name: 1 })
        .lean(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        grades: grades.map((g) => ({
          id: String(g._id),
          name: g.name,
        })),
        classGroups: classGroups.map((c) => ({
          id: String(c._id),
          name: c.name,
          gradeId: String(c.gradeId),
        })),
        subjects: subjects.map((s) => ({
          id: String(s._id),
          name: s.name,
          code: s.code || "",
        })),
        products: products.map((p) => ({
          id: String(p._id),
          name: p.name,
          priceMinor: p.priceMinor,
          isActive: p.isActive,
        })),
      },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json(
      { success: false, error: "Failed to load form options" },
      { status: 500 }
    );
  }
}
