import { Suspense } from "react";
import { NavLinks, NavList, type NavItem } from "./NavLinks";

/** usePathname suspends on dynamic routes under Cache Components, so render a static fallback first. */
export function Nav({ items, variant, label }: { items: NavItem[]; variant: "main" | "sub"; label: string }) {
  return (
    <nav aria-label={label} className="min-w-0">
      <Suspense fallback={<NavList items={items} variant={variant} />}>
        <NavLinks items={items} variant={variant} />
      </Suspense>
    </nav>
  );
}
