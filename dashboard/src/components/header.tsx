import { Skeleton } from "@tamias/ui/skeleton";
import { Suspense } from "react";
import { Trial } from "@/components/trial";
import { UserMenu } from "@/components/user-menu";
import dynamic from "@/framework/dynamic";

const ConnectionStatus = dynamic(
  () => import("@/components/connection-status").then((m) => m.ConnectionStatus),
);
const NotificationCenter = dynamic(
  () =>
    import("@/components/notification-center").then((m) => m.NotificationCenter),
);
const OpenSearchButton = dynamic(
  () =>
    import("@/components/search/open-search-button").then(
      (m) => m.OpenSearchButton,
    ),
  {
    loading: () => (
      <div className="hidden md:flex w-40 lg:w-64 h-8 rounded-md border border-transparent" />
    ),
  },
);
const MobileMenu = dynamic(() => import("./mobile-menu").then((m) => m.MobileMenu));

function UserMenuSkeleton() {
  return <Skeleton className="w-8 h-8 rounded-full" />;
}

export function Header() {
  return (
    <header
      className="md:m-0 z-50 px-6 md:border-b h-[70px] flex justify-between items-center top-0 backdrop-filter backdrop-blur-xl md:backdrop-filter md:backdrop-blur-none bg-background bg-opacity-70 transition-transform"
      style={{
        transform: "translateY(calc(var(--header-offset, 0px) * -1))",
        transitionDuration: "var(--header-transition, 200ms)",
        willChange: "transform",
      }}
    >
      <MobileMenu />

      <OpenSearchButton />

      <div className="flex space-x-2 ml-auto">
        <Suspense>
          <Trial />
        </Suspense>
        <ConnectionStatus />
        <NotificationCenter />
        <Suspense fallback={<UserMenuSkeleton />}>
          <UserMenu />
        </Suspense>
      </div>
    </header>
  );
}
