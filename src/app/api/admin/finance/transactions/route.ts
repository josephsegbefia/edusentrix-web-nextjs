// src/app/api/admin/finance/transactions/route.ts
// Financial Transactions API - List with filters and pagination

import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  FinancialTransaction,
  TransactionStatus,
  TransactionCategory,
  TransactionSourceModule,
  TransactionMethod,
} from "@/models/FinancialTransaction";
import mongoose from "mongoose";

// GET /api/admin/finance/transactions
export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const searchParams = req.nextUrl.searchParams;

    // Pagination
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
    const skip = (page - 1) * limit;

    // Filters
    const status = searchParams.get("status");
    const direction = searchParams.get("direction");
    const category = searchParams.get("category");
    const sourceModule = searchParams.get("sourceModule");
    const method = searchParams.get("method");
    const reconciliationStatus = searchParams.get("reconciliationStatus");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const amountMin = searchParams.get("amountMin");
    const amountMax = searchParams.get("amountMax");
    const search = searchParams.get("q");
    const academicPeriodId = searchParams.get("academicPeriodId");

    // Build query
    const query: Record<string, unknown> = {
      schoolId: new mongoose.Types.ObjectId(String(schoolId)),
    };

    if (status) {
      const statuses = status.split(",") as TransactionStatus[];
      query.status = { $in: statuses };
    }

    if (direction) {
      query.direction = direction;
    }

    if (category) {
      const categories = category.split(",") as TransactionCategory[];
      query.category = { $in: categories };
    }

    if (sourceModule) {
      const modules = sourceModule.split(",") as TransactionSourceModule[];
      query.sourceModule = { $in: modules };
    }

    if (method) {
      const methods = method.split(",") as TransactionMethod[];
      query.method = { $in: methods };
    }

    if (reconciliationStatus) {
      query["reconciliation.status"] = reconciliationStatus;
    }

    if (dateFrom || dateTo) {
      query.occurredAt = {};
      if (dateFrom) {
        (query.occurredAt as Record<string, Date>).$gte = new Date(dateFrom);
      }
      if (dateTo) {
        (query.occurredAt as Record<string, Date>).$lte = new Date(dateTo);
      }
    }

    if (amountMin || amountMax) {
      query.grossAmountMinor = {};
      if (amountMin) {
        (query.grossAmountMinor as Record<string, number>).$gte =
          parseInt(amountMin, 10);
      }
      if (amountMax) {
        (query.grossAmountMinor as Record<string, number>).$lte =
          parseInt(amountMax, 10);
      }
    }

    if (academicPeriodId) {
      query.academicPeriodId = new mongoose.Types.ObjectId(academicPeriodId);
    }

    if (search) {
      query.$or = [
        { reference: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { "party.name": { $regex: search, $options: "i" } },
      ];
    }

    // Sorting
    const sortBy = searchParams.get("sortBy") || "occurredAt";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [sortBy]: sortOrder };

    // Execute query
    const [transactions, total] = await Promise.all([
      FinancialTransaction.find(query)
        .populate("createdBy", "name email")
        .populate("academicPeriodId", "name term yearLabel")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      FinancialTransaction.countDocuments(query),
    ]);

    return NextResponse.json({
      data: transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error fetching financial transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch financial transactions" },
      { status: 500 }
    );
  }
}
