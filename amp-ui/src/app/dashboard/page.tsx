"use client";

import { useEffect, useMemo, useState } from "react";

type Summary = {
  total_impressions: number;
  delivered_impressions: number;
  fill_rate: number;
  revenue_total: number;
  average_cpm_delivered: number;
  spend_over_time: Record<string, number>;
  drop_reasons: Record<string, number>;
};

export default function DashboardPage() {
  const [latestRunId, setLatestRunId] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const runs = await fetch("/api/runs", { cache: "no-store" }).then((r) =>
          r.json(),
        );
        const run = runs?.runs?.[0];
        if (!run) {
          setLoading(false);
          return;
        }
        setLatestRunId(run.id);
        const s = await fetch(`/api/simulate/run/${run.id}/summary`, {
          cache: "no-store",
        }).then((r) => r.json());
        setSummary(s?.summary ?? null);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const spendEntries = useMemo(() => {
    if (!summary?.spend_over_time) return [];
    return Object.entries(summary.spend_over_time).sort(([a], [b]) =>
      a.localeCompare(b),
    );
  }, [summary]);

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {loading && <div>Loading…</div>}
      {!loading && !summary && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="text-sm text-gray-700">
            No runs yet. Go to{" "}
            <a href="/simulator" className="text-blue-700 hover:text-blue-800">
              Simulator
            </a>{" "}
            to start one.
          </div>
        </div>
      )}

      {summary && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Kpi
              title="Revenue"
              value={`$${summary.revenue_total.toFixed(2)}`}
            />
            <Kpi
              title="Fill Rate"
              value={`${(summary.fill_rate * 100).toFixed(1)}%`}
            />
            <Kpi
              title="Delivered"
              value={summary.delivered_impressions.toLocaleString()}
            />
            <Kpi
              title="Avg CPM"
              value={`$${summary.average_cpm_delivered.toFixed(2)}`}
            />
          </div>

          {/* Spend over time (simple stripes) */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="text-lg font-semibold mb-2">Spend over time</div>
            <div className="relative h-32 bg-gradient-to-b from-blue-50 to-transparent rounded-md border border-gray-200 overflow-hidden">
              {spendEntries.map(([iso, val], index) => {
                const values = spendEntries.map(([, v]) => Number(v));
                const max = Math.max(0.0001, ...values);
                const widthPercent = (Number(val) / max) * 100;
                return (
                  <div
                    key={`${iso}-${index}`}
                    className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-blue-600 to-orange-400"
                    style={{
                      width: `${widthPercent}%`,
                      bottom: `${(index / (values.length || 1)) * 100}%`,
                    }}
                    title={`${iso} · ${Number(val).toFixed(4)}`}
                  />
                );
              })}
            </div>
          </div>

          {/* Drop reasons quick view */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="text-lg font-semibold mb-2">Policy health</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(summary.drop_reasons).map(([reason, count]) => (
                <span
                  key={reason}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-800"
                >
                  {reason} {count}
                </span>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="text-sm text-gray-700">
              Latest run: {latestRunId?.slice(0, 8)}… &middot;{" "}
              <a
                href={`/results/${latestRunId}`}
                className="text-blue-700 hover:text-blue-800"
              >
                View details
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <div className="text-sm opacity-75">{title}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}
