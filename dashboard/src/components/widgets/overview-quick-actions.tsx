"use client";

import { Button } from "@tamias/ui/button";
import { Icons } from "@tamias/ui/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@tamias/ui/dropdown-menu";
import Link from "@/framework/link";

const actions = [
  {
    label: "Add transaction",
    icon: Icons.Transactions,
    href: "/transactions?createTransaction=true",
  },
  { label: "Upload receipt", icon: Icons.ReceiptLong, href: "/inbox" },
  { label: "Create invoice", icon: Icons.Invoice, href: "/invoices?type=create" },
] as const;

export function OverviewQuickActions() {
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {actions.map((action, index) => (
        <Button key={action.href} asChild variant={index === 0 ? "default" : "outline"}>
          <Link href={action.href}>
            <action.icon className="mr-2 size-4" aria-hidden="true" />
            {action.label}
          </Link>
        </Button>
      ))}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost">More actions</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem asChild>
            <Link href="/customers?createCustomer=true">Add customer</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/tracker?create=true">Track time</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
