"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "../styles/components/navbar/navbar.module.css";

const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4311/api";
const apiDocsUrl =
  process.env.NEXT_PUBLIC_API_DOCS_URL ?? `${apiBase.replace(/\/$/, "")}/docs`;

const links = [
  { href: "/", label: "Home" },
  { href: "/simulator", label: "Simulator" },
  { href: "/scenarios/preview", label: "Scenarios Preview" },
  { href: "/results", label: "Results" },
  { href: apiDocsUrl, label: "API Docs", external: true },
];

function UserMenu() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setEmail(d.user?.email ?? null))
      .catch(() => setEmail(null));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    location.href = "/auth/login";
  }

  return (
    <div className="flex items-center gap-2">
      {email ? (
        <>
          <span className="text-sm opacity-80">{email}</span>
          <button
            onClick={logout}
            className="text-sm px-2 py-1 border rounded-lg hover:bg-gray-50"
          >
            Logout
          </button>
        </>
      ) : (
        <a className="text-sm" href="/auth/login">
          Login
        </a>
      )}
    </div>
  );
}

export default function Navbar() {
  return (
    <header
      className={`sticky top-0 z-40 border-b border-gray-200/70 ${styles?.navBackdrop ?? ""}`}
    >
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-orange-400" />
          <div className="font-semibold">AMP</div>
        </div>
        <nav className="hidden md:flex items-center gap-6">
          {links.map((link) =>
            link.external ? (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-gray-700 hover:text-gray-900"
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-gray-700 hover:text-gray-900"
              >
                {link.label}
              </Link>
            ),
          )}
        </nav>
        <UserMenu />
      </div>
    </header>
  );
}
