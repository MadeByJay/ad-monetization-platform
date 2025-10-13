"use client";

import { useEffect, useState } from "react";

type Scenario = { id: string; name: string };

export default function SimulatorPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("");
  const [brandSafety, setBrandSafety] = useState<"G" | "PG" | "M" | "">("");
  const [runId, setRunId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/scenarios", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setScenarios(d.scenarios ?? []))
      .catch(() => setScenarios([]));
  }, []);

  async function startRun() {
    setBusy(true);
    setErrorText(null);
    setRunId(null);

    try {
      const payload: any = {};

      if (selectedScenarioId) payload.scenario_id = selectedScenarioId;

      if (brandSafety) payload.content_brand_safety = brandSafety;

      const res = await fetch("/api/simulate/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await res.text());

      const data = await res.json();

      setRunId(data.run_id);
    } catch (e: any) {
      setErrorText(e?.message ?? "Run failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 max-w-[720px]">
      <h1 className="text-2xl font-semibold">Simulator</h1>

      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm grid gap-3">
        <div>
          <div className="text-[12px] font-semibold mb-1 opacity-75">
            Scenario (optional)
          </div>
          <select
            value={selectedScenarioId}
            onChange={(e) => setSelectedScenarioId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          >
            <option value="">— None —</option>
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.id.slice(0, 8)}…)
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="text-[12px] font-semibold mb-1 opacity-75">
            Content brand safety (optional override)
          </div>
          <select
            value={brandSafety}
            onChange={(e) => setBrandSafety(e.target.value as any)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          >
            <option value="">— Inherit —</option>
            <option value="G">G</option>
            <option value="PG">PG</option>
            <option value="M">M</option>
          </select>
        </div>

        <div>
          <button
            onClick={startRun}
            disabled={busy}
            className="inline-flex items-center rounded-lg border border-blue-800 bg-blue-700 text-white px-3 py-2 shadow-sm hover:bg-blue-800"
          >
            {busy ? "Running…" : "Run Simulation"}
          </button>
        </div>

        {errorText && (
          <div className="border border-red-200 bg-red-50 text-red-800 rounded-lg px-3 py-2">
            {errorText}
          </div>
        )}
        {runId && (
          <div className="text-sm">
            Run started: <code className="font-mono">{runId}</code> —{" "}
            <a
              className="text-blue-700 hover:text-blue-800"
              href={`/results/${runId}`}
            >
              View Results
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
