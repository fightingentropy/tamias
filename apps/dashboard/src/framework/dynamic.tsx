"use client";

import type { ComponentType } from "react";
import { lazy, Suspense, useEffect, useState } from "react";

type DynamicModule<P> =
  | ComponentType<P>
  | {
      default: ComponentType<P>;
    };

type DynamicOptions = {
  ssr?: boolean;
  loading?: ComponentType;
};

function normalizeModule<P>(module: DynamicModule<P>) {
  if (typeof module === "function") {
    return { default: module };
  }

  return module;
}

export default function dynamic<P>(
  loader: () => Promise<DynamicModule<P>>,
  options: DynamicOptions = {},
) {
  const LazyComponent = lazy(async () => normalizeModule(await loader()));
  const LoadingComponent = options.loading;
  const ResolvedLazyComponent = LazyComponent as ComponentType<P>;

  function DynamicComponent(props: P) {
    const [mounted, setMounted] = useState(options.ssr !== false);

    useEffect(() => {
      if (options.ssr === false) {
        setMounted(true);
      }
    }, []);

    if (!mounted) {
      return LoadingComponent ? <LoadingComponent /> : null;
    }

    return (
      <Suspense fallback={LoadingComponent ? <LoadingComponent /> : null}>
        <ResolvedLazyComponent {...(props as any)} />
      </Suspense>
    );
  }

  DynamicComponent.displayName = "DynamicComponent";

  return DynamicComponent;
}
