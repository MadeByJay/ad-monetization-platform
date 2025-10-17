"use client";

import { useEffect, useState } from "react";

type SeparationRule = { category: string; min_separation_min: number };
type PolicyPayload = {
  category_exclusions: { category: string }[];
  competitive_separation: SeparationRule[];
};

export default function PolicyEditor({ lineItemId }: { lineItemId: string }) {
  const [isLoading, setIsLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);

  const [categoriesInput, setCategoriesInput] = useState(""); // comma-separated e.g. "alcohol,gambling"
  const [rules, setRules] = useState<SeparationRule[]>([]);
  const [newRuleCategory, setNewRuleCategory] = useState("");
  const [newRuleMinutes, setNewRuleMinutes] = useState<number | "">("");

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setErrorText(null);
      try {
        const res = await fetch(
          `/api/line-items/${lineItemId}/policy/category_exclusions`,
          { cache: "no-store" },
        );
        const data: PolicyPayload = await res.json();
        const excl = data?.category_exclusions?.map((e) => e.category) ?? [];
        setCategoriesInput(excl.join(","));
        setRules(data?.competitive_separation ?? []);
      } catch (e: any) {
        setErrorText(e?.message ?? "Failed to load policy");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [lineItemId]);

  async function saveCategoryExclusions() {
    const categories = categoriesInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const res = await fetch(
      `/api/line-items/${lineItemId}/policy/category_exclusions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ categories }),
      },
    );
    if (!res.ok) setErrorText(await res.text());
  }

  function addRule() {
    if (
      !newRuleCategory ||
      newRuleMinutes === "" ||
      Number(newRuleMinutes) <= 0
    )
      return;
    setRules((prev) => [
      ...prev,
      { category: newRuleCategory, min_separation_min: Number(newRuleMinutes) },
    ]);
    setNewRuleCategory("");
    setNewRuleMinutes("");
  }

  async function saveSeparation() {
    const res = await fetch(
      `/api/line-items/${lineItemId}/policy/competitive_separation`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rules }),
      },
    );
    if (!res.ok) setErrorText(await res.text());
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm grid gap-4">
      <div className="text-lg font-semibold">Policy</div>
      {isLoading && <div>Loading…</div>}
      {errorText && (
        <div className="border border-red-200 bg-red-50 text-red-800 rounded-lg px-3 py-2">
          {errorText}
        </div>
      )}

      <div className="grid gap-2">
        <div className="text-sm font-semibold">Category exclusions</div>
        <div className="text-xs opacity-70">
          Comma-separated (e.g., <code>alcohol,gambling</code>)
        </div>
        <input
          value={categoriesInput}
          onChange={(e) => setCategoriesInput(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2"
          placeholder="alcohol,gambling"
        />
        <div>
          <button
            onClick={saveCategoryExclusions}
            className="text-sm px-2 py-1 border rounded-lg hover:bg-gray-50"
          >
            Save exclusions
          </button>
        </div>
      </div>

      <div className="grid gap-2">
        <div className="text-sm font-semibold">Competitive separation</div>
        <div className="grid md:grid-cols-3 gap-2">
          <input
            value={newRuleCategory}
            onChange={(e) => setNewRuleCategory(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2"
            placeholder="category (e.g., soft-drink)"
          />
          <input
            type="number"
            value={newRuleMinutes === "" ? "" : Number(newRuleMinutes)}
            onChange={(e) =>
              setNewRuleMinutes(
                e.target.value === "" ? "" : Number(e.target.value),
              )
            }
            className="rounded-lg border border-gray-300 px-3 py-2"
            placeholder="minutes (e.g., 3)"
            min={1}
          />
          <button
            onClick={addRule}
            className="text-sm px-2 py-1 border rounded-lg hover:bg-gray-50"
          >
            Add rule
          </button>
        </div>

        <div className="grid gap-1">
          {rules.length === 0 && (
            <div className="text-sm opacity-70">
              No competitive separation rules
            </div>
          )}
          {rules.map((r, idx) => (
            <div
              key={`${r.category}-${idx}`}
              className="flex items-center justify-between border rounded-lg px-3 py-2"
            >
              <div className="text-sm">
                <strong>{r.category}</strong> — {r.min_separation_min} min
              </div>
              <button
                className="text-xs px-2 py-0.5 border rounded-lg hover:bg-gray-50"
                onClick={() =>
                  setRules((prev) => prev.filter((_, i) => i !== idx))
                }
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <div>
          <button
            onClick={saveSeparation}
            className="text-sm px-2 py-1 border rounded-lg hover:bg-gray-50"
          >
            Save competitive separation
          </button>
        </div>
      </div>
    </div>
  );
}
