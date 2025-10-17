"use client";

import { useEffect, useMemo, useState } from "react";

type Summary = {
  spend_over_time: Record<string, number>;
  spend_by_campaign: Record<string, { impressions: number; revenue: number }>;
  winners_by_slot?: Record<string, Record<string, number>>;
};

function toNumber(n: unknown): number {
  if (typeof n === "number") return Number.isFinite(n) ? n : 0;
  if (typeof n === "string") {
    const v = Number(n.trim());
    return Number.isFinite(v) ? v : 0;
  }
  return 0;
}

export default function LineItemSidebar({
  lineItemId,
}: {
  lineItemId: string;
}) {
  const [runId, setRunId] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const runsRes = await fetch("/api/runs", { cache: "no-store" }).then(
          (r) => r.json(),
        );
        const latest = runsRes?.runs?.[0];
        if (!latest) {
          setLoading(false);
          return;
        }
        setRunId(latest.id);
        const sumRes = await fetch(`/api/simulate/run/${latest.id}/summary`, {
          cache: "no-store",
        }).then((r) => r.json());
        setSummary(sumRes?.summary ?? null);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const spend = useMemo(() => {
    const record = summary?.spend_by_campaign?.[lineItemId];
    return {
      revenue: toNumber(record?.revenue),
      impressions: toNumber(record?.impressions),
    };
  }, [summary, lineItemId]);

  const winBySlot = useMemo(() => {
    const map = summary?.winners_by_slot ?? {};
    const slots: Array<{ slot: string; wins: number }> = [];
    for (const slot of ["preroll", "midroll", "display"]) {
      const count = toNumber(map?.[slot]?.[lineItemId]);
      slots.push({ slot, wins: count });
    }
    const maxWins = Math.max(1, ...slots.map((s) => s.wins));
    return { slots, maxWins };
  }, [summary, lineItemId]);

  return (
    <aside className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm grid gap-4">
      <div className="text-lg font-semibold">Performance</div>
      {loading && <div className="text-sm opacity-70">Loading…</div>}
      {!loading && !summary && (
        <div className="text-sm opacity-70">No recent run to summarize.</div>
      )}

      {summary && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Kpi label="Revenue" value={`$${spend.revenue.toFixed(2)}`} />
            <Kpi
              label="Impressions"
              value={spend.impressions.toLocaleString()}
            />
          </div>

          <div>
            <div className="text-sm font-semibold mb-2">Win-rate by slot</div>
            <div className="grid gap-2">
              {winBySlot.slots.map((row) => (
                <BarRow
                  key={row.slot}
                  label={row.slot}
                  value={row.wins}
                  max={winBySlot.maxWins}
                />
              ))}
            </div>
          </div>

          <div className="text-xs opacity-70">
            Based on latest run {runId?.slice(0, 8)}….
          </div>
        </>
      )}
    </aside>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
      <div className="text-xs opacity-70">{label}</div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  );
}

function BarRow({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const width = Math.max(2, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className="grid grid-cols-[96px_1fr_56px] items-center gap-2">
      <div className="text-sm opacity-80 capitalize">{label}</div>
      <div className="h-2 rounded-md bg-gray-100 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-600 to-orange-400"
          style={{ width: `${width}%` }}
        />
      </div>
      <div className="text-sm text-right">{value.toLocaleString()}</div>
    </div>
  );
}
