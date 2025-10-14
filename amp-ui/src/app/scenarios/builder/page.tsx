"use client";

import { useEffect, useState } from "react";
import css from "@/styles/components/scenarios/builder.module.css";

type Scenario = { id: string; name: string; config_json: any };
type Placement = {
  slotType: "preroll" | "midroll" | "display";
  [k: string]: any;
};

export default function ScenarioBuilderPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedId, setSelectedId] = useState<string>(""); // edit target
  const [name, setName] = useState("");
  const [brandSafety, setBrandSafety] = useState<"G" | "PG" | "M">("G");
  const [placements, setPlacements] = useState<Placement[]>([
    { slotType: "display" },
  ]);
  const [geoWeights, setGeoWeights] = useState<string>(
    '{"US":0.6,"IN":0.2,"GB":0.1,"CA":0.1}',
  );
  const [deviceWeights, setDeviceWeights] = useState<string>(
    '{"desktop":0.5,"mobile":0.5}',
  );
  const [contentTags, setContentTags] = useState<string>('["tech","news"]');
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [preview, setPreview] = useState<any | null>(null);

  useEffect(() => {
    fetch("/api/scenarios", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setScenarios(d.scenarios ?? []));
  }, []);

  function addPlacement() {
    setPlacements((p) => [...p, { slotType: "display" }]);
  }

  function removePlacement(index: number) {
    setPlacements((p) => p.filter((_, i) => i !== index));
  }

  function setPlacement(index: number, update: Partial<Placement>) {
    setPlacements((p) =>
      p.map((pl, i) => (i === index ? { ...pl, ...update } : pl)),
    );
  }

  function buildConfig() {
    return {
      content: { kind: "mix", brandSafety, placements },
      cohort: {
        geoWeights: safeParse(geoWeights, { US: 1 }),
        deviceWeights: safeParse(deviceWeights, { desktop: 1, mobile: 1 }),
        contentTags: safeParse(contentTags, ["tech"]),
      },
    };
  }
  async function createOrUpdate() {
    setBusy(true);
    setErrorText(null);

    try {
      const payload = { name, config_json: buildConfig() };
      const method = selectedId ? "PUT" : "POST";
      const url = selectedId
        ? `/api/scenarios/${selectedId}`
        : "/api/scenarios";
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await res.text());
      const id = selectedId ? selectedId : (await res.json()).id;

      setSelectedId(id);

      const list = await (
        await fetch("/api/scenarios", { cache: "no-store" })
      ).json();

      setScenarios(list.scenarios ?? []);
    } catch (e: any) {
      setErrorText(e?.message ?? "Save failed");
    } finally {
      setBusy(false);
    }
  }
  async function del() {
    if (!selectedId) return;

    setBusy(true);

    setErrorText(null);

    try {
      const res = await fetch(`/api/scenarios/${selectedId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error(await res.text());

      setSelectedId("");

      setName("");

      setPlacements([{ slotType: "display" }]);

      const list = await (
        await fetch("/api/scenarios", { cache: "no-store" })
      ).json();

      setScenarios(list.scenarios ?? []);
    } catch (e: any) {
      setErrorText(e?.message ?? "Delete failed");
    } finally {
      setBusy(false);
    }
  }
  async function doPreview() {
    setBusy(true);
    setErrorText(null);
    setPreview(null);

    try {
      const payload = { config_json: buildConfig(), sample_size: 40 };
      const r = await fetch("/api/scenarios/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!r.ok) throw new Error(await r.text());

      setPreview(await r.json());
    } catch (e: any) {
      setErrorText(e?.message ?? "Preview failed");
    } finally {
      setBusy(false);
    }
  }
  function loadScenario(id: string) {
    setSelectedId(id);

    const s = scenarios.find((x) => x.id === id);

    if (!s) return;

    setName(s.name);

    const cfg =
      typeof s.config_json === "string"
        ? JSON.parse(s.config_json)
        : s.config_json;

    setBrandSafety((cfg?.content?.brandSafety ?? "G") as any);

    setPlacements(
      Array.isArray(cfg?.content?.placements)
        ? cfg.content.placements
        : [{ slotType: "display" }],
    );

    setGeoWeights(JSON.stringify(cfg?.cohort?.geoWeights ?? { US: 1 }));

    setDeviceWeights(
      JSON.stringify(cfg?.cohort?.deviceWeights ?? { desktop: 1, mobile: 1 }),
    );

    setContentTags(JSON.stringify(cfg?.cohort?.contentTags ?? ["tech"]));
  }

  return (
    <div className="grid gap-4 max-w-[900px] mx-auto">
      <h1 className="text-2xl font-semibold">Scenario Builder</h1>

      <div className={css.card}>
        <div className="grid gap-2">
          <div className="text-[12px] font-semibold opacity-75">Existing</div>
          <div className="flex flex-wrap gap-2">
            {scenarios.map((s) => (
              <button
                key={s.id}
                className="text-sm px-2 py-1 border rounded-lg hover:bg-gray-50"
                onClick={() => loadScenario(s.id)}
              >
                {s.name} ({s.id.slice(0, 8)}…)
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={css.card}>
        <div className="grid gap-3">
          <div>
            <div className="text-[12px] font-semibold mb-1 opacity-75">
              Name
            </div>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className={css.row}>
            <div className="min-w-[220px]">
              <div className="text-[12px] font-semibold mb-1 opacity-75">
                Content brand safety
              </div>
              <select
                value={brandSafety}
                onChange={(e) => setBrandSafety(e.target.value as any)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                <option value="G">G</option>
                <option value="PG">PG</option>
                <option value="M">M</option>
              </select>
            </div>
            <div className="min-w-[220px] flex-1">
              <div className="text-[12px] font-semibold mb-1 opacity-75">
                Geo weights (JSON)
              </div>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono"
                value={geoWeights}
                onChange={(e) => setGeoWeights(e.target.value)}
              />
            </div>
            <div className="min-w-[220px] flex-1">
              <div className="text-[12px] font-semibold mb-1 opacity-75">
                Device weights (JSON)
              </div>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono"
                value={deviceWeights}
                onChange={(e) => setDeviceWeights(e.target.value)}
              />
            </div>
            <div className="min-w-[220px] flex-1">
              <div className="text-[12px] font-semibold mb-1 opacity-75">
                Content tags (JSON array)
              </div>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono"
                value={contentTags}
                onChange={(e) => setContentTags(e.target.value)}
              />
            </div>
          </div>

          <div>
            <div className="text-[12px] font-semibold mb-1 opacity-75">
              Placements
            </div>
            <div className="grid gap-2">
              {placements.map((pl, i) => (
                <div key={i} className={css.row}>
                  <select
                    value={pl.slotType}
                    onChange={(e) =>
                      setPlacement(i, { slotType: e.target.value as any })
                    }
                    className="rounded-lg border border-gray-300 px-3 py-2"
                  >
                    <option value="preroll">preroll</option>
                    <option value="midroll">midroll</option>
                    <option value="display">display</option>
                  </select>
                  {/* freeform props like position/at/size */}
                  <input
                    placeholder="extra key (e.g. position/at/size)"
                    className="rounded-lg border border-gray-300 px-3 py-2"
                    onChange={(e) =>
                      setPlacement(i, { ["hint" as any]: e.target.value })
                    }
                  />
                  <button
                    className="text-sm px-2 py-1 border rounded-lg"
                    onClick={() => removePlacement(i)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <button
              className="mt-2 text-sm px-2 py-1 border rounded-lg"
              onClick={addPlacement}
            >
              Add Placement
            </button>
          </div>

          <div className="flex gap-2">
            <button
              className="inline-flex items-center rounded-lg border border-blue-800 bg-blue-700 text-white px-3 py-2 hover:bg-blue-800"
              disabled={busy || !name}
              onClick={createOrUpdate}
            >
              {selectedId ? "Save" : "Create"}
            </button>
            <button
              className="inline-flex items-center rounded-lg border px-3 py-2 hover:bg-gray-50"
              disabled={busy}
              onClick={doPreview}
            >
              Preview
            </button>
            <button
              className="inline-flex items-center rounded-lg border px-3 py-2 hover:bg-gray-50"
              disabled={busy || !selectedId}
              onClick={del}
            >
              Delete
            </button>
          </div>

          {errorText && (
            <div className="border border-red-200 bg-red-50 text-red-800 rounded-lg px-3 py-2">
              {errorText}
            </div>
          )}
          {preview && (
            <div className="grid gap-2">
              <div className="text-sm opacity-75">
                Preview sample size: {preview.sample_size} · Brand safety:{" "}
                {preview.brand_safety}
              </div>
              <pre className="text-xs bg-gray-50 p-3 rounded-lg overflow-auto">
                {JSON.stringify(preview.mix, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function safeParse<T>(txt: string, fallback: T): T {
  try {
    return JSON.parse(txt);
  } catch {
    return fallback;
  }
}
