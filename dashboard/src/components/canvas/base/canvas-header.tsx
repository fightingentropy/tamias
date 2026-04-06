"use client";

import { ArtifactTabs } from "../artifact-tabs";
import { CanvasExportTrigger } from "./canvas-export-trigger";

interface CanvasHeaderProps {
  title: string;
}

export function CanvasHeader({ title }: CanvasHeaderProps) {
  const filename = `${title.toLowerCase().replace(/\s+/g, "-")}-report.pdf`;

  return (
    <div className="flex items-center justify-between bg-gray-50 dark:bg-[#131313]">
      <ArtifactTabs />

      <div className="flex justify-end mr-1.5">
        <CanvasExportTrigger filename={filename} title={title} />
      </div>
    </div>
  );
}
