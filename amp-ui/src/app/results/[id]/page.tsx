"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "@/styles/components/results/results.module.css";
import { useParams } from "next/navigation";

type Summary = {
  total_impressions: number;
  delivered_impressions: number;
  fill_rate: number;
  revenue_total: number;
  average_cpm_delivered: number;
  spend_by_campaign: Record<string, { impressions: number; revenue: number }>;
  drop_reasons: Record<string, number>;
  slot_mix: Record<string, number>;
  spend_over_time: Record<string, number>;
  winners_by_slot: Record<string, Record<string, number>>;
};

type ApiResponse = {
  run?: { id: string; started_at?: string; finished_at?: string | null };
  summary?: Summary;
  error?: string;
};

type Impression = {
  id: string;
  slot_type: "preroll" | "midroll" | "display";
  campaign_id: string | null;
  creative_id: string | null;
  revenue: number | null;
  user_id: string | null;
  context_json: any;
  trace_json: any;
  ts?: string;
};

export default function ResultDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(0);
  const [imps, setImps] = useState<{ total: number; items: Impression[] }>({
    total: 0,
    items: [],
  });
  const pageSize = 25;
  const [showTrace, setShowTrace] = useState<Impression | null>(null);

  useEffect(() => {
    if (!id) return;

    fetch(`/api/simulate/run/${id}/summary`, { cache: "no-store" })
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;

    const offset = page * pageSize;

    fetch(
      `/api/simulate/run/${id}/impressions?offset=${offset}&limit=${pageSize}`,
      { cache: "no-store" },
    )
      .then((r) => r.json())
      .then((d) => setImps({ total: d.total, items: d.items ?? [] }));
  }, [id, page]);

  const spendRows = useMemo(
    () =>
      Object.entries(data?.summary?.spend_by_campaign ?? {})
        .map(([k, v]) => ({ label: k.slice(0, 8) + "…", value: v.revenue }))
        .sort((a, b) => b.value - a.value),
    [data],
  );

  const reasonRows = useMemo(
    () =>
      Object.entries(data?.summary?.drop_reasons ?? {})
        .map(([k, v]) => ({ label: k, value: v as number }))
        .sort((a, b) => b.value - a.value),
    [data],
  );

  const slotRows = useMemo(
    () =>
      Object.entries(data?.summary?.slot_mix ?? {}).map(([k, v]) => ({
        label: k,
        value: v as number,
      })),
    [data],
  );

  const timeSeries = useMemo(() => {
    const rec = data?.summary?.spend_over_time ?? {};
    const entries = Object.entries(rec).sort((a, b) =>
      a[0].localeCompare(b[0]),
    );
    const max = Math.max(0.0001, ...entries.map(([, v]) => Number(v)));
    return { entries, max };
  }, [data]);

  const winnersBySlot = data?.summary?.winners_by_slot ?? {};

  function download(kind: "json" | "csv") {
    if (!id) return;

    const url =
      kind === "json"
        ? `/api/simulate/run/${id}/export/json`
        : `/api/simulate/run/${id}/export/csv`;

    window.open(url, "_blank");
  }

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">Run {id.slice(0, 8)}…</h1>

      {loading && <div>Loading…</div>}
      {!loading && data?.error && (
        <div className="border border-red-200 bg-red-50 text-red-800 rounded-lg px-3 py-2">
          {data.error}
        </div>
      )}

      {data?.summary && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Kpi
              title="Total"
              value={data.summary.total_impressions.toLocaleString()}
            />
            <Kpi
              title="Delivered"
              value={data.summary.delivered_impressions.toLocaleString()}
            />
            <Kpi
              title="Fill Rate"
              value={`${(data.summary.fill_rate * 100).toFixed(1)}%`}
            />
            <Kpi
              title="Revenue"
              value={data.summary.revenue_total.toFixed(4)}
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card title="Spend Over Time (min buckets)">
              <div className={styles.lineChart}>
                {timeSeries.entries.map(([iso, val], i) => {
                  const w = (Number(val) / timeSeries.max) * 100;
                  return (
                    <div
                      key={i}
                      className={styles.line}
                      style={{
                        width: `${w}%`,
                        bottom: `${(i / (timeSeries.entries.length || 1)) * 100}%`,
                      }}
                      title={`${iso} · ${Number(val).toFixed(4)}`}
                    />
                  );
                })}
              </div>
            </Card>
            <Card title="Drop Reasons">
              <Bars rows={reasonRows} unit="" />
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card title="Spend by Campaign (revenue)">
              <Bars rows={spendRows} unit="" />
            </Card>
            <Card title="Winners by Slot">
              <div className="grid gap-3">
                {Object.keys(winnersBySlot).length === 0 && (
                  <div className="text-sm opacity-70">No data</div>
                )}
                {Object.entries(winnersBySlot).map(([slot, map]) => {
                  const rows = Object.entries(map).map(([cid, v]) => ({
                    label: cid.slice(0, 8) + "…",
                    value: v as number,
                  }));
                  return (
                    <div key={slot}>
                      <div className="text-sm font-semibold mb-1">{slot}</div>
                      <Bars rows={rows} unit="" />
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          <Card title="Slot Mix">
            <Bars rows={slotRows} unit="" />
          </Card>

          <div className="flex gap-3">
            <button
              onClick={() => download("json")}
              className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 hover:bg-gray-50"
            >
              Export JSON
            </button>
            <button
              onClick={() => download("csv")}
              className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 hover:bg-gray-50"
            >
              Export CSV
            </button>
          </div>

          {/* Trace table */}
          <Card
            title={`Impressions (page ${page + 1} of ${Math.max(1, Math.ceil(imps.total / pageSize))})`}
          >
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
                      Campaign
                    </th>
                    <th className="text-left font-semibold border-b border-gray-200 py-2 pr-3">
                      Revenue
                    </th>
                    <th className="text-left font-semibold border-b border-gray-200 py-2 pr-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {imps.items.map((r, i) => (
                    <tr key={r.id}>
                      <td className="border-b border-gray-100 py-2 pr-3">
                        {page * pageSize + i + 1}
                      </td>
                      <td className="border-b border-gray-100 py-2 pr-3">
                        {r.slot_type}
                      </td>
                      <td className="border-b border-gray-100 py-2 pr-3">
                        {r.campaign_id ? r.campaign_id.slice(0, 8) + "…" : "—"}
                      </td>
                      <td className="border-b border-gray-100 py-2 pr-3">
                        {(r.revenue ?? 0).toFixed(4)}
                      </td>
                      <td className="border-b border-gray-100 py-2 pr-3">
                        <button
                          className="text-blue-700 hover:text-blue-800"
                          onClick={() => setShowTrace(r)}
                        >
                          View trace
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between items-center mt-3">
              <button
                className="text-sm px-2 py-1 border rounded-lg"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Prev
              </button>
              <div className="text-sm">{imps.total} total</div>
              <button
                className="text-sm px-2 py-1 border rounded-lg"
                disabled={(page + 1) * pageSize >= imps.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </Card>

          {showTrace && (
            <div
              className={styles.traceModal}
              onClick={() => setShowTrace(null)}
            >
              <div
                className={styles.traceCard}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-2">
                  <div className="font-semibold">
                    Trace · {showTrace.id.slice(0, 8)}…
                  </div>
                  <button
                    className="text-sm px-2 py-1 border rounded-lg"
                    onClick={() => setShowTrace(null)}
                  >
                    Close
                  </button>
                </div>
                <pre className="text-xs bg-gray-50 p-3 rounded-lg overflow-auto">
                  {JSON.stringify(showTrace.trace_json, null, 2)}
                </pre>
              </div>
            </div>
          )}
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

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <h3 className="mt-0 text-lg font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function Bars({
  rows,
  unit,
}: {
  rows: Array<{ label: string; value: number }>;
  unit: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="grid gap-2">
      {rows.length === 0 && <div className="text-sm opacity-70">No data</div>}
      {rows.map((r) => (
        <div
          key={r.label}
          className="grid grid-cols-[120px_1fr_72px] items-center gap-2"
        >
          <div className="text-sm opacity-80">{r.label}</div>
          <div className={styles.barTrack}>
            <div
              className={styles.barFill}
              style={{ ["--bar-width" as any]: `${(r.value / max) * 100}%` }}
            />
          </div>
          <div className="text-sm text-right">
            {r.value.toFixed(4)}
            {unit}
          </div>
        </div>
      ))}
    </div>
  );
}
