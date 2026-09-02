"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DashboardIcon, ScanIcon, RiskIcon, AssistantIcon } from "./icons";

const TABS = [
  { href: "/", label: "Dashboard", icon: DashboardIcon },
  { href: "/scan", label: "Scan", icon: ScanIcon },
  { href: "/risk-queue", label: "Risk Queue", icon: RiskIcon },
  { href: "/assistant", label: "Assistant", icon: AssistantIcon },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-20 grid grid-cols-4 border-t border-outline-variant bg-surface-container-lowest">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors ${
              active ? "text-primary-container" : "text-on-surface-variant"
            }`}
          >
            <span
              className={`flex h-9 w-14 items-center justify-center rounded-lg ${
                active ? "bg-primary-container text-on-primary" : ""
              }`}
            >
              <Icon width={20} height={20} />
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
