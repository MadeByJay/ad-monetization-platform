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
};

type ApiResponse = {
  run?: { id: string; started_at?: string; finished_at?: string | null };
  summary?: Summary;
  error?: string;
};

export default function ResultDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/simulate/run/${id}/summary`, { cache: "no-store" })
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [id]);

  const spendRows = useMemo(() => {
    const rec = data?.summary?.spend_by_campaign || {};

    return Object.entries(rec)
      .map(([campaignId, v]) => ({
        label: campaignId.slice(0, 8) + "…",
        value: v.revenue,
      }))
      .sort((a, b) => b.value - a.value);
  }, [data]);

  const reasonRows = useMemo(() => {
    const rec = data?.summary?.drop_reasons || {};

    return Object.entries(rec)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [data]);

  const slotRows = useMemo(() => {
    const rec = data?.summary?.slot_mix || {};

    return Object.entries(rec).map(([label, value]) => ({ label, value }));
  }, [data]);

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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Kpi
              title="Total Impressions"
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card title="Spend by Campaign (revenue)">
              <Bars rows={spendRows} unit="" />
            </Card>
            <Card title="Drop Reasons">
              <Bars rows={reasonRows} unit="" />
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
