"use client";

import { useEffect, useState } from "react";

type LineItemFormData = {
  id?: string;
  io_id: string;
  name: string;
  start_dt: string;
  end_dt: string;
  budget: number | "";
  cpm_bid: number | "";
  pacing_strategy: "even" | "asap";
  status: "draft" | "active" | "paused" | "completed";
  targeting_json?: any;
  caps_json?: any;
  floors_json?: any;
};

export default function LineItemDrawer({
  isOpen,
  onClose,
  insertionOrderId,
  initialData,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  insertionOrderId: string;
  initialData?: Partial<LineItemFormData> | null;
  onSaved?: () => void;
}) {
  const [formData, setFormData] = useState<LineItemFormData>({
    id: undefined,
    io_id: insertionOrderId,
    name: "",
    start_dt: new Date().toISOString(),
    end_dt: new Date(Date.now() + 7 * 86400000).toISOString(),
    budget: "",
    cpm_bid: "",
    pacing_strategy: "even",
    status: "active",
    targeting_json: {},
    caps_json: {},
    floors_json: {},
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      setFormData((prev) => ({
        ...prev,
        ...initialData,
        io_id: initialData.io_id || insertionOrderId,
        start_dt: initialData.start_dt || prev.start_dt,
        end_dt: initialData.end_dt || prev.end_dt,
        budget: initialData.budget ?? prev.budget,
        cpm_bid: initialData.cpm_bid ?? prev.cpm_bid,
        pacing_strategy: (initialData.pacing_strategy as any) || "even",
        status: (initialData.status as any) || "active",
      }));
    } else {
      // reset to default on "create"
      setFormData({
        id: undefined,
        io_id: insertionOrderId,
        name: "",
        start_dt: new Date().toISOString(),
        end_dt: new Date(Date.now() + 7 * 86400000).toISOString(),
        budget: "",
        cpm_bid: "",
        pacing_strategy: "even",
        status: "active",
        targeting_json: {},
        caps_json: {},
        floors_json: {},
      });
    }
  }, [isOpen, initialData, insertionOrderId]);

  function update<K extends keyof LineItemFormData>(
    key: K,
    value: LineItemFormData[K],
  ) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  async function submit() {
    setIsSubmitting(true);
    setErrorText(null);
    try {
      if (!formData.name || !formData.io_id) {
        setErrorText(
          "Please provide a name and at least select an insertion order.",
        );
        return;
      }
      const payload = {
        io_id: formData.io_id,
        name: formData.name,
        start_dt: formData.start_dt,
        end_dt: formData.end_dt,
        budget: Number(formData.budget || 0),
        cpm_bid: Number(formData.cpm_bid || 0),
        pacing_strategy: formData.pacing_strategy,
        status: formData.status,
        targeting_json: formData.targeting_json ?? {},
        caps_json: formData.caps_json ?? {},
        floors_json: formData.floors_json ?? {},
      };

      const method = formData.id ? "PUT" : "POST";
      const url = formData.id
        ? `/api/line-items/${formData.id}`
        : `/api/line-items`;

      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await res.text());
      onSaved?.();
      onClose();
    } catch (e: any) {
      setErrorText(e?.message ?? "Save failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose}>
      <aside
        className="absolute right-0 top-0 bottom-0 w-[460px] bg-white border-l p-4 grid"
        style={{ gridTemplateRows: "auto 1fr auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {formData.id ? "Edit Line Item" : "Create Line Item"}
          </h3>
          <button
            className="text-sm px-2 py-1 border rounded-lg hover:bg-gray-50"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="grid gap-3 overflow-y-auto pr-1">
          <div>
            <div className="text-[12px] font-semibold mb-1 opacity-75">
              Name
            </div>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              value={formData.name}
              onChange={(e) => update("name", e.target.value)}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <div className="text-[12px] font-semibold mb-1 opacity-75">
                Start
              </div>
              <input
                type="datetime-local"
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                value={toLocalInput(formData.start_dt)}
                onChange={(e) =>
                  update("start_dt", fromLocalInput(e.target.value))
                }
              />
            </div>
            <div>
              <div className="text-[12px] font-semibold mb-1 opacity-75">
                End
              </div>
              <input
                type="datetime-local"
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                value={toLocalInput(formData.end_dt)}
                onChange={(e) =>
                  update("end_dt", fromLocalInput(e.target.value))
                }
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <NumberField
              label="Budget"
              value={formData.budget}
              onChange={(v) => update("budget", v)}
              min={0}
            />
            <NumberField
              label="CPM Bid"
              value={formData.cpm_bid}
              onChange={(v) => update("cpm_bid", v)}
              min={0}
              step="0.01"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <div className="text-[12px] font-semibold mb-1 opacity-75">
                Pacing strategy
              </div>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                value={formData.pacing_strategy}
                onChange={(e) =>
                  update("pacing_strategy", e.target.value as any)
                }
              >
                <option value="even">even</option>
                <option value="asap">asap</option>
              </select>
            </div>
            <div>
              <div className="text-[12px] font-semibold mb-1 opacity-75">
                Status
              </div>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                value={formData.status}
                onChange={(e) => update("status", e.target.value as any)}
              >
                <option value="draft">draft</option>
                <option value="active">active</option>
                <option value="paused">paused</option>
                <option value="completed">completed</option>
              </select>
            </div>
          </div>

          {errorText && (
            <div className="border border-red-200 bg-red-50 text-red-800 rounded-lg px-3 py-2">
              {errorText}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t pt-3">
          <button
            className="text-sm px-2 py-1 border rounded-lg hover:bg-gray-50"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="inline-flex items-center rounded-lg border border-blue-800 bg-blue-700 text-white px-3 py-2 hover:bg-blue-800"
            onClick={submit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving…" : "Save"}
          </button>
        </div>
      </aside>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  step,
}: {
  label: string;
  value: number | "";
  onChange: (v: number | "") => void;
  min?: number;
  step?: string;
}) {
  return (
    <div>
      <div className="text-[12px] font-semibold mb-1 opacity-75">{label}</div>
      <input
        type="number"
        min={min ?? 0}
        step={step ?? "1"}
        className="w-full rounded-lg border border-gray-300 px-3 py-2"
        value={value === "" ? "" : Number(value)}
        onChange={(e) => {
          const raw = e.target.value;
          onChange(raw === "" ? "" : Number(raw));
        }}
      />
    </div>
  );
}

// Helpers for <input type="datetime-local">
function toLocalInput(iso: string): string {
  try {
    const d = new Date(iso);
    const off = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - off).toISOString().slice(0, 16);
  } catch {
    return "";
  }
}
function fromLocalInput(local: string): string {
  try {
    const d = new Date(local);
    const off = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() + off).toISOString();
  } catch {
    return new Date().toISOString();
  }
}
