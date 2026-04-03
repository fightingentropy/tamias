"use client";

import { Dialog, DialogContent } from "@tamias/ui/dialog";
import dynamic from "@/framework/dynamic";
import { useConnectParams } from "@/hooks/use-connect-params";

const SelectBankAccountsContent = dynamic(
  () =>
    import("../select-bank-accounts-content").then(
      (mod) => mod.SelectBankAccountsContent,
    ),
  { ssr: false },
);

export function SelectBankAccountsModal() {
  const { step, setParams } = useConnectParams();

  const isOpen = step === "account";

  const onClose = () => {
    setParams(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        onPointerDownOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <div className="p-4">
          <SelectBankAccountsContent
            enabled={isOpen}
            onClose={onClose}
            stickySubmit={true}
            accountsListClassName="min-h-[280px]"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
