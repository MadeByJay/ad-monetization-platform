"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type RunRow = {
  id: string;
  scenario_id: string | null;
  started_at?: string;
  finished_at?: string | null;
  stats_json?: any;
};

export default function ResultsIndexPage() {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/runs", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setRuns(d.runs ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">Runs</h1>
      {loading && <div>Loading…</div>}
      {!loading && runs.length === 0 && (
        <div>No runs yet. Go to Simulator and start one.</div>
      )}
      {runs.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
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
                  Fill Rate
                </th>
                <th className="text-left font-semibold border-b border-gray-200 py-2 pr-3">
                  Revenue
                </th>
                <th className="text-left font-semibold border-b border-gray-200 py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => {
                const stats =
                  typeof r.stats_json === "string"
                    ? JSON.parse(r.stats_json)
                    : r.stats_json;
                return (
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
                    <td className="border-b border-gray-100 py-2 pr-3">
                      {stats?.fill_rate != null
                        ? `${(stats.fill_rate * 100).toFixed(1)}%`
                        : "—"}
                    </td>
                    <td className="border-b border-gray-100 py-2 pr-3">
                      {stats?.revenue != null ? stats.revenue.toFixed(4) : "—"}
                    </td>
                    <td className="border-b border-gray-100 py-2 pr-3">
                      <Link
                        href={`/results/${r.id}`}
                        className="text-blue-700 hover:text-blue-800"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
