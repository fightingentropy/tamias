"use client";

import { Dialog, DialogContent } from "@tamias/ui/dialog";
import { Spinner } from "@tamias/ui/spinner";
import dynamic from "@/framework/dynamic";
import { useEffect } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { loadSearchModule, prefetchSearchModule } from "@/lib/search-module";
import { useSearchStore } from "@/store/search";
import { SearchFooter } from "./search-footer";

const Search = dynamic(() => loadSearchModule().then((mod) => mod.Search), {
  ssr: false,
  loading: () => (
    <div className="flex h-[495px] items-center justify-center border border-border bg-background backdrop-filter backdrop-blur-lg dark:bg-[#0C0C0C]/[99]">
      <Spinner size={18} />
    </div>
  ),
});

export function SearchModal() {
  const { isOpen, setOpen } = useSearchStore();

  useHotkeys(
    "meta+k",
    () => {
      prefetchSearchModule();
      setOpen();
    },
    {
      enableOnFormTags: true,
    },
  );

  useEffect(() => {
    if (isOpen) {
      prefetchSearchModule();
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent
        className="overflow-hidden p-0 max-w-full w-full md:max-w-[740px] h-[535px] m-0 select-text bg-transparent border-none"
        hideClose
      >
        {isOpen && (
          <>
            <Search />
            <SearchFooter />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
