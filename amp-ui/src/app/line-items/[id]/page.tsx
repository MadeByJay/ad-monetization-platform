"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import LineItemDrawer from "@/components/drawers/LineItemDrawer";
import LineItemSidebar from "@/components/line-items/LineItemSidebar";

const PolicyEditor = dynamic(() => import("@/components/policy/PolicyEditor"), {
  ssr: false,
});

type LineItem = {
  id: string;
  name: string;
  io_id: string;
  start_dt: string;
  end_dt: string;
  budget: number;
  cpm_bid: number;
  pacing_strategy: "even" | "asap";
  status: "draft" | "active" | "paused" | "completed";
};

export default function LineItemDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const lineItemId = params.id;
  const [lineItem, setLineItem] = useState<LineItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);

  // clone drawer
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [cloneData, setCloneData] = useState<Partial<LineItem> | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErrorText(null);
      try {
        const res = await fetch(`/api/line-items/${lineItemId}`, {
          cache: "no-store",
        });
        const li = await res.json();
        if (li?.error) setErrorText(li.error);
        else setLineItem(li);
      } catch (e: any) {
        setErrorText(e?.message ?? "Failed to load line item");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [lineItemId]);

  function openCloneDrawer() {
    if (!lineItem) return;
    setCloneData({
      io_id: lineItem.io_id,
      name: `${lineItem.name} (clone)`,
      start_dt: new Date().toISOString(),
      end_dt: new Date(Date.now() + 7 * 86400000).toISOString(),
      budget: lineItem.budget,
      cpm_bid: lineItem.cpm_bid,
      pacing_strategy: lineItem.pacing_strategy,
      status: "active",
    });
    setIsDrawerOpen(true);
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Line Item</h1>
        {lineItem && (
          <button
            className="inline-flex items-center rounded-lg border border-blue-800 bg-blue-700 text-white px-3 py-2 hover:bg-blue-800"
            onClick={openCloneDrawer}
          >
            Clone
          </button>
        )}
      </div>

      {loading && <div>Loading…</div>}
      {errorText && (
        <div className="border border-red-200 bg-red-50 text-red-800 rounded-lg px-3 py-2">
          {errorText}
        </div>
      )}

      {lineItem && (
        <div className="grid md:grid-cols-[1fr_320px] gap-4">
          <div className="grid gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm grid md:grid-cols-2 gap-4">
              <Info label="Name" value={lineItem.name} />
              <Info
                label="CPM Bid"
                value={`$${Number(lineItem.cpm_bid ?? 0).toFixed(2)}`}
              />
              <Info
                label="Start"
                value={new Date(lineItem.start_dt).toLocaleString()}
              />
              <Info
                label="End"
                value={new Date(lineItem.end_dt).toLocaleString()}
              />
              <Info
                label="Budget"
                value={`$${Number(lineItem.budget ?? 0).toLocaleString()}`}
              />
              <Info label="Pacing Strategy" value={lineItem.pacing_strategy} />
              <Info label="Status" value={lineItem.status} />
            </div>

            <PolicyEditor lineItemId={lineItem.id} />
          </div>

          <LineItemSidebar lineItemId={lineItem.id} />
        </div>
      )}

      {/* Clone drawer */}
      {lineItem && (
        <LineItemDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          insertionOrderId={lineItem.io_id}
          initialData={cloneData}
          onSaved={() => setIsDrawerOpen(false)}
        />
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-sm opacity-70">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
