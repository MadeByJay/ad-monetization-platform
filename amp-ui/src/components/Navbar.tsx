"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "../styles/components/navbar/navbar.module.css";

const links = [
  { href: "/", label: "Home" },
  { href: "/simulator", label: "Simulator" },
  { href: "/scenarios/preview", label: "Scenarios Preview" },
  { href: "/results", label: "Results" },
  { href: "http://localhost:4311/api/docs", label: "API Docs", external: true },
];

export default function Navbar() {
  const pathname = usePathname();
  return (
    <header
      className={`sticky top-0 z-40 ${styles.navBackdrop} border-b border-gray-200/70`}
    >
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-orange-400" />
          <div className="font-semibold">AMP</div>
        </div>
        <nav className="hidden md:flex items-center gap-6">
          {links.map((l) =>
            l.external ? (
              <a
                key={l.href}
                href={l.href}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-gray-700 hover:text-gray-900"
              >
                {l.label}
              </a>
            ) : (
              <Link
                key={l.href}
                href={l.href}
                className={`text-sm text-gray-700 hover:text-gray-900 ${pathname === l.href ? styles.activeLink : ""}`}
              >
                {l.label}
              </Link>
            ),
          )}
        </nav>
      </div>
    </header>
  );
}
