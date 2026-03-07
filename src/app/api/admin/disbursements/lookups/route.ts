import { NextResponse } from "next/server";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { connectToDatabase } from "@/db/connectToDatabase";
import { SchoolExpense } from "@/models/SchoolExpense";
import { Teacher } from "@/models/Teacher";
import { User } from "@/models/User";
import { Vendor } from "@/models/Vendor";

export async function GET() {
  try {
    const { schoolId } = await requireFinanceStaff();
    await connectToDatabase();

    const [teachers, vendors, expenses] = await Promise.all([
      Teacher.find({ schoolId, status: "active" })
        .select("_id userId payoutProfile")
        .lean(),
      Vendor.find({ schoolId, isActive: true })
        .select("name bankDetails")
        .sort({ name: 1 })
        .lean(),
      SchoolExpense.find({
        schoolId,
        status: "approved",
        vendorId: { $ne: null },
      })
        .select("_id title amountMinor vendorId expenseNumber")
        .sort({ expenseDate: -1, createdAt: -1 })
        .limit(100)
        .lean(),
    ]);

    const teacherUserIds = teachers
      .map((teacher) => teacher.userId)
      .filter(Boolean);

    const users = teacherUserIds.length
      ? await User.find({ _id: { $in: teacherUserIds } })
          .select("name firstName lastName")
          .lean()
      : [];

    const userNameMap = new Map(
      users.map((user) => {
        const displayName =
          user.name ||
          [user.firstName, user.lastName].filter(Boolean).join(" ") ||
          "Teacher";
        return [String(user._id), displayName];
      })
    );

    return NextResponse.json({
      data: {
        teachers: teachers.map((teacher) => ({
          id: String(teacher._id),
          name: userNameMap.get(String(teacher.userId)) || "Teacher",
          payoutProfile: teacher.payoutProfile || null,
        })),
        vendors: vendors.map((vendor) => ({
          id: String(vendor._id),
          name: vendor.name,
          bankDetails: vendor.bankDetails || null,
        })),
        approvedVendorExpenses: expenses.map((expense) => ({
          id: String(expense._id),
          title: expense.title,
          amountMinor: expense.amountMinor,
          vendorId: expense.vendorId ? String(expense.vendorId) : null,
          expenseNumber: expense.expenseNumber,
        })),
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error loading disbursement lookups:", error);
    return NextResponse.json(
      { error: "Failed to load disbursement lookups" },
      { status: 500 }
    );
  }
}
