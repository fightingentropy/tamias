"use client";

import dynamic from "@/framework/dynamic";
import { ArtifactTabs } from "../artifact-tabs";

interface CanvasHeaderProps {
  title: string;
}

const CanvasExportMenu = dynamic(
  () => import("./canvas-export-menu").then((mod) => mod.CanvasExportMenu),
  { ssr: false },
);

export function CanvasHeader({ title }: CanvasHeaderProps) {
  const filename = `${title.toLowerCase().replace(/\s+/g, "-")}-report.pdf`;

  return (
    <div className="flex items-center justify-between bg-gray-50 dark:bg-[#131313]">
      <ArtifactTabs />

      <div className="flex justify-end mr-1.5">
        <CanvasExportMenu filename={filename} title={title} />
      </div>
    </div>
  );
}
