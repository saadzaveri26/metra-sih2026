"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DashboardIcon, ScanIcon, RiskIcon, AssistantIcon, HistoryIcon } from "./icons";
import Avatar from "./Avatar";

const TABS = [
  { href: "/", label: "Dashboard", icon: DashboardIcon },
  { href: "/scan", label: "Scan", icon: ScanIcon },
  { href: "/history", label: "History", icon: HistoryIcon },
  { href: "/risk-queue", label: "Risk Queue", icon: RiskIcon },
  { href: "/assistant", label: "Assistant", icon: AssistantIcon },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <>
      {/* ── Mobile: bottom tab bar ── */}
      <nav className="lg:hidden sticky bottom-0 z-20 grid grid-cols-5 border-t border-outline-variant bg-surface-container-lowest">
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

      {/* ── Desktop: left sidebar ── */}
      <nav className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 lg:border-r lg:border-outline-variant lg:bg-surface-container-lowest lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
        {/* Brand */}
        <div className="flex items-center gap-3 border-b border-outline-variant px-5 py-5">
          <Avatar state="closeup" className="h-9 w-9 rounded-full object-cover object-top border border-outline-variant" />
          <span className="text-xl font-bold tracking-tight text-primary-container">
            METRA
          </span>
        </div>

        {/* Nav items */}
        <ul className="flex flex-col gap-1 p-3 flex-1">
          {TABS.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                    active
                      ? "bg-primary-container text-on-primary"
                      : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                  }`}
                >
                  <Icon width={20} height={20} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Footer */}
        <div className="border-t border-outline-variant px-5 py-4">
          <p className="label-caps text-on-surface-variant">Legal Metrology</p>
          <p className="text-xs text-on-surface-variant opacity-60">
            Packaged Commodities Rules 2011
          </p>
        </div>
      </nav>
    </>
  );
}
