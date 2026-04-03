"use client";

import { Button } from "@tamias/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@tamias/ui/dropdown-menu";
import { Icons } from "@tamias/ui/icons";
import { useToast } from "@tamias/ui/use-toast";
import { useTheme } from "@/components/theme-provider";

interface CanvasExportMenuProps {
  filename: string;
  title: string;
}

export function CanvasExportMenu({
  filename,
  title,
}: CanvasExportMenuProps) {
  const { resolvedTheme } = useTheme();
  const { toast } = useToast();

  const handleDownloadReport = async () => {
    try {
      const { generateCanvasPdf } = await import("@/utils/canvas-to-pdf");
      await generateCanvasPdf({
        filename,
        theme: resolvedTheme,
      });
    } catch {}
  };

  const handleShareReport = async () => {
    try {
      if (!navigator.share) {
        await handleDownloadReport();
        return;
      }

      const { generateCanvasPdfBlob } = await import("@/utils/canvas-to-pdf");
      const blob = await generateCanvasPdfBlob({
        filename,
        theme: resolvedTheme,
      });

      const file = new File([blob], filename, {
        type: "application/pdf",
      });

      await navigator.share({
        title,
        files: [file],
      });
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
    <DropdownMenu>
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
          Download
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
