"use client";

import { Avatar, AvatarFallback, AvatarImageNext } from "@tamias/ui/avatar";
import { Button } from "@tamias/ui/button";
import { Skeleton } from "@tamias/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@tamias/ui/tooltip";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import Link from "@/framework/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useOnClickOutside } from "usehooks-ts";
import { useCurrentUser } from "@/components/current-user-provider";
import { AddIcon } from "@/start/components/global-ui-icons";
import { useTRPC } from "@/trpc/client";

type Props = {
  isExpanded?: boolean;
};

const TEAM_LIST_STALE_TIME_MS = 5 * 60 * 1000;

type TeamOption = {
  id?: string | null;
  name?: string | null;
  logoUrl?: string | null;
};

function TeamAvatar({
  team,
  onClick,
  showTooltip = false,
}: {
  team: TeamOption;
  onClick: () => void;
  showTooltip?: boolean;
}) {
  const avatar = (
    <Avatar
      className="w-[32px] h-[32px] rounded-none border border-[#DCDAD2] dark:border-[#2C2C2C] cursor-pointer"
      onClick={onClick}
    >
      <AvatarImageNext
        src={team.logoUrl ?? ""}
        alt={team.name ?? ""}
        width={20}
        height={20}
        quality={100}
      />
      <AvatarFallback className="rounded-none w-[32px] h-[32px]">
        <span className="text-xs">
          {team.name?.charAt(0)?.toUpperCase()}
          {team.name?.charAt(1)?.toUpperCase()}
        </span>
      </AvatarFallback>
    </Avatar>
  );

  if (!showTooltip) {
    return avatar;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{avatar}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8} className="px-2 py-1">
        <p className="text-xs">{team.name}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function TeamDropdown({ isExpanded = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const user = useCurrentUser();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | undefined>(
    user?.team?.id,
  );
  const [isActive, setActive] = useState(false);
  const [isChangingTeam, setIsChangingTeam] = useState(false);
  const [hasRequestedTeams, setHasRequestedTeams] = useState(false);

  const changeTeamMutation = useMutation(
    trpc.user.switchTeam.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries();
        setIsChangingTeam(false);
        window.location.assign("/dashboard");
      },
    }),
  );

  const { data: teamsData } = useQuery({
    ...trpc.team.list.queryOptions(),
    enabled: hasRequestedTeams,
    staleTime: TEAM_LIST_STALE_TIME_MS,
  });

  useEffect(() => {
    if (user?.team?.id) {
      setSelectedId(user.team.id);
    }
  }, [user?.team?.id]);

  useEffect(() => {
    if (isExpanded) {
      setHasRequestedTeams(true);
    }
  }, [isExpanded]);

  const teams = useMemo(() => {
    const currentTeam = user.team
      ? [
          {
            id: user.team.id,
            name: user.team.name,
            logoUrl: user.team.logoUrl,
          },
        ]
      : [];

    if (!teamsData?.length) {
      return currentTeam;
    }

    const normalizedTeams = teamsData.map((team) => ({
      id: team.id,
      name: team.name,
      logoUrl: team.logoUrl,
    }));

    if (
      currentTeam[0] &&
      !normalizedTeams.some((team) => team.id === currentTeam[0]?.id)
    ) {
      return [...currentTeam, ...normalizedTeams];
    }

    return normalizedTeams;
  }, [teamsData, user.team]);

  const sortedTeams = useMemo(() => {
    return [...teams].sort((a, b) => {
      if (a.id === selectedId) return -1;
      if (b.id === selectedId) return 1;

      return (a.id ?? "").localeCompare(b.id ?? "");
    });
  }, [selectedId, teams]);

  // @ts-expect-error
  useOnClickOutside(ref, () => {
    if (!isChangingTeam) {
      setActive(false);
    }
  });

  const toggleActive = () => {
    setHasRequestedTeams(true);
    setActive((prev) => !prev);
  };

  if (!sortedTeams[0]) {
    return (
      <div className="relative h-[32px]">
        <div className="fixed left-[19px] bottom-4 w-[32px] h-[32px]">
          <Skeleton className="w-[32px] h-[32px] rounded-none" />
        </div>
        {isExpanded && (
          <div className="fixed left-[62px] bottom-4 h-[32px] flex items-center">
            <Skeleton className="h-4 w-24" />
          </div>
        )}
      </div>
    );
  }

  const handleTeamChange = (teamId: string) => {
    if (teamId === selectedId) {
      toggleActive();
      return;
    }

    setIsChangingTeam(true);
    setSelectedId(teamId);
    setActive(false);

    changeTeamMutation.mutate({ teamId });
  };

  return (
    <TooltipProvider delayDuration={50}>
      <div className="relative h-[32px]" ref={ref}>
        {/* Avatar - fixed position that absolutely never changes */}
        <div className="fixed left-[19px] bottom-4 w-[32px] h-[32px]">
          <div className="relative w-[32px] h-[32px]">
            <AnimatePresence>
              {isActive && (
                <motion.div
                  className="w-[32px] h-[32px] left-0 overflow-hidden absolute"
                  style={{ zIndex: 1 }}
                  initial={{ y: 0, opacity: 0 }}
                  animate={{ y: -(32 + 10) * sortedTeams.length, opacity: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 25,
                    mass: 1.2,
                  }}
                >
                  <Link href="/onboarding" onClick={() => setActive(false)}>
                    <Button
                      className="w-[32px] h-[32px] bg-background"
                      size="icon"
                      variant="outline"
                    >
                      <AddIcon />
                    </Button>
                  </Link>
                </motion.div>
              )}
              {sortedTeams.map((team, index) => {
                const isSelected = team.id === selectedId;
                return (
                  <motion.div
                    key={team.id}
                    className="w-[32px] h-[32px] left-0 overflow-hidden absolute"
                    style={{ zIndex: -index }}
                    initial={{
                      scale: `${100 - index * 16}%`,
                      y: index * 5,
                    }}
                    animate={
                      isActive
                        ? {
                            y: -(32 + 10) * index,
                            scale: "100%",
                          }
                        : {
                            scale: `${100 - index * 16}%`,
                            y: index * 5,
                          }
                    }
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 25,
                      mass: 1.2,
                    }}
                  >
                    <TeamAvatar
                      team={team}
                      showTooltip={!isSelected}
                      onClick={() => {
                        if (index === 0) {
                          toggleActive();
                        } else {
                          handleTeamChange(team?.id ?? "");
                        }
                      }}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Team name - appears to the right of the fixed avatar */}
        {isExpanded && sortedTeams[0] && (
          <div className="fixed left-[62px] bottom-4 h-[32px] flex items-center">
            <span
              className="text-sm text-primary truncate transition-opacity duration-200 ease-in-out cursor-pointer hover:opacity-80"
              onClick={(e) => {
                e.stopPropagation();
                toggleActive();
              }}
            >
              {sortedTeams[0].name}
            </span>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
