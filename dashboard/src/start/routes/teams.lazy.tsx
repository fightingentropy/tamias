import { createLazyFileRoute } from "@tanstack/react-router";
import { HydrationBoundary, type DehydratedState } from "@tanstack/react-query";
import { Button } from "@tamias/ui/button";
import { Icons } from "@tamias/ui/icons";
import Link from "@/framework/link";
import { CurrentUserProvider } from "@/components/current-user-provider";
import { SelectTeamTable } from "@/components/tables/select-team/table";
import { TeamInvites } from "@/components/team-invites";
import { UserMenu } from "@/components/user-menu";
import { isTrialExpired } from "@/utils/trial";
import { loadTeamsData } from "./teams";

export const Route = createLazyFileRoute("/teams")({
  component: TeamsPage,
});

function TeamsPage() {
  const loaderData = Route.useLoaderData() as Awaited<ReturnType<typeof loadTeamsData>>;
  const activeTeamCount =
    loaderData.teams.filter((team: (typeof loaderData.teams)[number]) => {
      if (team.plan === "starter" || team.plan === "pro") {
        return true;
      }

      if (team.plan === "trial" && !team.canceledAt && team.createdAt) {
        return !isTrialExpired(team.createdAt);
      }

      return false;
    }).length ?? 0;
  const canCreateTeam = !loaderData.teams.length || activeTeamCount >= loaderData.teams.length;

  return (
    <HydrationBoundary
      state={loaderData.dehydratedState as unknown as DehydratedState | null | undefined}
    >
      <CurrentUserProvider initialUser={loaderData.user}>
        <header className="w-full absolute left-0 right-0 flex justify-between items-center">
          <div className="p-6">
            <Link href="/dashboard">
              <Icons.LogoSmall className="h-6 w-auto" />
            </Link>
          </div>

          <div className="mr-6 mt-4">
            <UserMenu onlySignOut />
          </div>
        </header>

        <div className="flex min-h-screen justify-center items-center overflow-hidden p-6 md:p-0">
          <div className="relative z-20 m-auto flex w-full max-w-[480px] flex-col">
            <div>
              <div className="text-center">
                <h1 className="text-lg lg:text-xl mb-2 font-serif">
                  Welcome, {loaderData.user.fullName?.split(" ").at(0)}
                </h1>
                {loaderData.invites.length > 0 ? (
                  <p className="text-[#878787] text-sm mb-8">
                    Join a team you’ve been invited to or create a new one.
                  </p>
                ) : (
                  <p className="text-[#878787] text-sm mb-8">Select a team or create a new one.</p>
                )}
              </div>
            </div>

            {loaderData.teams.length > 0 && (
              <>
                <span className="text-sm text-[#878787] mb-4">Teams</span>
                <div className="max-h-[260px] overflow-y-auto">
                  <SelectTeamTable data={loaderData.teams} />
                </div>
              </>
            )}

            {loaderData.invites.length > 0 && <TeamInvites />}

            <div className="text-center mt-12 border-t-[1px] border-border pt-6 w-full relative border-dashed">
              <span className="absolute left-1/2 -translate-x-1/2 text-sm text-[#878787] bg-background -top-3 px-4">
                Or
              </span>
              {canCreateTeam ? (
                <Link href="/onboarding" className="w-full">
                  <Button className="w-full mt-2" variant="outline">
                    Create team
                  </Button>
                </Link>
              ) : (
                <p className="text-sm text-[#878787] mt-2">
                  All existing teams must be on a paid plan before creating another. Switch to the
                  team you'd like to upgrade.
                </p>
              )}
            </div>
          </div>
        </div>
      </CurrentUserProvider>
    </HydrationBoundary>
  );
}
