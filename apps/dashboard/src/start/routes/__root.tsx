import "@/start/html-element-shim";
import { Outlet, createRootRoute } from "@tanstack/react-router";
import { NotFoundPage } from "@/start/components/not-found-page";
import { StartRootShell } from "@/start/root-shell";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
      },
      {
        title: "Tamias",
      },
      {
        name: "description",
        content:
          "Automate financial tasks, stay organized, and make informed decisions effortlessly.",
      },
    ],
  }),
  notFoundComponent: RootNotFound,
  component: RootComponent,
});

function RootComponent() {
  return (
    <StartRootShell>
      <Outlet />
    </StartRootShell>
  );
}

function RootNotFound() {
  return <NotFoundPage />;
}
