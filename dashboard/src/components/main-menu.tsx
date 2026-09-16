"use client";

import { cn } from "@tamias/ui/cn";
import Link from "@/framework/link";
import { usePathname } from "@/framework/navigation";
import { useState } from "react";
import { useChatInterface } from "@/hooks/use-chat-interface";
import { useNavPrefetch } from "@/hooks/use-nav-prefetch";
import {
  AppsNavIcon,
  ChevronDownIcon,
  CustomersNavIcon,
  InboxNavIcon,
  InvoiceNavIcon,
  OverviewIcon,
  ReportsNavIcon,
  SettingsNavIcon,
  TaxIcon,
  TrackerNavIcon,
  TransactionsNavIcon,
  VaultNavIcon,
} from "@/start/components/app-shell-icons";

const icons = {
  "/dashboard": () => <OverviewIcon size={20} />,
  "/reports": () => <ReportsNavIcon size={20} />,
  "/compliance": () => <TaxIcon size={20} />,
  "/transactions": () => <TransactionsNavIcon size={20} />,
  "/invoices": () => <InvoiceNavIcon size={20} />,
  "/tracker": () => <TrackerNavIcon size={20} />,
  "/customers": () => <CustomersNavIcon size={20} />,
  "/vault": () => <VaultNavIcon size={20} />,
  "/settings": () => <SettingsNavIcon size={20} />,
  "/apps": () => <AppsNavIcon size={20} />,
  "/inbox": () => <InboxNavIcon size={20} />,
} as const;

const baseItems = [
  {
    path: "/dashboard",
    name: "Dashboard",
  },
  {
    path: "/reports",
    name: "Reports",
  },
  {
    path: "/transactions",
    name: "Transactions",
    children: [
      {
        path: "/transactions/categories",
        name: "Categories",
      },
      {
        path: "/transactions?step=connect",
        name: "Connect bank",
      },
      {
        path: "/transactions?step=import&hide=true",
        name: "Import",
      },
      { path: "/transactions?createTransaction=true", name: "Create new" },
    ],
  },
  {
    path: "/inbox",
    name: "Receipts",
    children: [{ path: "/inbox/settings", name: "Settings" }],
  },
  {
    path: "/invoices",
    name: "Invoices",
    children: [
      { path: "/invoices/products", name: "Products" },
      { path: "/invoices?type=create", name: "Create new" },
    ],
  },
  {
    path: "/tracker",
    name: "Time tracking",
    children: [{ path: "/tracker?create=true", name: "Create new" }],
  },
  {
    path: "/customers",
    name: "Customers",
    children: [{ path: "/customers?createCustomer=true", name: "Create new" }],
  },
  {
    path: "/vault",
    name: "Vault",
  },
  {
    path: "/apps",
    name: "Apps",
    children: [
      { path: "/apps", name: "All" },
      { path: "/apps?tab=installed", name: "Installed" },
    ],
  },
  {
    path: "/settings",
    name: "Settings",
    children: [
      { path: "/settings", name: "General" },
      { path: "/settings/billing", name: "Billing" },
      { path: "/settings/accounts", name: "Bank Connections" },
      { path: "/settings/members", name: "Members" },
      { path: "/settings/notifications", name: "Notifications" },
      { path: "/settings/developer", name: "Developer" },
    ],
  },
];

interface ItemProps {
  item: {
    path: string;
    name: string;
    children?: { path: string; name: string }[];
  };
  isActive: boolean;
  isExpanded: boolean;
  isItemExpanded: boolean;
  onToggle: (path: string) => void;
  onSelect?: () => void;
  onPrefetch?: () => void;
}

const Item = ({
  item,
  isActive,
  isExpanded,
  isItemExpanded,
  onToggle,
  onSelect,
  onPrefetch,
}: ItemProps) => {
  const Icon = icons[item.path as keyof typeof icons];
  const pathname = usePathname();
  const showChildren = isExpanded && isItemExpanded && !!item.children?.length;

  return (
    <div>
      <div
        className={cn(
          "mx-3 flex min-h-10 items-center transition-colors hover:bg-accent",
          isActive && "bg-accent",
        )}
      >
        <Link
          href={item.path}
          prefetch
          onPrefetch={onPrefetch}
          onClick={() => onSelect?.()}
          aria-label={item.name}
          aria-current={isActive ? "page" : undefined}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground",
            !isExpanded && "justify-center px-0",
            isActive && "font-medium text-foreground",
          )}
        >
          <span className="shrink-0" aria-hidden="true">
            <Icon />
          </span>
          {isExpanded && <span className="truncate">{item.name}</span>}
        </Link>
        {isExpanded && !!item.children?.length && (
          <button
            type="button"
            onClick={() => onToggle(item.path)}
            aria-label={`${showChildren ? "Collapse" : "Expand"} ${item.name} menu`}
            aria-expanded={!!showChildren}
            className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <span className={cn("transition-transform", showChildren && "rotate-180")}>
              <ChevronDownIcon size={16} />
            </span>
          </button>
        )}
      </div>
      {showChildren && (
        <div className="ml-[34px] mr-3 my-1 border-l border-border">
          {item.children!.map((child) => (
            <Link
              key={child.path}
              href={child.path}
              prefetch
              onClick={() => onSelect?.()}
              aria-current={pathname === child.path ? "page" : undefined}
              className={cn(
                "block py-2 pl-6 pr-2 text-sm text-muted-foreground hover:text-foreground",
                pathname === child.path && "font-medium text-foreground",
              )}
            >
              {child.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

type Props = {
  onSelect?: () => void;
  isExpanded?: boolean;
};

export function MainMenu({ onSelect, isExpanded = false }: Props) {
  const pathname = usePathname();
  const { isChatPage } = useChatInterface();
  const prefetchRoute = useNavPrefetch();
  const part = pathname?.split("/")[1];
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const items = [
    ...baseItems.slice(0, 7),
    {
      path: "/compliance",
      name: "Tax",
      children: [
        { path: "/compliance/vat", name: "VAT" },
        { path: "/compliance/settings", name: "Settings" },
        { path: "/compliance/year-end", name: "Year-end" },
        { path: "/compliance/payroll", name: "Payroll" },
      ],
    },
    ...baseItems.slice(7),
  ];

  return (
    <div className="py-5 w-full">
      <nav className="w-full" aria-label="Main navigation">
        <div className="flex flex-col gap-1">
          {items.map((item) => {
            // Check if current path matches item path or is a child of it
            // Chat pages (/chat/*) should highlight Dashboard
            const isActive =
              (pathname === "/dashboard" && item.path === "/dashboard") ||
              (item.path === "/dashboard" && isChatPage) ||
              (pathname !== "/dashboard" && !isChatPage && item.path.startsWith(`/${part}`));

            return (
              <Item
                key={item.path}
                item={item}
                isActive={isActive}
                isExpanded={isExpanded}
                isItemExpanded={expandedItem === item.path}
                onToggle={(path) => {
                  setExpandedItem(expandedItem === path ? null : path);
                }}
                onSelect={onSelect}
                onPrefetch={() => prefetchRoute(item.path)}
              />
            );
          })}
        </div>
      </nav>
    </div>
  );
}
