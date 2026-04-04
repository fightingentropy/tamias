"use client";

import { useEffect } from "react";
import { Button } from "@tamias/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@tamias/ui/dropdown-menu";
import { Icons } from "@tamias/ui/icons";
import { useToast } from "@tamias/ui/use-toast";

interface CanvasExportMenuProps {
  filename: string;
  title: string;
  defaultOpen?: boolean;
  onDefaultOpenConsumed?: () => void;
}

export function CanvasExportMenu({
  filename,
  title,
  defaultOpen = false,
  onDefaultOpenConsumed,
}: CanvasExportMenuProps) {
  const { toast } = useToast();

  useEffect(() => {
    if (defaultOpen) {
      onDefaultOpenConsumed?.();
    }
  }, [defaultOpen, onDefaultOpenConsumed]);

  const handleDownloadReport = async () => {
    try {
      const { printCanvasReport } = await import("@/utils/canvas-export");
      await printCanvasReport({
        filename,
        title,
      });
    } catch {}
  };

  const handleShareReport = async () => {
    try {
      const { shareCanvasReport } = await import("@/utils/canvas-export");
      const didShare = await shareCanvasReport({
        filename,
        title,
      });

      if (!didShare) {
        await handleDownloadReport();
      }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        toast({
          duration: 2500,
          title: "Failed to share report",
          description: "Please try downloading the report instead.",
        });
      }
    }
  };

  return (
    <DropdownMenu defaultOpen={defaultOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="p-0 h-6 w-6">
          <Icons.MoreVertical size={15} className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleShareReport} className="text-xs">
          Share
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDownloadReport} className="text-xs">
          Save as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
