import { createLazyFileRoute } from "@tanstack/react-router";
import { isOAuthErrorCode } from "@tamias/app-store/oauth-errors";
import { OAuthCallbackEventEmitter } from "@/components/oauth/oauth-callback-event-emitter";
import { NotFoundPage } from "@/start/components/not-found-page";
import {
  type AppOAuthErrorCode,
  getErrorDescription,
  getErrorTitle,
} from "@/utils/app-oauth-errors";
import { loadOAuthCallbackData } from "./oauth-callback";

export const Route = createLazyFileRoute("/oauth-callback")({
  component: OAuthCallbackPage,
});

function OAuthCallbackPage() {
  const loaderData = Route.useLoaderData() as Awaited<ReturnType<typeof loadOAuthCallbackData>>;
  if (loaderData.status === "not-found") {
    return <NotFoundPage />;
  }

  const { status, error } = loaderData;
  const isError = status === "error";
  const errorCode: AppOAuthErrorCode | undefined =
    typeof error === "string" && isOAuthErrorCode(error) ? error : undefined;

  return (
    <>
      <OAuthCallbackEventEmitter status={status} error={errorCode} />
      <div className="h-screen flex flex-col items-center justify-center text-center px-8">
        {isError ? (
          <>
            <h1 className="text-lg font-medium mb-2">{getErrorTitle(errorCode)}</h1>
            <p className="text-sm text-[#606060] max-w-[280px]">{getErrorDescription(errorCode)}</p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-medium mb-2">Connected</h1>
            <p className="text-sm text-[#606060]">You may close this window.</p>
          </>
        )}
      </div>
    </>
  );
}
