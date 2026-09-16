"use client";

import { Button } from "@tamias/ui/button";
import { Sheet, SheetContent } from "@tamias/ui/sheet";
import Link from "@/framework/link";
import { useState } from "react";
import { LogoSmallIcon, MenuIcon } from "@/start/components/app-shell-icons";
import { MainMenu } from "./main-menu";

export function MobileMenu() {
  const [isOpen, setOpen] = useState(false);

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      <div>
        <Button
          variant="outline"
          size="icon"
          aria-label="Open navigation"
          onClick={() => setOpen(true)}
          className="rounded-full w-8 h-8 items-center relative flex md:hidden"
        >
          <MenuIcon size={16} />
        </Button>
      </div>
      <SheetContent
        side="left"
        title="Navigation"
        className="border-none rounded-none overflow-y-auto"
      >
        <div className="ml-2 mb-8">
          <Link href="/dashboard" aria-label="Tamias home" onClick={() => setOpen(false)}>
            <LogoSmallIcon />
          </Link>
        </div>

        <div className="-ml-2">
          <MainMenu onSelect={() => setOpen(false)} isExpanded={true} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
