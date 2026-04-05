import { createFileRoute } from "@tanstack/react-router";
import type { FileRoutesByPath } from "@tanstack/react-router";

export type RouteAppHostAccess = "public" | "protected";

export type StartRouteStaticData = {
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
  appHostAccess: RouteAppHostAccess,
): FileRouteFactory<TFilePath> {
  const fileRoute = createFileRoute(path);

  return ((options?: FileRouteOptions<TFilePath>) =>
    fileRoute({
      ...(options as object),
      staticData: {
        appHostAccess,
        ...(((options as { staticData?: Record<string, unknown> } | undefined)?.staticData ?? {}) as Record<string, unknown>),
      },
    } as FileRouteOptions<TFilePath>)) as FileRouteFactory<TFilePath>;
}

export function createAppFileRoute<TFilePath extends RoutePath>(path: TFilePath) {
  return withRouteStaticData(path, "protected");
}

export function createAppPublicFileRoute<TFilePath extends RoutePath>(
  path: TFilePath,
) {
  return withRouteStaticData(path, "public");
}
