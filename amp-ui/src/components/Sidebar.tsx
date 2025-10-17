"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PlaySquare,
  FileStack,
  BarChart2,
  Briefcase,
  FolderKanban,
  Film,
  Tv,
  FileText,
  Settings,
} from "lucide-react";
import { useMemo } from "react";

type NavigationItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  external?: boolean;
};

const NAVIGATION_ITEMS: NavigationItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/simulator", label: "Simulator", icon: PlaySquare },
  { href: "/scenarios/preview", label: "Scenarios", icon: FileStack },
  { href: "/results", label: "Results", icon: BarChart2 },
  { href: "/insertion-orders", label: "Insertion Orders", icon: Briefcase },
  { href: "/line-items", label: "Line Items", icon: FolderKanban },
  { href: "/inventory/movies", label: "Movies", icon: Film },
  { href: "/inventory/channels", label: "Channels", icon: Tv },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar({
  isCollapsed,
}: {
  /** Controlled: true = collapsed (icons only), false = expanded (icons + labels) */
  isCollapsed: boolean;
}) {
  const pathname = usePathname();

  const items = useMemo(() => NAVIGATION_ITEMS, []);

  return (
    <aside
      className={`h-screen sticky top-0 border-r border-gray-200 bg-white transition-[width] duration-200 ${
        isCollapsed ? "w-[64px]" : "w-[240px]"
      }`}
      aria-label="Sidebar navigation"
    >
      <div className="flex items-center gap-2 px-3 h-14 border-b border-gray-200">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-orange-400" />
        {!isCollapsed && <div className="font-semibold">AMP</div>}
      </div>

      <nav className="py-3">
        <ul className="grid gap-1">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const className =
              "flex items-center gap-3 mx-2 px-3 py-2 rounded-lg text-sm " +
              (isActive
                ? "bg-blue-50 text-blue-700"
                : "hover:bg-gray-50 text-gray-700");

            const content = (
              <>
                <Icon size={18} className="shrink-0" />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </>
            );

            return (
              <li key={item.href} title={isCollapsed ? item.label : undefined}>
                {item.external ? (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className={className}
                  >
                    {content}
                  </a>
                ) : (
                  <Link href={item.href} className={className}>
                    {content}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
