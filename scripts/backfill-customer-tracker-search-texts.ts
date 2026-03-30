import {
  rebuildCustomerSearchTextsInConvex,
  rebuildTrackerProjectSearchTextsInConvex,
} from "../packages/app-data-convex/src/index";

function getArgValue(name: string) {
  const index = process.argv.indexOf(name);

  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

async function main() {
  const teamId = getArgValue("--team");
  const [customers, trackerProjects] = await Promise.all([
    rebuildCustomerSearchTextsInConvex({ teamId }),
    rebuildTrackerProjectSearchTextsInConvex({ teamId }),
  ]);

  console.log(
    JSON.stringify(
      {
        teamId: teamId ?? "all",
        rebuiltCustomerTeams: customers.length,
        rebuiltTrackerProjectTeams: trackerProjects.length,
        customers,
        trackerProjects,
      },
      null,
      2,
    ),
  );
}

await main();
