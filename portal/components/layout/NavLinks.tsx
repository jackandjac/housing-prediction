"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/cn";

export type NavItem = { href: string; label: string; exact?: boolean };

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** Navigation links with the current page marked (aria-current) for assistive tech. */
export function NavLinks({ items, variant }: { items: NavItem[]; variant: "main" | "sub" }) {
  const pathname = usePathname();
  return <NavList items={items} variant={variant} isCurrent={(i) => isActive(pathname, i)} />;
}

/** Same markup without the active state; used as the Suspense fallback. */
export function NavList({
  items,
  variant,
  isCurrent = () => false,
}: {
  items: NavItem[];
  variant: "main" | "sub";
  isCurrent?: (item: NavItem) => boolean;
}) {
  return (
    <ul className={cn("flex min-w-0 gap-1 overflow-x-auto", variant === "sub" && "-mb-px")}>
      {items.map((item) => {
        const current = isCurrent(item);
        return (
          <li key={item.href} className="shrink-0">
            <Link
              href={item.href}
              aria-current={current ? "page" : undefined}
              className={cn(
                "inline-flex items-center text-sm font-medium transition-colors",
                variant === "main" && "h-9 rounded-lg px-3",
                variant === "main" && (current ? "bg-surface-2 text-fg" : "text-muted hover:text-fg"),
                variant === "sub" && "h-11 border-b-2 px-3",
                variant === "sub" && (current ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"),
              )}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
