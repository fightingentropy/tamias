import type { Database } from "@tamias/app-data/client";
import type { Session } from "@tamias/auth-session";
import type { Scope } from "@tamias/auth-session/scopes";

export type Context = {
  Bindings: Env;
  Variables: {
    db: Database;
    session: Session;
    teamId: string;
    userId?: string;
    clientIp?: string;
    scopes?: Scope[];
  };
};
