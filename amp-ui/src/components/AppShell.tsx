"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import AdvancedFiltersDrawer from "@/components/AdvancedFiltersDrawer";

const SIDEBAR_STORAGE_KEY = "amp_sidebar_collapsed";

function Header({
  onToggleSidebar,
  onOpenFilters,
}: {
  onToggleSidebar: () => void;
  onOpenFilters: () => void;
}) {
  return (
    <header className="h-14 border-b border-gray-200 bg-white sticky top-0 z-30">
      <div className="h-full max-w-6xl mx-auto flex items-center gap-3 px-4">
        <button
          aria-label="Toggle navigation"
          onClick={onToggleSidebar}
          className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50"
        >
          <span className="block w-4 h-0.5 bg-gray-800 mb-1" />
          <span className="block w-4 h-0.5 bg-gray-800 mb-1" />
          <span className="block w-4 h-0.5 bg-gray-800" />
        </button>
        <div className="flex-1" />
        <button
          className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 hover:bg-gray-50"
          onClick={onOpenFilters}
        >
          Filters
        </button>
      </div>
    </header>
  );
}

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (saved != null) setIsCollapsed(saved === "true");
    } catch {}
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(isCollapsed));
    } catch {}
  }, [isCollapsed, isHydrated]);

  return (
    <div className="flex">
      <Sidebar isCollapsed={isCollapsed} />

      <div className="flex-1 min-h-screen bg-gray-50">
        <Header
          onToggleSidebar={() => setIsCollapsed((value) => !value)}
          onOpenFilters={() => setIsFiltersOpen(true)}
        />
        <main className="p-4 max-w-6xl mx-auto">{children}</main>
      </div>

      <AdvancedFiltersDrawer
        open={isFiltersOpen}
        onClose={() => setIsFiltersOpen(false)}
        resultsCountLabel={""}
      />
    </div>
  );
}
