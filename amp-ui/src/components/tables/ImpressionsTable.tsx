"use client";

import { useMemo, useState } from "react";
import styles from "@/styles/components/results/results.module.css";

export type ImpressionRow = {
  id: string;
  slot_type: "preroll" | "midroll" | "display";
  campaign_id: string | null;
  creative_id: string | null;
  revenue: number | string | null;
  user_id: string | null;
  context_json: any;
  trace_json: any;
  ts?: string;
};

type SortState = {
  column: "slot_type" | "campaign" | "revenue" | "timestamp";
  direction: "asc" | "desc";
};

// Safely coerce any value to a number. Returns 0 if NaN/empty.
function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

// Format with fixed decimals (defaults to 4), handling strings/nulls gracefully
function formatFixed(value: unknown, digits = 4): string {
  return toNumber(value).toFixed(digits);
}

export default function ImpressionsTable({
  rows,
  totalCount,
  pageIndex,
  pageSize,
  onChangePageIndex,
  initialSort,
}: {
  rows: ImpressionRow[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
  onChangePageIndex: (next: number) => void;
  initialSort?: SortState;
}) {
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [sortState, setSortState] = useState<SortState>(
    initialSort ?? { column: "timestamp", direction: "asc" },
  );

  function toggleAllCurrentPage(checked: boolean) {
    const next = new Set(selectedRowIds);
    rows.forEach((row) => (checked ? next.add(row.id) : next.delete(row.id)));
    setSelectedRowIds(next);
  }

  function toggleSingle(rowId: string, checked: boolean) {
    const next = new Set(selectedRowIds);
    if (checked) next.add(rowId);
    else next.delete(rowId);
    setSelectedRowIds(next);
  }

  function handleSortBy(column: SortState["column"]) {
    setSortState((prev) => {
      if (prev.column === column) {
        return { column, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { column, direction: "asc" };
    });
  }

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const dir = sortState.direction === "asc" ? 1 : -1;
      switch (sortState.column) {
        case "slot_type":
          return a.slot_type.localeCompare(b.slot_type) * dir;
        case "campaign": {
          const ac = a.campaign_id || "";
          const bc = b.campaign_id || "";
          return ac.localeCompare(bc) * dir;
        }
        case "revenue": {
          const ar = toNumber(a.revenue);
          const br = toNumber(b.revenue);
          return (ar - br) * dir;
        }
        case "timestamp": {
          const at = a.ts ? new Date(a.ts).getTime() : 0;
          const bt = b.ts ? new Date(b.ts).getTime() : 0;
          return (at - bt) * dir;
        }
      }
    });
    return copy;
  }, [rows, sortState]);

  const allSelectedOnPage =
    rows.length > 0 && rows.every((r) => selectedRowIds.has(r.id));
  const anySelection = selectedRowIds.size > 0;

  function exportSelectedAsCsv() {
    const selected = sortedRows.filter((r) => selectedRowIds.has(r.id));

    const headers = [
      "id",
      "slot_type",
      "ts",
      "campaign_id",
      "creative_id",
      "revenue",
      "user_id",
    ];

    const lines = [headers.join(",")];

    for (const r of selected) {
      const fields = [
        r.id,
        r.slot_type,
        r.ts ? new Date(r.ts).toISOString() : "",
        r.campaign_id ?? "",
        r.creative_id ?? "",
        formatFixed(r.revenue, 4), // robust formatting
        r.user_id ?? "",
      ];

      const csv = fields
        .map((v) => {
          const s = String(v ?? "");
          return s.includes(",") || s.includes('"') || s.includes("\n")
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        })
        .join(",");
      lines.push(csv);
    }

    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `impressions-selected-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-2">
      {/* Bulk actions bar */}
      <div className="flex items-center justify-between">
        <div className="text-sm opacity-75">
          {anySelection
            ? `${selectedRowIds.size.toLocaleString()} selected`
            : `${totalCount.toLocaleString()} total`}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="text-sm px-2 py-1 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
            onClick={exportSelectedAsCsv}
            disabled={!anySelection}
          >
            Export selected CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-white">
            <tr>
              <th className="text-left font-semibold border-b border-gray-200 py-2 pr-3">
                <input
                  aria-label="select all"
                  type="checkbox"
                  checked={allSelectedOnPage}
                  onChange={(e) =>
                    toggleAllCurrentPage(e.currentTarget.checked)
                  }
                />
              </th>
              <SortableHeader
                label="Slot"
                onSort={() => handleSortBy("slot_type")}
                active={sortState.column === "slot_type"}
                direction={sortState.direction}
              />
              <SortableHeader
                label="Campaign"
                onSort={() => handleSortBy("campaign")}
                active={sortState.column === "campaign"}
                direction={sortState.direction}
              />
              <SortableHeader
                label="Revenue"
                onSort={() => handleSortBy("revenue")}
                active={sortState.column === "revenue"}
                direction={sortState.direction}
              />
              <SortableHeader label="Status" />
              <SortableHeader
                label="Timestamp"
                onSort={() => handleSortBy("timestamp")}
                active={sortState.column === "timestamp"}
                direction={sortState.direction}
              />
              <th className="text-left font-semibold border-b border-gray-200 py-2 pr-3">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, index) => {
              const isDelivered = !!row.campaign_id;
              return (
                <tr key={row.id}>
                  <td className="border-b border-gray-100 py-2 pr-3">
                    <input
                      aria-label={`select row ${index + 1}`}
                      type="checkbox"
                      checked={selectedRowIds.has(row.id)}
                      onChange={(e) =>
                        toggleSingle(row.id, e.currentTarget.checked)
                      }
                    />
                  </td>
                  <td className="border-b border-gray-100 py-2 pr-3">
                    {row.slot_type}
                  </td>
                  <td className="border-b border-gray-100 py-2 pr-3 font-mono">
                    {row.campaign_id ? row.campaign_id.slice(0, 8) + "…" : "—"}
                  </td>
                  <td className="border-b border-gray-100 py-2 pr-3">
                    {formatFixed(row.revenue, 4)}
                  </td>
                  <td className="border-b border-gray-100 py-2 pr-3">
                    <StatusChip
                      status={isDelivered ? "Delivered" : "Not filled"}
                    />
                  </td>
                  <td className="border-b border-gray-100 py-2 pr-3">
                    {row.ts ? new Date(row.ts).toLocaleString() : "—"}
                  </td>
                  <td className="border-b border-gray-100 py-2 pr-3">
                    <a
                      className="text-blue-700 hover:text-blue-800 cursor-pointer"
                      onClick={() =>
                        alert(JSON.stringify(row.trace_json, null, 2))
                      }
                    >
                      View trace
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center mt-3">
        <button
          className="text-sm px-2 py-1 border rounded-lg disabled:opacity-50"
          disabled={pageIndex === 0}
          onClick={() => onChangePageIndex(Math.max(0, pageIndex - 1))}
        >
          Prev
        </button>
        <div className="text-sm">
          Page {pageIndex + 1} of{" "}
          {Math.max(1, Math.ceil(totalCount / pageSize))}
        </div>
        <button
          className="text-sm px-2 py-1 border rounded-lg disabled:opacity-50"
          disabled={(pageIndex + 1) * pageSize >= totalCount}
          onClick={() => onChangePageIndex(pageIndex + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

function SortableHeader({
  label,
  active,
  direction,
  onSort,
}: {
  label: string;
  active?: boolean;
  direction?: "asc" | "desc";
  onSort?: () => void;
}) {
  return (
    <th
      className="text-left font-semibold border-b border-gray-200 py-2 pr-3 select-none cursor-pointer"
      onClick={onSort}
      title={onSort ? "Sort" : undefined}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && (direction === "asc" ? "▲" : "▼")}
      </span>
    </th>
  );
}

function StatusChip({ status }: { status: "Delivered" | "Not filled" }) {
  const isDelivered = status === "Delivered";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${
        isDelivered
          ? "bg-green-100 text-green-800"
          : "bg-gray-100 text-gray-800"
      }`}
    >
      {status}
    </span>
  );
}
