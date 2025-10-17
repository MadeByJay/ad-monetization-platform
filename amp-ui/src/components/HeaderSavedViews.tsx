"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type SavedView = { name: string; queryString: string };
const STORAGE_KEY = "amp_saved_views";

export default function HeaderSavedViews() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [savedViews, setSavedViews] = useState<SavedView[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setSavedViews(raw ? JSON.parse(raw) : []);
    } catch {
      setSavedViews([]);
    }
  }, []);

  function saveCurrent() {
    const name = prompt("Name this view");

    if (!name) return;

    const next = [
      ...savedViews,
      { name, queryString: searchParams.toString() },
    ];

    setSavedViews(next);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  }

  function apply(index: number) {
    const view = savedViews[index];

    if (!view) return;

    router.push(`${pathname}?${view.queryString}`);
  }

  function remove(index: number) {
    const next = savedViews.filter((_, i) => i !== index);
    setSavedViews(next);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  }

  return (
    <div className="relative">
      <details>
        <summary className="cursor-pointer text-sm px-2 py-1 border rounded-lg hover:bg-gray-50">
          Views
        </summary>
        <div className="absolute right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-sm min-w-[240px] p-2 z-10">
          <div className="flex items-center justify-between px-2 py-1">
            <div className="text-sm font-semibold">Saved Views</div>
            <button
              className="text-xs px-2 py-0.5 border rounded-lg hover:bg-gray-50"
              onClick={saveCurrent}
            >
              Save current
            </button>
          </div>
          {savedViews.length === 0 && (
            <div className="text-sm opacity-75 px-2 py-1">No saved views</div>
          )}
          {savedViews.map((v, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-2 px-2 py-1"
            >
              <button
                className="text-sm text-blue-700 hover:text-blue-800"
                onClick={() => apply(i)}
              >
                {v.name}
              </button>
              <button
                className="text-xs px-2 py-0.5 border rounded-lg hover:bg-gray-50"
                onClick={() => remove(i)}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
