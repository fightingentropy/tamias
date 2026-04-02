"use client";

import dynamic from "@/framework/dynamic";

const Toaster = dynamic(
  () => import("@tamias/ui/toaster").then((mod) => mod.Toaster),
  { ssr: false },
);

export function DeferredToaster() {
  return <Toaster />;
}
