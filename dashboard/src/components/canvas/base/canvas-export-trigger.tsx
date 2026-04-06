"use client";

import { useEffect, useState } from "react";

type CanvasExportMenuProps = {
  filename: string;
  title: string;
  defaultOpen?: boolean;
  onDefaultOpenConsumed?: () => void;
};

type CanvasExportMenuComponent = React.ComponentType<CanvasExportMenuProps>;

let canvasExportMenuPromise: Promise<{ CanvasExportMenu: CanvasExportMenuComponent }> | undefined;
let loadedCanvasExportMenu: CanvasExportMenuComponent | undefined;

async function loadCanvasExportMenu() {
  if (loadedCanvasExportMenu) {
    return loadedCanvasExportMenu;
  }

  canvasExportMenuPromise ??= import("./canvas-export-menu");

  const module = await canvasExportMenuPromise;
  loadedCanvasExportMenu = module.CanvasExportMenu;

  return loadedCanvasExportMenu;
}

function MoreVerticalIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[15px] w-[15px] fill-current">
      <path d="M12 7.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm0 6a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm0 6a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
    </svg>
  );
}

interface CanvasExportTriggerProps {
  filename: string;
  title: string;
}

export function CanvasExportTrigger({ filename, title }: CanvasExportTriggerProps) {
  const [MenuComponent, setMenuComponent] = useState<CanvasExportMenuComponent | null>(
    loadedCanvasExportMenu ?? null,
  );
  const [defaultOpen, setDefaultOpen] = useState(false);

  const ensureMenuLoaded = async () => {
    if (MenuComponent) {
      return MenuComponent;
    }

    const component = await loadCanvasExportMenu();
    setMenuComponent(() => component);
    return component;
  };

  const prefetchMenu = () => {
    void ensureMenuLoaded();
  };

  const handleInitialOpen = async () => {
    if (MenuComponent) {
      return;
    }

    setDefaultOpen(true);
    await ensureMenuLoaded();
  };

  useEffect(() => {
    if (MenuComponent && defaultOpen) {
      setDefaultOpen(false);
    }
  }, [MenuComponent, defaultOpen]);

  if (MenuComponent) {
    return (
      <MenuComponent
        filename={filename}
        title={title}
        defaultOpen={defaultOpen}
        onDefaultOpenConsumed={() => setDefaultOpen(false)}
      />
    );
  }

  return (
    <button
      type="button"
      aria-label={`Export ${title} report`}
      className="inline-flex h-6 w-6 items-center justify-center rounded-md p-0 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
      onPointerEnter={prefetchMenu}
      onFocus={prefetchMenu}
      onTouchStart={prefetchMenu}
      onClick={() => {
        void handleInitialOpen();
      }}
    >
      <MoreVerticalIcon />
    </button>
  );
}
