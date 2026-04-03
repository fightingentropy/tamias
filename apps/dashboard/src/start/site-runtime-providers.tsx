"use client";

import type { ReactNode } from "react";
import { DeferredToaster } from "@/components/deferred-toaster";
import { SiteProviders } from "@/site-providers";

export function SiteRuntimeProviders(props: { children: ReactNode }) {
  return (
    <SiteProviders locale="en">
      {props.children}
      <DeferredToaster />
    </SiteProviders>
  );
}
