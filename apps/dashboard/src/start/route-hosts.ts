import { createFileRoute } from "@tanstack/react-router";
import type { FileRoutesByPath } from "@tanstack/react-router";

export type RouteHostSurface = "app" | "website" | "shared";
export type RouteAppHostAccess = "public" | "protected";

export type StartRouteStaticData = {
  hostSurface: RouteHostSurface;
  appHostAccess: RouteAppHostAccess;
};

type RoutePath = keyof FileRoutesByPath;
type FileRouteFactory<TFilePath extends RoutePath> = ReturnType<
  typeof createFileRoute<TFilePath>
>;
type FileRouteOptions<TFilePath extends RoutePath> = Parameters<
  FileRouteFactory<TFilePath>
>[0];

function withRouteStaticData<TFilePath extends RoutePath>(
  path: TFilePath,
  staticData: StartRouteStaticData,
): FileRouteFactory<TFilePath> {
  const fileRoute = createFileRoute(path);

  return ((options?: FileRouteOptions<TFilePath>) =>
    fileRoute({
      ...(options as object),
      staticData: {
        ...staticData,
        ...(((options as { staticData?: Record<string, unknown> } | undefined)?.staticData ?? {}) as Record<string, unknown>),
      },
    } as FileRouteOptions<TFilePath>)) as FileRouteFactory<TFilePath>;
}

export function createAppFileRoute<TFilePath extends RoutePath>(path: TFilePath) {
  return withRouteStaticData(path, {
    hostSurface: "app",
    appHostAccess: "protected",
  });
}

export function createAppPublicFileRoute<TFilePath extends RoutePath>(
  path: TFilePath,
) {
  return withRouteStaticData(path, {
    hostSurface: "app",
    appHostAccess: "public",
  });
}

export function createSiteFileRoute<TFilePath extends RoutePath>(path: TFilePath) {
  return withRouteStaticData(path, {
    hostSurface: "website",
    appHostAccess: "public",
  });
}

export function createSharedFileRoute<TFilePath extends RoutePath>(
  path: TFilePath,
) {
  return withRouteStaticData(path, {
    hostSurface: "shared",
    appHostAccess: "protected",
  });
}

export function createSharedPublicFileRoute<TFilePath extends RoutePath>(
  path: TFilePath,
) {
  return withRouteStaticData(path, {
    hostSurface: "shared",
    appHostAccess: "public",
  });
}
