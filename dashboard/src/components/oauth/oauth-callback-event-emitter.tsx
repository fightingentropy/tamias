"use client";

import type { OAuthErrorCode } from "@tamias/app-store/oauth-errors";
import { useEffect } from "react";
import { OAUTH_CHANNEL_NAME, type OAuthMessage } from "@/utils/oauth-message";
import type { OAuthStatus } from "./oauth-callback-schema";

type Props = {
  status: OAuthStatus;
  error?: OAuthErrorCode;
};

export function OAuthCallbackEventEmitter({ status, error }: Props) {
  useEffect(() => {
    if (!status) {
      return;
    }

    const message: OAuthMessage =
      status === "success"
        ? { type: "app_oauth_completed" }
        : { type: "app_oauth_error", error };

    let channel: BroadcastChannel | null = null;

    try {
      channel = new BroadcastChannel(OAUTH_CHANNEL_NAME);
      channel.postMessage(message);
    } catch {
      // BroadcastChannel is optional; window.opener remains as fallback.
    }

    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage(message, "*");
      } catch {
        // Ignore cross-window messaging failures.
      }
    }

    const timeout = window.setTimeout(() => {
      channel?.postMessage(message);

      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(message, "*");
      }
    }, 100);

    return () => {
      window.clearTimeout(timeout);
      channel?.close();
    };
  }, [status, error]);

  return null;
}
