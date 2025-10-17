"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type InsertionOrderRow = {
  id: string;
  name: string;
  advertiser: string;
  start_date: string;
  end_date: string;
  budget_total: number;
  status: "draft" | "active" | "paused" | "completed";
  created_at?: string;
};

type SortState = {
  column: "name" | "advertiser" | "budget" | "start" | "end" | "status";
  direction: "asc" | "desc";
};

export default function InsertionOrdersPage() {
  const [rows, setRows] = useState<InsertionOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortState>({
    column: "name",
    direction: "asc",
  });

  useEffect(() => {
    fetch("/api/insertion-orders", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setRows(d.orders ?? []))
      .finally(() => setLoading(false));
  }, []);

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const dir = sort.direction === "asc" ? 1 : -1;
      switch (sort.column) {
        case "name":
          return a.name.localeCompare(b.name) * dir;
        case "advertiser":
          return a.advertiser.localeCompare(b.advertiser) * dir;
        case "budget":
          return ((a.budget_total ?? 0) - (b.budget_total ?? 0)) * dir;
        case "start":
          return (
            (new Date(a.start_date).getTime() -
              new Date(b.start_date).getTime()) *
            dir
          );
        case "end":
          return (
            (new Date(a.end_date).getTime() - new Date(b.end_date).getTime()) *
            dir
          );
        case "status":
          return a.status.localeCompare(b.status) * dir;
      }
    });
    return copy;
  }, [rows, sort]);

  function sortBy(column: SortState["column"]) {
    setSort((prev) =>
      prev.column === column
        ? { column, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { column, direction: "asc" },
    );
  }

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">Insertion Orders</h1>
      {loading && <div>Loading…</div>}
      {!loading && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-white">
                <tr>
                  <Th
                    label="Name"
                    active={sort.column === "name"}
                    dir={sort.direction}
                    onClick={() => sortBy("name")}
                  />
                  <Th
                    label="Advertiser"
                    active={sort.column === "advertiser"}
                    dir={sort.direction}
                    onClick={() => sortBy("advertiser")}
                  />
                  <Th
                    label="Start"
                    active={sort.column === "start"}
                    dir={sort.direction}
                    onClick={() => sortBy("start")}
                  />
                  <Th
                    label="End"
                    active={sort.column === "end"}
                    dir={sort.direction}
                    onClick={() => sortBy("end")}
                  />
                  <Th
                    label="Budget"
                    active={sort.column === "budget"}
                    dir={sort.direction}
                    onClick={() => sortBy("budget")}
                  />
                  <Th
                    label="Status"
                    active={sort.column === "status"}
                    dir={sort.direction}
                    onClick={() => sortBy("status")}
                  />
                  <th className="text-left font-semibold border-b border-gray-200 py-2 pr-3">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => (
                  <tr key={row.id}>
                    <td className="border-b border-gray-100 py-2 pr-3">
                      {row.name}
                    </td>
                    <td className="border-b border-gray-100 py-2 pr-3">
                      {row.advertiser}
                    </td>
                    <td className="border-b border-gray-100 py-2 pr-3">
                      {new Date(row.start_date).toLocaleDateString()}
                    </td>
                    <td className="border-b border-gray-100 py-2 pr-3">
                      {new Date(row.end_date).toLocaleDateString()}
                    </td>
                    <td className="border-b border-gray-100 py-2 pr-3">
                      ${Number(row.budget_total ?? 0).toLocaleString()}
                    </td>
                    <td className="border-b border-gray-100 py-2 pr-3">
                      <StatusChip status={row.status} />
                    </td>
                    <td className="border-b border-gray-100 py-2 pr-3">
                      <Link
                        href={`/line-items?ioId=${row.id}`}
                        className="text-blue-700 hover:text-blue-800"
                      >
                        View Line Items
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Th({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active?: boolean;
  dir?: "asc" | "desc";
  onClick?: () => void;
}) {
  return (
    <th
      className="text-left font-semibold border-b border-gray-200 py-2 pr-3 select-none cursor-pointer"
      onClick={onClick}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (dir === "asc" ? " ▲" : " ▼") : ""}
      </span>
    </th>
  );
}

function StatusChip({
  status,
}: {
  status: "draft" | "active" | "paused" | "completed";
}) {
  const color =
    status === "active"
      ? "bg-green-100 text-green-800"
      : status === "paused"
        ? "bg-yellow-100 text-yellow-800"
        : status === "completed"
          ? "bg-gray-200 text-gray-800"
          : "bg-gray-100 text-gray-800";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${color}`}
    >
      {status}
    </span>
  );
}
