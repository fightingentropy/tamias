import { rebuildInboxLiabilityAggregatesInConvex } from "../packages/app-data-convex/src/index";

function getArgValue(name: string) {
  const index = process.argv.indexOf(name);

  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

async function main() {
  const teamId = getArgValue("--team");
  const results = await rebuildInboxLiabilityAggregatesInConvex({ teamId });

  console.log(
    JSON.stringify(
      {
        teamId: teamId ?? "all",
        rebuiltTeams: results.length,
        results,
      },
      null,
      2,
    ),
  );
}

await main();
