"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "@/styles/components/results/results.module.css";
import { useParams, useSearchParams } from "next/navigation";
import ImpressionsTable, {
  ImpressionRow,
} from "@/components/tables/ImpressionsTable";
import AdvancedFiltersDrawer from "@/components/AdvancedFiltersDrawer";

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
  const search = useSearchParams();
  const studioId = search.get("studio_id") || "";
  const movieId = search.get("movie_id") || "";
  // const brandId = search.get("brand_id") || "";
  // const productId = search.get("product_id") || "";

  const selectedBrandId = search.get("brand_id") || "";
  const selectedProductId = search.get("product_id") || "";
  const selectedNetworkId = search.get("network_id") || "";
  const selectedChannelId = search.get("channel_id") || "";
  const selectedSeriesId = search.get("series_id") || "";
  const selectedSeasonId = search.get("season_id") || "";
  const selectedEpisodeId = search.get("episode_id") || "";
  const selectedServiceId = search.get("service_id") || "";
  const selectedSlotType = search.get("slot") || "";

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

    const qs = new URLSearchParams();

    if (studioId) qs.set("studio_id", studioId);
    if (movieId) qs.set("movie_id", movieId);
    if (selectedBrandId) qs.set("brand_id", selectedBrandId);
    if (selectedProductId) qs.set("product_id", selectedProductId);
    if (selectedNetworkId) qs.set("network_id", selectedNetworkId);
    if (selectedChannelId) qs.set("channel_id", selectedChannelId);
    if (selectedSeriesId) qs.set("series_id", selectedSeriesId);
    if (selectedSeasonId) qs.set("season_id", selectedSeasonId);
    if (selectedEpisodeId) qs.set("episode_id", selectedEpisodeId);
    if (selectedServiceId) qs.set("service_id", selectedServiceId);
    if (selectedSlotType) qs.set("slot", selectedSlotType);

    fetch(`/api/simulate/run/${id}/summary?${qs.toString()}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [id, studioId, movieId]);

  useEffect(() => {
    if (!id) return;

    const qs = new URLSearchParams();

    if (studioId) qs.set("studio_id", studioId);
    if (movieId) qs.set("movie_id", movieId);
    if (selectedBrandId) qs.set("brand_id", selectedBrandId);
    if (selectedProductId) qs.set("product_id", selectedProductId);
    if (selectedNetworkId) qs.set("network_id", selectedNetworkId);
    if (selectedChannelId) qs.set("channel_id", selectedChannelId);
    if (selectedSeriesId) qs.set("series_id", selectedSeriesId);
    if (selectedSeasonId) qs.set("season_id", selectedSeasonId);
    if (selectedEpisodeId) qs.set("episode_id", selectedEpisodeId);
    if (selectedServiceId) qs.set("service_id", selectedServiceId);
    if (selectedSlotType) qs.set("slot", selectedSlotType);

    qs.set("offset", String(page * pageSize));
    qs.set("limit", String(pageSize));

    fetch(`/api/simulate/run/${id}/impressions?${qs.toString()}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((d) => setImps({ total: d.total, items: d.items ?? [] }));
  }, [id, page, studioId, movieId]);

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

  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

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
                  const width = (Number(val) / timeSeries.max) * 100;
                  return (
                    <div
                      key={i}
                      className={styles.line}
                      style={{
                        width: `${width}%`,
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
          <Card title={`Impressions`}>
            <ImpressionsTable
              rows={imps.items as unknown as ImpressionRow[]}
              totalCount={imps.total}
              pageIndex={page}
              pageSize={pageSize}
              onChangePageIndex={setPage}
              initialSort={{ column: "timestamp", direction: "asc" }}
            />
          </Card>

          <AdvancedFiltersDrawer
            open={isAdvancedOpen}
            onClose={() => setIsAdvancedOpen(false)}
            resultsCountLabel={`${imps.total.toLocaleString()} results`}
          />

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
