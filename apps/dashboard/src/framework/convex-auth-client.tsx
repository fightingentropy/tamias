"use client";

import { useContext } from "react";

export {
  AuthProvider,
  ConvexAuthActionsContext,
  ConvexAuthTokenContext,
  useAuth,
} from "../../../../node_modules/@convex-dev/auth/dist/react/client.js";
export { useAuthToken } from "../../../../node_modules/@convex-dev/auth/dist/react/index.js";

export type {
  ConvexAuthActionsContext as ConvexAuthActionsContextType,
  TokenStorage,
} from "../../../../node_modules/@convex-dev/auth/dist/react/index.js";

import { ConvexAuthActionsContext } from "../../../../node_modules/@convex-dev/auth/dist/react/client.js";

export function useAuthActions() {
  return useContext(ConvexAuthActionsContext);
}
