"use client";

import { cn } from "@tamias/ui/cn";
import Link from "@/framework/link";
import { usePathname } from "@/framework/navigation";

type Item = {
  path: string;
  label: string;
};

type Props = {
  items: Item[];
};

export function SecondaryMenu({ items }: Props) {
  const pathname = usePathname();

  return (
    <nav className="py-4">
      <ul className="flex space-x-6 text-sm overflow-auto scrollbar-hide">
        {items.map((item) => (
          <Link
            key={item.path}
            href={item.path}
            prefetch
            className={cn(
              "text-[#606060]",
              pathname === item.path && "text-primary font-medium underline underline-offset-8",
            )}
          >
            <span>{item.label}</span>
          </Link>
        ))}
      </ul>
    </nav>
  );
}
