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
          onClick={() => setOpen(true)}
          className="rounded-full w-8 h-8 items-center relative flex md:hidden"
        >
          <MenuIcon size={16} />
        </Button>
      </div>
      <SheetContent side="left" className="border-none rounded-none -ml-4">
        <div className="ml-2 mb-8">
          <Link href="/dashboard" onClick={() => setOpen(false)}>
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
