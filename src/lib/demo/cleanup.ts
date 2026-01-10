// src/lib/demo/cleanup.ts
// Demo data cleanup - removes all data associated with a demo tenant

import "server-only";
import { DemoSession } from "@/models/DemoSession";

// Import all models that have demoTenantId
import { School } from "@/models/School";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { Student } from "@/models/Student";
import { Teacher } from "@/models/Teacher";
import { ClassGroup } from "@/models/ClassGroup";
import { Subject } from "@/models/Subject";
import { Invoice } from "@/models/Invoice";
import { Activity } from "@/models/Activity";
import { FeeStructure } from "@/models/FeeStructure";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { Payment } from "@/models/Payment";
import { Grade } from "@/models/Grade";
import { User } from "@/models/User";

/**
 * Clean up all demo data for a specific tenant
 */
export async function cleanupDemoTenant(demoTenantId: string): Promise<void> {
  console.log(`[Demo Cleanup] Starting cleanup for tenant: ${demoTenantId}`);
  const startTime = Date.now();

  try {
    // Delete in order to respect foreign key relationships
    const deletions = await Promise.allSettled([
      // Dependent records first
      Payment.deleteMany({ demoTenantId }),
      Invoice.deleteMany({ demoTenantId }),
      TeacherAssignment.deleteMany({ demoTenantId }),
      Activity.deleteMany({ demoTenantId }),

      // Then main entities
      Student.deleteMany({ demoTenantId }),
      Teacher.deleteMany({ demoTenantId }),
      ClassGroup.deleteMany({ demoTenantId }),
      Subject.deleteMany({ demoTenantId }),
      FeeStructure.deleteMany({ demoTenantId }),
      AcademicPeriod.deleteMany({ demoTenantId }),
      Grade.deleteMany({ demoTenantId }),
      User.deleteMany({ demoTenantId }),

      // Finally the school
      School.deleteMany({ demoTenantId }),
    ]);

    // Log any failures
    deletions.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(`[Demo Cleanup] Deletion ${index} failed:`, result.reason);
      }
    });

    // Mark session as cleaned up
    await DemoSession.updateOne(
      { demoTenantId },
      {
        $set: {
          dataCleanedUp: true,
          cleanedUpAt: new Date(),
        },
      }
    );

    const duration = Date.now() - startTime;
    console.log(`[Demo Cleanup] Completed in ${duration}ms for tenant: ${demoTenantId}`);
  } catch (error) {
    console.error(`[Demo Cleanup] Error cleaning up tenant ${demoTenantId}:`, error);
    throw error;
  }
}

/**
 * Cleanup stale demo sessions (cron job)
 * Run this periodically to clean up orphaned demo data
 */
export async function cleanupStaleDemoSessions(): Promise<{
  processed: number;
  cleaned: number;
  errors: number;
}> {
  console.log("[Demo Cleanup] Starting stale session cleanup...");

  // Find sessions that are expired but not cleaned up
  const staleThreshold = new Date(Date.now() - 4 * 60 * 60 * 1000); // 4 hours

  const staleSessions = await DemoSession.find({
    $or: [
      // Inactive for too long
      { status: "active", lastActivityAt: { $lt: staleThreshold } },
      // Ended but not cleaned
      { status: "ended", dataCleanedUp: { $ne: true } },
      { status: "expired", dataCleanedUp: { $ne: true } },
    ],
  }).limit(50); // Process in batches

  let processed = 0;
  let cleaned = 0;
  let errors = 0;

  for (const session of staleSessions) {
    processed++;
    try {
      // Mark as expired if still active
      if (session.status === "active") {
        session.status = "expired";
        session.endedAt = new Date();
        session.endReason = "cleanup_job";
        session.events.push({
          type: "session_end",
          timestamp: new Date(),
          metadata: { reason: "cleanup_job" },
        });
        await session.save();
      }

      // Clean up the data
      await cleanupDemoTenant(session.demoTenantId);
      cleaned++;
    } catch (error) {
      console.error(`[Demo Cleanup] Error processing session ${session.demoTenantId}:`, error);
      errors++;
    }
  }

  console.log(`[Demo Cleanup] Stale cleanup complete: ${processed} processed, ${cleaned} cleaned, ${errors} errors`);

  return { processed, cleaned, errors };
}
