"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import LineItemDrawer from "@/components/drawers/LineItemDrawer";

type InsertionOrderRow = { id: string; name: string };
type LineItemRow = {
  id: string;
  io_id: string;
  name: string;
  start_dt: string;
  end_dt: string;
  budget: number;
  cpm_bid: number;
  pacing_strategy: "even" | "asap";
  status: "draft" | "active" | "paused" | "completed";
};

type SortState = {
  column: "name" | "budget" | "cpm" | "start" | "end" | "status";
  direction: "asc" | "desc";
};

export default function LineItemsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const selectedInsertionOrderId = searchParams.get("ioId") || "";

  const [insertionOrders, setInsertionOrders] = useState<InsertionOrderRow[]>(
    [],
  );
  const [lineItems, setLineItems] = useState<LineItemRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [sort, setSort] = useState<SortState>({
    column: "name",
    direction: "asc",
  });

  // selection state for bulk actions
  const [selectedLineItemIds, setSelectedLineItemIds] = useState<Set<string>>(
    new Set(),
  );

  // drawers
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingLineItem, setEditingLineItem] = useState<LineItemRow | null>(
    null,
  );

  useEffect(() => {
    fetch("/api/insertion-orders", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setInsertionOrders(d.orders ?? []));
  }, []);

  function refreshLineItems(ioId: string) {
    setLoading(true);
    fetch(`/api/line-items/by_io/${ioId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setLineItems(d.line_items ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    setSelectedLineItemIds(new Set());
    if (!selectedInsertionOrderId) {
      setLineItems([]);
      return;
    }
    refreshLineItems(selectedInsertionOrderId);
  }, [selectedInsertionOrderId]);

  const sortedRows = useMemo(() => {
    const copy = [...lineItems];
    copy.sort((a, b) => {
      const dir = sort.direction === "asc" ? 1 : -1;
      switch (sort.column) {
        case "name":
          return a.name.localeCompare(b.name) * dir;
        case "budget":
          return ((a.budget ?? 0) - (b.budget ?? 0)) * dir;
        case "cpm":
          return ((a.cpm_bid ?? 0) - (b.cpm_bid ?? 0)) * dir;
        case "start":
          return (
            (new Date(a.start_dt).getTime() - new Date(b.start_dt).getTime()) *
            dir
          );
        case "end":
          return (
            (new Date(a.end_dt).getTime() - new Date(b.end_dt).getTime()) * dir
          );
        case "status":
          return a.status.localeCompare(b.status) * dir;
      }
    });
    return copy;
  }, [lineItems, sort]);

  function sortBy(column: SortState["column"]) {
    setSort((prev) =>
      prev.column === column
        ? { column, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { column, direction: "asc" },
    );
  }

  // Selection helpers
  function toggleAllPage(checked: boolean) {
    const next = new Set(selectedLineItemIds);
    sortedRows.forEach((li) =>
      checked ? next.add(li.id) : next.delete(li.id),
    );
    setSelectedLineItemIds(next);
  }
  function toggleSingle(id: string, checked: boolean) {
    const next = new Set(selectedLineItemIds);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedLineItemIds(next);
  }
  const allSelected =
    sortedRows.length > 0 &&
    sortedRows.every((li) => selectedLineItemIds.has(li.id));
  const anySelected = selectedLineItemIds.size > 0;

  // Bulk actions
  async function bulkUpdateStatus(status: "active" | "paused") {
    if (!anySelected) return;
    const ids = Array.from(selectedLineItemIds);
    await Promise.allSettled(
      ids.map((id) =>
        fetch(`/api/line-items/${id}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status }),
        }),
      ),
    );
    refreshLineItems(selectedInsertionOrderId);
    setSelectedLineItemIds(new Set());
  }
  async function bulkDelete() {
    if (!anySelected) return;
    if (
      !confirm(
        `Delete ${selectedLineItemIds.size} line item(s)? This cannot be undone.`,
      )
    )
      return;
    const ids = Array.from(selectedLineItemIds);
    await Promise.allSettled(
      ids.map((id) => fetch(`/api/line-items/${id}`, { method: "DELETE" })),
    );
    refreshLineItems(selectedInsertionOrderId);
    setSelectedLineItemIds(new Set());
  }

  function openCreateDrawer() {
    setEditingLineItem(null);
    setIsDrawerOpen(true);
  }
  function openEditDrawer(row: LineItemRow) {
    setEditingLineItem(row);
    setIsDrawerOpen(true);
  }

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">Line Items</h1>

      {/* Insertion Order chooser */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm grid gap-3">
        <div className="text-sm opacity-75">Select an Insertion Order</div>
        <div className="flex gap-2 flex-wrap">
          {insertionOrders.map((io) => (
            <button
              key={io.id}
              onClick={() => router.push(`/line-items?ioId=${io.id}`)}
              className={`text-sm px-2 py-1 border rounded-lg ${selectedInsertionOrderId === io.id ? "bg-blue-600 text-white border-blue-700" : "hover:bg-gray-50"}`}
              title={io.name}
            >
              {io.name}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk actions + New */}
      {selectedInsertionOrderId && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              className="text-sm px-2 py-1 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
              disabled={!anySelected}
              onClick={() => bulkUpdateStatus("active")}
            >
              Activate
            </button>
            <button
              className="text-sm px-2 py-1 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
              disabled={!anySelected}
              onClick={() => bulkUpdateStatus("paused")}
            >
              Pause
            </button>
            <button
              className="text-sm px-2 py-1 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
              disabled={!anySelected}
              onClick={bulkDelete}
            >
              Delete
            </button>
            {anySelected && (
              <span className="text-sm opacity-75">
                ({selectedLineItemIds.size} selected)
              </span>
            )}
          </div>
          <div>
            <button
              className="inline-flex items-center rounded-lg border border-blue-800 bg-blue-700 text-white px-3 py-2 hover:bg-blue-800"
              onClick={openCreateDrawer}
            >
              New Line Item
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {selectedInsertionOrderId && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          {loading ? (
            "Loading…"
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 bg-white">
                  <tr>
                    <th className="text-left font-semibold border-b border-gray-200 py-2 pr-3">
                      <input
                        aria-label="select all"
                        type="checkbox"
                        checked={allSelected}
                        onChange={(e) => toggleAllPage(e.currentTarget.checked)}
                      />
                    </th>
                    <Th
                      label="Name"
                      active={sort.column === "name"}
                      dir={sort.direction}
                      onClick={() => sortBy("name")}
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
                      label="CPM Bid"
                      active={sort.column === "cpm"}
                      dir={sort.direction}
                      onClick={() => sortBy("cpm")}
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
                  {sortedRows.map((li) => (
                    <tr key={li.id}>
                      <td className="border-b border-gray-100 py-2 pr-3">
                        <input
                          aria-label={`select ${li.name}`}
                          type="checkbox"
                          checked={selectedLineItemIds.has(li.id)}
                          onChange={(e) =>
                            toggleSingle(li.id, e.currentTarget.checked)
                          }
                        />
                      </td>
                      <td className="border-b border-gray-100 py-2 pr-3">
                        {li.name}
                      </td>
                      <td className="border-b border-gray-100 py-2 pr-3">
                        {new Date(li.start_dt).toLocaleDateString()}
                      </td>
                      <td className="border-b border-gray-100 py-2 pr-3">
                        {new Date(li.end_dt).toLocaleDateString()}
                      </td>
                      <td className="border-b border-gray-100 py-2 pr-3">
                        ${Number(li.budget ?? 0).toLocaleString()}
                      </td>
                      <td className="border-b border-gray-100 py-2 pr-3">
                        ${Number(li.cpm_bid ?? 0).toFixed(2)}
                      </td>
                      <td className="border-b border-gray-100 py-2 pr-3">
                        <StatusChip status={li.status} />
                      </td>
                      <td className="border-b border-gray-100 py-2 pr-3 flex gap-2">
                        <Link
                          href={`/line-items/${li.id}`}
                          className="text-blue-700 hover:text-blue-800"
                        >
                          Open
                        </Link>
                        <button
                          className="text-blue-700 hover:text-blue-800"
                          onClick={() => openEditDrawer(li)}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                  {sortedRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="py-8 text-center text-sm opacity-60"
                      >
                        No line items found for this insertion order.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Drawer for create/edit */}
      <LineItemDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        insertionOrderId={selectedInsertionOrderId}
        initialData={editingLineItem || null}
        onSaved={() => refreshLineItems(selectedInsertionOrderId)}
      />
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
