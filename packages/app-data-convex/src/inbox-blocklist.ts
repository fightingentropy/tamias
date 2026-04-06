import { api, createClient, serviceArgs } from "./base";

export type InboxBlocklistType = "email" | "domain";

export type InboxBlocklistRecord = {
  id: string;
  teamId: string;
  type: InboxBlocklistType;
  value: string;
  createdAt: string;
};

export async function getInboxBlocklistFromConvex(args: { teamId: string }) {
  return createClient().query(
    api.inboxBlocklist.serviceGetInboxBlocklist,
    serviceArgs({
      publicTeamId: args.teamId,
    }),
  ) as Promise<InboxBlocklistRecord[]>;
}

export async function createInboxBlocklistInConvex(args: {
  teamId: string;
  type: InboxBlocklistType;
  value: string;
}) {
  return createClient().mutation(
    api.inboxBlocklist.serviceCreateInboxBlocklist,
    serviceArgs({
      publicTeamId: args.teamId,
      type: args.type,
      value: args.value,
    }),
  ) as Promise<InboxBlocklistRecord>;
}

export async function deleteInboxBlocklistInConvex(args: {
  teamId: string;
  id: string;
}) {
  return createClient().mutation(
    api.inboxBlocklist.serviceDeleteInboxBlocklist,
    serviceArgs({
      publicTeamId: args.teamId,
      inboxBlocklistId: args.id,
    }),
  ) as Promise<InboxBlocklistRecord | null>;
}
