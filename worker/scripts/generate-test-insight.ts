#!/usr/bin/env bun
/**
 * Script to manually trigger insight generation for testing
 *
 * Usage:
 *   bun run scripts/generate-test-insight.ts <teamId> [periodType] [periodYear] [periodNumber] [--force]
 *
 * Examples:
 *   # Generate weekly insight for previous week
 *   bun run scripts/generate-test-insight.ts abc123-team-id
 *
 *   # Generate specific weekly insight
 *   bun run scripts/generate-test-insight.ts abc123-team-id weekly 2026 2
 *
 *   # Generate monthly insight
 *   bun run scripts/generate-test-insight.ts abc123-team-id monthly 2026 1
 *
 *   # Force generation (bypass data quality checks)
 *   bun run scripts/generate-test-insight.ts abc123-team-id --force
 *   bun run scripts/generate-test-insight.ts abc123-team-id weekly 2026 2 --force
 */

import { getTeamById } from "@tamias/app-data/queries";
import { getWorkerDb } from "@tamias/app-data/worker-client";
import { getPreviousCompletePeriod } from "@tamias/insights/period";
import type { PeriodType } from "@tamias/insights/types";
import { enqueue } from "@tamias/job-client";

async function main() {
  const rawArgs = process.argv.slice(2);

  // Parse --force flag
  const forceIndex = rawArgs.indexOf("--force");
  const skipDataQualityCheck = forceIndex !== -1;
  const args = rawArgs.filter((arg) => arg !== "--force");

  if (args.length < 1) {
    console.error(
      "Usage: bun run scripts/generate-test-insight.ts <teamId> [periodType] [periodYear] [periodNumber] [--force]",
    );
    console.error("\nExamples:");
    console.error("  bun run scripts/generate-test-insight.ts abc123-team-id");
    console.error(
      "  bun run scripts/generate-test-insight.ts abc123-team-id weekly 2026 2",
    );
    console.error(
      "  bun run scripts/generate-test-insight.ts abc123-team-id monthly 2026 1",
    );
    console.error(
      "  bun run scripts/generate-test-insight.ts abc123-team-id --force",
    );
    process.exit(1);
  }

  const teamId = args[0] as string;
  const periodType = (args[1] as PeriodType) || "weekly";

  // Fetch team to get base currency
  const db = getWorkerDb();
  const team = await getTeamById(db, teamId);
  if (!team) {
    console.error(`❌ Team not found: ${teamId}`);
    process.exit(1);
  }

  const currency = team.baseCurrency ?? "USD";

  // Get period info - either from args or calculate previous complete period
  let periodYear: number;
  let periodNumber: number;

  if (args[2] && args[3]) {
    periodYear = Number.parseInt(args[2], 10);
    periodNumber = Number.parseInt(args[3], 10);
  } else {
    const period = getPreviousCompletePeriod(periodType);
    periodYear = period.periodYear;
    periodNumber = period.periodNumber;
  }

  console.log("\n🔍 Generating test insight with parameters:");
  console.log(`   Team ID: ${teamId}`);
  console.log(`   Period Type: ${periodType}`);
  console.log(`   Period Year: ${periodYear}`);
  console.log(`   Period Number: ${periodNumber}`);
  console.log(`   Currency: ${currency} (from team settings)`);
  if (skipDataQualityCheck) {
    console.log("   ⚠️  Force mode: bypassing data quality checks");
  }
  console.log();

  try {
    if (
      !process.env.CLOUDFLARE_ASYNC_BRIDGE_URL ||
      !process.env.CLOUDFLARE_ASYNC_BRIDGE_TOKEN
    ) {
      console.error(
        "❌ CLOUDFLARE_ASYNC_BRIDGE_URL and CLOUDFLARE_ASYNC_BRIDGE_TOKEN are required",
      );
      process.exit(1);
    }

    const requestedJobId = `test-insights-${teamId}-${periodType}-${periodYear}-${periodNumber}-${Date.now()}`;

    console.log("📤 Enqueueing generate-team-insights run...");

    const run = await enqueue(
      "generate-team-insights",
      {
        teamId,
        periodType,
        periodYear,
        periodNumber,
        currency,
        skipDataQualityCheck,
      },
      "insights",
      {
        publicTeamId: teamId,
        jobId: requestedJobId,
        metadata: {
          source: "generate-test-insight-script",
        },
      },
    );

    console.log("✅ Run enqueued successfully!");
    console.log(`   Run ID: ${run.runId}`);
    console.log(`   Requested Job ID: ${requestedJobId}`);
    console.log();
    console.log("💡 The job will be processed by the Cloudflare async worker.");
    console.log(
      "   Make sure the worker is running: bun run dev (in worker)",
    );
    console.log();
    console.log(
      "   To monitor progress, check the async worker logs or the insights table.",
    );
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }

  process.exit(0);
}

main();
