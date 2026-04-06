"use client";

import { cn } from "@tamias/ui/cn";
import { Icons } from "@tamias/ui/icons";
import { useRouter } from "@/framework/navigation";

const actions = [
  {
    label: "Create Invoice",
    icon: Icons.Invoice,
    href: "/invoices?type=create",
  },
  {
    label: "Add Transaction",
    icon: Icons.Transactions,
    href: "/transactions?createTransaction=true",
  },
  {
    label: "Add Customer",
    icon: Icons.Customers,
    href: "/customers?createCustomer=true",
  },
  {
    label: "Track Time",
    icon: Icons.Tracker,
    href: "/tracker?create=true",
  },
  {
    label: "Upload Receipt",
    icon: Icons.ReceiptLong,
    href: "/inbox",
  },
];

export function OverviewQuickActions() {
  const router = useRouter();

  return (
    <div className="mb-6 flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0 justify-center">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.label}
            type="button"
            className={cn(
              "border border-[#e6e6e6] dark:border-[#1d1d1d]",
              "hover:bg-[#f7f7f7] hover:border-[#d0d0d0]",
              "dark:hover:bg-[#131313] dark:hover:border-[#2a2a2a]",
              "px-3 py-2 flex items-center gap-2 cursor-pointer",
              "transition-all duration-300 min-w-fit whitespace-nowrap flex-shrink-0",
            )}
            onClick={() => router.push(action.href)}
          >
            <Icon className="w-4 h-4 text-[#707070] dark:text-[#666666]" />
            <span className="text-black dark:text-white text-[12px] font-medium">
              {action.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
