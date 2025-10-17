"use client";

import { useEffect, useMemo, useState } from "react";

type RunRow = {
  id: string;
  started_at?: string;
  finished_at?: string | null;
  stats_json?: any;
};
type ExportRecord = {
  runId: string;
  type: "csv" | "json" | "s3-csv" | "s3-json";
  timestamp: number;
  status: "ok" | "error";
  message?: string;
};

const STORAGE_KEY = "amp_recent_exports";

export default function ReportsPage() {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [filterText, setFilterText] = useState("");
  const [recentExports, setRecentExports] = useState<ExportRecord[]>([]);

  useEffect(() => {
    fetch("/api/runs", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setRuns(d.runs ?? []));
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setRecentExports(raw ? JSON.parse(raw) : []);
    } catch {
      setRecentExports([]);
    }
  }, []);

  function recordExport(entry: ExportRecord) {
    const next = [entry, ...recentExports].slice(0, 50);
    setRecentExports(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  }

  async function exportCsv(runId: string) {
    try {
      window.open(`/api/simulate/run/${runId}/export/csv`, "_blank");
      recordExport({ runId, type: "csv", timestamp: Date.now(), status: "ok" });
    } catch (e: any) {
      recordExport({
        runId,
        type: "csv",
        timestamp: Date.now(),
        status: "error",
        message: e?.message,
      });
    }
  }
  async function exportJson(runId: string) {
    try {
      window.open(`/api/simulate/run/${runId}/export/json`, "_blank");
      recordExport({
        runId,
        type: "json",
        timestamp: Date.now(),
        status: "ok",
      });
    } catch (e: any) {
      recordExport({
        runId,
        type: "json",
        timestamp: Date.now(),
        status: "error",
        message: e?.message,
      });
    }
  }
  async function exportS3(runId: string, format: "csv" | "json") {
    try {
      const res = await fetch(`/api/exports/run/${runId}/s3?format=${format}`, {
        method: "GET",
      });
      const text = await res.text();
      recordExport({
        runId,
        type: format === "csv" ? "s3-csv" : "s3-json",
        timestamp: Date.now(),
        status: res.ok ? "ok" : "error",
        message: text,
      });
    } catch (e: any) {
      recordExport({
        runId,
        type: format === "csv" ? "s3-csv" : "s3-json",
        timestamp: Date.now(),
        status: "error",
        message: e?.message,
      });
    }
  }

  const filteredRuns = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return runs;
    return runs.filter((r) => r.id.toLowerCase().includes(q));
  }, [runs, filterText]);

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">Reports & Exports</h1>

      <section className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm grid gap-3">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">Runs</div>
          <input
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Filter by run id…"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-white">
              <tr>
                <th className="text-left font-semibold border-b border-gray-200 py-2 pr-3">
                  Run
                </th>
                <th className="text-left font-semibold border-b border-gray-200 py-2 pr-3">
                  Started
                </th>
                <th className="text-left font-semibold border-b border-gray-200 py-2 pr-3">
                  Finished
                </th>
                <th className="text-left font-semibold border-b border-gray-200 py-2 pr-3">
                  Exports
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRuns.map((r) => (
                <tr key={r.id}>
                  <td className="border-b border-gray-100 py-2 pr-3 font-mono">
                    {r.id.slice(0, 8)}…
                  </td>
                  <td className="border-b border-gray-100 py-2 pr-3">
                    {r.started_at
                      ? new Date(r.started_at).toLocaleString()
                      : "—"}
                  </td>
                  <td className="border-b border-gray-100 py-2 pr-3">
                    {r.finished_at
                      ? new Date(r.finished_at).toLocaleString()
                      : "—"}
                  </td>
                  <td className="border-b border-gray-100 py-2 pr-3 flex flex-wrap gap-2">
                    <button
                      className="text-sm px-2 py-1 border rounded-lg hover:bg-gray-50"
                      onClick={() => exportCsv(r.id)}
                    >
                      CSV
                    </button>
                    <button
                      className="text-sm px-2 py-1 border rounded-lg hover:bg-gray-50"
                      onClick={() => exportJson(r.id)}
                    >
                      JSON
                    </button>
                    <button
                      className="text-sm px-2 py-1 border rounded-lg hover:bg-gray-50"
                      onClick={() => exportS3(r.id, "csv")}
                    >
                      S3 CSV
                    </button>
                    <button
                      className="text-sm px-2 py-1 border rounded-lg hover:bg-gray-50"
                      onClick={() => exportS3(r.id, "json")}
                    >
                      S3 JSON
                    </button>
                  </td>
                </tr>
              ))}
              {filteredRuns.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="py-8 text-center text-sm opacity-60"
                  >
                    No runs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm grid gap-3">
        <div className="text-lg font-semibold">Recent exports (local)</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-white">
              <tr>
                <th className="text-left font-semibold border-b border-gray-200 py-2 pr-3">
                  When
                </th>
                <th className="text-left font-semibold border-b border-gray-200 py-2 pr-3">
                  Run
                </th>
                <th className="text-left font-semibold border-b border-gray-200 py-2 pr-3">
                  Type
                </th>
                <th className="text-left font-semibold border-b border-gray-200 py-2 pr-3">
                  Status
                </th>
                <th className="text-left font-semibold border-b border-gray-200 py-2 pr-3">
                  Message
                </th>
              </tr>
            </thead>
            <tbody>
              {recentExports.map((e, idx) => (
                <tr key={idx}>
                  <td className="border-b border-gray-100 py-2 pr-3">
                    {new Date(e.timestamp).toLocaleString()}
                  </td>
                  <td className="border-b border-gray-100 py-2 pr-3 font-mono">
                    {e.runId.slice(0, 8)}…
                  </td>
                  <td className="border-b border-gray-100 py-2 pr-3">
                    {e.type}
                  </td>
                  <td className="border-b border-gray-100 py-2 pr-3">
                    {e.status}
                  </td>
                  <td className="border-b border-gray-100 py-2 pr-3 truncate max-w-[420px]">
                    {e.message ?? ""}
                  </td>
                </tr>
              ))}
              {recentExports.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="py-8 text-center text-sm opacity-60"
                  >
                    No exports yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
