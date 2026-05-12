import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { getParentWardIds, requireParent } from "@/lib/auth/requireParent";
import { markOpenLoansOverdueForSchool } from "@/lib/library/library-jobs";
import { LibraryBook } from "@/models/LibraryBook";
import { LibraryLoan } from "@/models/LibraryLoan";
import { Student } from "@/models/Student";

export async function GET() {
  try {
    const ctx = await requireParent();
    await connectToDatabase();
    const wardIds = await getParentWardIds(ctx.userId);
    if (!wardIds.length) {
      return NextResponse.json({
        success: true,
        data: { borrowedBooks: [], overdueCount: 0, finesTotal: 0, notices: [], recommendations: [] },
      });
    }

    await markOpenLoansOverdueForSchool(ctx.schoolId);
    const [students, loans, recommendations] = await Promise.all([
      Student.find({ _id: { $in: wardIds }, schoolId: ctx.schoolId, status: "active" })
        .select("_id firstName lastName")
        .lean(),
      LibraryLoan.find({
        schoolId: ctx.schoolId,
        borrowerType: "student",
        borrowerId: { $in: wardIds },
        isOpen: true,
      })
        .sort({ dueAt: 1 })
        .lean(),
      LibraryBook.find({ schoolId: ctx.schoolId, status: "active" })
        .sort({ updatedAt: -1 })
        .limit(10)
        .select("_id title author coverImageUrl description")
        .lean(),
    ]);

    const studentById = new Map(students.map((s) => [String(s._id), `${s.firstName} ${s.lastName}`]));
    const bookIds = loans.map((loan) => loan.bookId);
    const books = await LibraryBook.find({ _id: { $in: bookIds }, schoolId: ctx.schoolId })
      .select("_id title author coverImageUrl")
      .lean();
    const bookById = new Map(books.map((book) => [String(book._id), book]));
    const now = Date.now();

    const borrowedBooks = loans.map((loan) => {
      const book = bookById.get(String(loan.bookId));
      const isOverdue = loan.dueAt ? loan.dueAt.getTime() < now : loan.status === "overdue";
      return {
        id: String(loan._id),
        bookId: String(loan.bookId),
        title: book?.title || "Library book",
        author: book?.author || null,
        coverUrl: book?.coverImageUrl || null,
        wardId: String(loan.borrowerId),
        wardName: studentById.get(String(loan.borrowerId)) || "Student",
        borrowedAt: loan.issuedAt?.toISOString?.() || new Date().toISOString(),
        dueDate: loan.dueAt?.toISOString?.() || new Date().toISOString(),
        isOverdue,
        status: isOverdue ? "overdue" : "borrowed",
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        borrowedBooks,
        overdueCount: borrowedBooks.filter((book) => book.isOverdue).length,
        finesTotal: loans.reduce((sum, loan) => sum + (loan.fineAmount || 0), 0),
        notices: [],
        recommendations: recommendations.map((book) => ({
          id: String(book._id),
          title: book.title,
          author: book.author || null,
          coverUrl: book.coverImageUrl || null,
          gradeLevel: null,
          description: book.description || null,
        })),
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Failed to load library";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
