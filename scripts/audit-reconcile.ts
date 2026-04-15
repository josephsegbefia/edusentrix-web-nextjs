/**
 * Compare ApplicationAudit / PaymentAuditEvent rows to normalized AuditEvent (dual-write parity).
 *
 * Usage: npx tsx scripts/audit-reconcile.ts [--days=7]
 */
import { reconcileDomainAuditParity } from "@/lib/audit/reconcileDomainVsAudit";

function parseDays(argv: string[]): number {
  const raw = argv.find((a) => a.startsWith("--days="));
  if (!raw) return 7;
  const n = Number(raw.split("=")[1]);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 365) : 7;
}

async function main() {
  const sinceDays = parseDays(process.argv.slice(2));
  const report = await reconcileDomainAuditParity({ sinceDays });
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(report, null, 2));
  if (report.driftCount > 0) process.exitCode = 2;
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
