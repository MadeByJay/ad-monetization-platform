"use client";

import styles from "../../../styles/components/preview/preview.module.css";
import { useEffect, useMemo, useState } from "react";

type Mix = {
  slots: { counts: Record<string, number>; pct: Record<string, number> };
  geo: { counts: Record<string, number>; pct: Record<string, number> };
  device: { counts: Record<string, number>; pct: Record<string, number> };
};

type PreviewResponse = {
  scenario_id: string | null;
  sample_size: number;
  slot_types_declared: string[];
  mix: Mix;
  sample: Array<{
    slotType: "preroll" | "midroll" | "display";
    user: { geo?: string; device?: "desktop" | "mobile"; userId?: string };
    content: { tags?: string[] };
    ts: string;
  }>;
};

type Scenario = { id: string; name: string };

export default function ScenariosPreviewPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("");
  const [sampleSize, setSampleSize] = useState<number | "">(40);
  const [seed, setSeed] = useState<number | "">("");
  const [useRawConfig, setUseRawConfig] = useState<boolean>(false);
  const [rawConfig, setRawConfig] = useState<string>("");

  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);

  const [brandSafety, setBrandSafety] = useState<"G" | "PG" | "M" | "">("");

  useEffect(() => {
    fetch("/api/scenarios", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setScenarios(data.scenarios ?? []))
      .catch(() => setScenarios([]));
  }, []);

  async function handlePreviewSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsLoading(true);
    setErrorText(null);
    setPreview(null);

    try {
      const payload: any = {
        sample_size: sampleSize === "" ? 30 : Number(sampleSize),
      };

      if (seed !== "") payload.seed = Number(seed);

      if (useRawConfig) {
        try {
          payload.config_json = JSON.parse(rawConfig);

          if (brandSafety) {
            payload.config_json = payload.config_json || {};
            payload.config_json.content = payload.config_json.content || {};
            payload.config_json.content.brandSafety = brandSafety;
          } else {
            payload.scenario_id = selectedScenarioId;
            if (brandSafety) payload.brand_safety = brandSafety;
          }
        } catch {
          setErrorText("Raw config JSON is invalid.");
          setIsLoading(false);
          return;
        }
      } else {
        if (!selectedScenarioId) {
          setErrorText("Please choose a scenario or provide a raw config.");
          setIsLoading(false);
          return;
        }
        payload.scenario_id = selectedScenarioId;
      }

      const response = await fetch("/api/scenarios/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(await response.text());
      const data = (await response.json()) as PreviewResponse;
      setPreview(data);
    } catch (error: any) {
      setErrorText(error?.message ?? "Preview failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="grid gap-4 max-w-[920px] mx-auto">
      <h1 className="mt-1 text-2xl font-semibold">Scenario Preview</h1>

      <form
        onSubmit={handlePreviewSubmit}
        className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm"
      >
        <div className="grid gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={useRawConfig}
              onChange={(e) => setUseRawConfig(e.target.checked)}
            />
            <span>Use raw config JSON instead of scenario</span>
          </label>

          {!useRawConfig ? (
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[220px] flex-1">
                <div className="text-[12px] font-semibold mb-1 opacity-75">
                  Scenario
                </div>
                <select
                  value={selectedScenarioId}
                  onChange={(e) => setSelectedScenarioId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                >
                  <option value="">— Select —</option>
                  {scenarios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.id.slice(0, 8)}…)
                    </option>
                  ))}
                </select>
              </div>

              <NumberField
                label="Sample size"
                value={sampleSize}
                min={1}
                onChange={setSampleSize}
              />
              <NumberField
                label="Seed (optional)"
                value={seed}
                min={0}
                onChange={setSeed}
              />
            </div>
          ) : (
            <>
              <NumberField
                label="Sample size"
                value={sampleSize}
                min={1}
                onChange={setSampleSize}
              />
              <NumberField
                label="Seed (optional)"
                value={seed}
                min={0}
                onChange={setSeed}
              />
              <div>
                <div className="text-[12px] font-semibold mb-1 opacity-75">
                  Content brand safety
                </div>
                <select
                  value={brandSafety}
                  onChange={(e) => setBrandSafety(e.target.value as any)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                >
                  <option value="">— Inherit / Default —</option>
                  <option value="G">G</option>
                  <option value="PG">PG</option>
                  <option value="M">M</option>
                </select>
              </div>
              <div>
                <div className="text-[12px] font-semibold mb-1 opacity-75">
                  Raw config JSON
                </div>
                <textarea
                  value={rawConfig}
                  onChange={(e) => setRawConfig(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono"
                  rows={8}
                  placeholder='{"content":{"placements":[{"slotType":"preroll"},{"slotType":"display"}]},"cohort":{"geoWeights":{"US":0.7,"IN":0.3},"deviceWeights":{"desktop":0.5,"mobile":0.5},"contentTags":["tech","news"]}}'
                />
              </div>
            </>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center rounded-lg border border-blue-800 bg-blue-700 text-white px-3 py-2 shadow-sm hover:bg-blue-800"
            >
              {isLoading ? "Generating…" : "Generate Preview"}
            </button>
          </div>
        </div>
      </form>

      {errorText && (
        <div className="border border-red-200 bg-red-50 text-red-800 rounded-lg px-3 py-2">
          {errorText}
        </div>
      )}

      {preview && (
        <div className="grid gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <h3 className="mt-0 text-lg font-semibold">Declared slot types</h3>
            <div>{preview.slot_types_declared.join(", ") || "—"}</div>
            <div className="text-[13px] opacity-80 mt-1">
              Sample size: {preview.sample_size} · Scenario:{" "}
              {preview.scenario_id ?? "(raw config)"}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ChartCard title="Slots (sample mix)">
              <BarChart
                counts={preview.mix.slots.counts}
                pct={preview.mix.slots.pct}
              />
            </ChartCard>
            <ChartCard title="Geo (sample mix)">
              <BarChart
                counts={preview.mix.geo.counts}
                pct={preview.mix.geo.pct}
              />
            </ChartCard>
            <ChartCard title="Device (sample mix)">
              <BarChart
                counts={preview.mix.device.counts}
                pct={preview.mix.device.pct}
              />
            </ChartCard>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <h3 className="mt-0 text-lg font-semibold">
              Sample opportunities (first 10)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="text-left font-semibold border-b border-gray-200 py-2 pr-3">
                      #
                    </th>
                    <th className="text-left font-semibold border-b border-gray-200 py-2 pr-3">
                      Slot
                    </th>
                    <th className="text-left font-semibold border-b border-gray-200 py-2 pr-3">
                      Geo
                    </th>
                    <th className="text-left font-semibold border-b border-gray-200 py-2 pr-3">
                      Device
                    </th>
                    <th className="text-left font-semibold border-b border-gray-200 py-2 pr-3">
                      Tags
                    </th>
                    <th className="text-left font-semibold border-b border-gray-200 py-2 pr-3">
                      Timestamp
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {preview.sample.slice(0, 10).map((row, index) => (
                    <tr key={index}>
                      <td className="border-b border-gray-100 py-2 pr-3">
                        {index + 1}
                      </td>
                      <td className="border-b border-gray-100 py-2 pr-3">
                        {row.slotType}
                      </td>
                      <td className="border-b border-gray-100 py-2 pr-3">
                        {row.user.geo ?? "NA"}
                      </td>
                      <td className="border-b border-gray-100 py-2 pr-3">
                        {row.user.device ?? "unknown"}
                      </td>
                      <td className="border-b border-gray-100 py-2 pr-3">
                        {(row.content.tags ?? []).join(", ")}
                      </td>
                      <td className="border-b border-gray-100 py-2 pr-3">
                        {new Date(row.ts).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NumberField(props: {
  label: string;
  value: number | "";
  min?: number;
  onChange: (n: number | "") => void;
}) {
  return (
    <div className="min-w-[180px]">
      <div className="text-[12px] font-semibold mb-1 opacity-75">
        {props.label}
      </div>
      <input
        type="number"
        value={props.value}
        min={props.min ?? 0}
        onChange={(e) => {
          const v = e.target.value;
          props.onChange(v === "" ? "" : Number(v));
        }}
        className="w-full rounded-lg border border-gray-300 px-3 py-2"
      />
    </div>
  );
}

function ChartCard(props: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <h3 className="mt-0 text-lg font-semibold">{props.title}</h3>
      {props.children}
    </div>
  );
}

function BarChart(props: {
  counts: Record<string, number>;
  pct: Record<string, number>;
}) {
  const rows = useMemo(() => {
    const labels = Object.keys(props.counts);
    const max = Math.max(1, ...labels.map((l) => props.counts[l] ?? 0));
    return labels
      .map((label) => ({
        label,
        count: props.counts[label] ?? 0,
        pct: props.pct[label] ?? 0,
        widthPct: ((props.counts[label] ?? 0) / max) * 100,
      }))
      .sort((a, b) => b.count - a.count);
  }, [props.counts, props.pct]);

  return (
    <div className="grid gap-2">
      {rows.length === 0 && <div className={styles.noData}>No data</div>}
      {rows.map((r) => (
        <div key={r.label} className={styles.barRow}>
          <div className="text-sm opacity-80">{r.label}</div>
          <div className={styles.barTrack}>
            <div
              className={styles.barFill}
              style={{ ["--bar-width" as any]: `${r.widthPct}%` }}
            />
          </div>
          <div className="text-sm text-right">
            {r.count} ({r.pct}%)
          </div>
        </div>
      ))}
    </div>
  );
}
