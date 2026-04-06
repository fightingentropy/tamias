import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@tamias/ui/select";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTRPC } from "@/trpc/client";
import { AssignedUser } from "./assigned-user";

type User = {
  id: string;
  avatar_url?: string | null;
  full_name: string | null;
};

type Props = {
  selectedId?: string;
  valueKey?: "id" | "convexId";
  onSelect: (user?: User) => void;
};

export function AssignUser({ selectedId, valueKey = "id", onSelect }: Props) {
  const [value, setValue] = useState<string>();
  const trpc = useTRPC();

  const { data: users } = useQuery(trpc.team.members.queryOptions());

  useEffect(() => {
    setValue(selectedId);
  }, [selectedId]);

  return (
    <Select
      value={value}
      onValueChange={(id) => {
        const found = users?.find(({ user }) => {
          if (!user) return false;

          return (valueKey === "convexId" ? user.convexId : user.id) === id;
        })?.user;

        if (found) {
          onSelect({
            id: valueKey === "convexId" ? found.convexId : found.id,
            full_name: found.fullName ?? null,
            avatar_url: found.avatarUrl ?? null,
          });
        } else {
          onSelect(undefined);
        }
      }}
    >
      <SelectTrigger
        id="assign"
        className="line-clamp-1 truncate"
        onKeyDown={(evt) => evt.preventDefault()}
      >
        <SelectValue placeholder="Select" />
      </SelectTrigger>

      <SelectContent className="overflow-y-auto max-h-[200px]">
        {users?.map(({ user }) => {
          const optionId = user ? (valueKey === "convexId" ? user.convexId : user.id) : "";

          return (
            <SelectItem key={optionId} value={optionId}>
              <AssignedUser fullName={user?.fullName} avatarUrl={user?.avatarUrl} />
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
