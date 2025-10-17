"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type SelectOption = { id: string; label: string };
type InventoryTree = {
  networks: Array<{
    id: string;
    name: string;
    channels: Array<{ id: string; name: string }>;
  }>;
  services: Array<{ id: string; name: string; type: string }>;
  series: Array<{
    id: string;
    title: string;
    seasons: Array<{
      id: string;
      number: number;
      episodes: Array<{ id: string; number: number }>;
    }>;
  }>;
  event_series: Array<{
    id: string;
    name: string;
    occurrences: Array<{ id: string; starts_at: string }>;
  }>;
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[12px] font-semibold mb-1 opacity-75">{children}</div>
  );
}

function SelectControl({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <div className="min-w-[220px]">
      <SectionLabel>{label}</SectionLabel>
      <select
        className="w-full rounded-lg border border-gray-300 px-3 py-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function MultiToggleGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = value.includes(opt);
          return (
            <button
              key={opt}
              onClick={() =>
                onChange(
                  active ? value.filter((v) => v !== opt) : [...value, opt],
                )
              }
              className={`text-sm px-2 py-1 rounded-full border ${
                active
                  ? "bg-blue-600 text-white border-blue-700"
                  : "bg-white hover:bg-gray-50 border-gray-300"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function AdvancedFiltersDrawer({
  open,
  onClose,
  resultsCountLabel,
}: {
  open: boolean;
  onClose: () => void;
  resultsCountLabel?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL-backed values
  const [brandId, setBrandId] = useState("");
  const [productId, setProductId] = useState("");
  const [studioId, setStudioId] = useState("");
  const [movieId, setMovieId] = useState("");
  const [slotType, setSlotType] = useState("");

  const [networkId, setNetworkId] = useState("");
  const [channelId, setChannelId] = useState("");
  const [seriesId, setSeriesId] = useState("");
  const [seasonId, setSeasonId] = useState("");
  const [episodeId, setEpisodeId] = useState("");
  const [serviceId, setServiceId] = useState("");

  const [geoValues, setGeoValues] = useState<string[]>([]);
  const [deviceValues, setDeviceValues] = useState<string[]>([]);
  const [dropReasonValues, setDropReasonValues] = useState<string[]>([]);
  const [brandSafetyValue, setBrandSafetyValue] = useState("");

  // Reference data
  const [brandOptions, setBrandOptions] = useState<SelectOption[]>([]);
  const [productOptions, setProductOptions] = useState<SelectOption[]>([]);
  const [studioOptions, setStudioOptions] = useState<SelectOption[]>([]);
  const [movieOptions, setMovieOptions] = useState<SelectOption[]>([]);
  const [inventoryTree, setInventoryTree] = useState<InventoryTree | null>(
    null,
  );

  // Saved views (personal)
  const [savedViews, setSavedViews] = useState<
    Array<{ name: string; queryString: string }>
  >([]);
  const SAVED_VIEWS_KEY = "amp_saved_views";

  useEffect(() => {
    if (!open) return;
    fetch("/api/brands")
      .then((r) => r.json())
      .then((d) =>
        setBrandOptions(
          (d.brands ?? []).map((b: any) => ({ id: b.id, label: b.name })),
        ),
      );
    fetch("/api/studios")
      .then((r) => r.json())
      .then((d) =>
        setStudioOptions(
          (d.studios ?? []).map((s: any) => ({ id: s.id, label: s.name })),
        ),
      );
    fetch("/api/inventory/tree", { cache: "no-store" })
      .then((r) => r.json())
      .then(setInventoryTree);

    try {
      const raw = localStorage.getItem(SAVED_VIEWS_KEY);
      setSavedViews(raw ? JSON.parse(raw) : []);
    } catch {
      setSavedViews([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setBrandId(searchParams.get("brand_id") || "");
    setProductId(searchParams.get("product_id") || "");
    setStudioId(searchParams.get("studio_id") || "");
    setMovieId(searchParams.get("movie_id") || "");
    setSlotType(searchParams.get("slot") || "");

    setNetworkId(searchParams.get("network_id") || "");
    setChannelId(searchParams.get("channel_id") || "");
    setSeriesId(searchParams.get("series_id") || "");
    setSeasonId(searchParams.get("season_id") || "");
    setEpisodeId(searchParams.get("episode_id") || "");
    setServiceId(searchParams.get("service_id") || "");

    setGeoValues(searchParams.getAll("geo"));
    setDeviceValues(searchParams.getAll("device"));
    setDropReasonValues(searchParams.getAll("reason"));
    setBrandSafetyValue(searchParams.get("brand_safety") || "");
  }, [open, searchParams]);

  useEffect(() => {
    if (!brandId) {
      setProductOptions([]);
      setProductId("");
      return;
    }
    fetch(`/api/products?brand_id=${brandId}`)
      .then((r) => r.json())
      .then((d) =>
        setProductOptions(
          (d.products ?? []).map((p: any) => ({ id: p.id, label: p.name })),
        ),
      );
  }, [brandId]);

  useEffect(() => {
    if (!studioId) {
      setMovieOptions([]);
      setMovieId("");
      return;
    }
    fetch(`/api/movies?studio_id=${studioId}`)
      .then((r) => r.json())
      .then((d) =>
        setMovieOptions(
          (d.movies ?? []).map((m: any) => ({ id: m.id, label: m.title })),
        ),
      );
  }, [studioId]);

  // Tree helpers
  const networkOptions = useMemo<SelectOption[]>(
    () =>
      (inventoryTree?.networks ?? []).map((n) => ({ id: n.id, label: n.name })),
    [inventoryTree],
  );

  const channelOptions = useMemo<SelectOption[]>(() => {
    const n = (inventoryTree?.networks ?? []).find((n) => n.id === networkId);
    return (n?.channels ?? []).map((c) => ({ id: c.id, label: c.name }));
  }, [inventoryTree, networkId]);

  const seriesOptions = useMemo<SelectOption[]>(
    () =>
      (inventoryTree?.series ?? []).map((s) => ({ id: s.id, label: s.title })),
    [inventoryTree],
  );

  const seasonOptions = useMemo<SelectOption[]>(() => {
    const s = (inventoryTree?.series ?? []).find((s) => s.id === seriesId);
    return (s?.seasons ?? []).map((se) => ({
      id: se.id,
      label: `Season ${se.number}`,
    }));
  }, [inventoryTree, seriesId]);

  const episodeOptions = useMemo<SelectOption[]>(() => {
    const s = (inventoryTree?.series ?? []).find((s) => s.id === seriesId);
    const se = s?.seasons.find((se) => se.id === seasonId);
    return (se?.episodes ?? []).map((ep) => ({
      id: ep.id,
      label: `Ep ${ep.number}`,
    }));
  }, [inventoryTree, seriesId, seasonId]);

  const serviceOptions = useMemo<SelectOption[]>(
    () =>
      (inventoryTree?.services ?? []).map((s) => ({ id: s.id, label: s.name })),
    [inventoryTree],
  );

  function applyFilters() {
    const url = new URLSearchParams(searchParams.toString());

    // Demand facets
    brandId ? url.set("brand_id", brandId) : url.delete("brand_id");
    productId ? url.set("product_id", productId) : url.delete("product_id");
    studioId ? url.set("studio_id", studioId) : url.delete("studio_id");
    movieId ? url.set("movie_id", movieId) : url.delete("movie_id");
    slotType ? url.set("slot", slotType) : url.delete("slot");

    // Inventory tree
    networkId ? url.set("network_id", networkId) : url.delete("network_id");
    channelId ? url.set("channel_id", channelId) : url.delete("channel_id");
    seriesId ? url.set("series_id", seriesId) : url.delete("series_id");
    seasonId ? url.set("season_id", seasonId) : url.delete("season_id");
    episodeId ? url.set("episode_id", episodeId) : url.delete("episode_id");
    serviceId ? url.set("service_id", serviceId) : url.delete("service_id");

    // Advanced
    url.delete("geo");
    geoValues.forEach((g) => url.append("geo", g));

    url.delete("device");
    deviceValues.forEach((d) => url.append("device", d));

    url.delete("reason");
    dropReasonValues.forEach((r) => url.append("reason", r));

    brandSafetyValue
      ? url.set("brand_safety", brandSafetyValue)
      : url.delete("brand_safety");

    router.push(`${pathname}?${url.toString()}`);
    onClose();
  }

  function resetFilters() {
    setBrandId("");
    setProductId("");
    setStudioId("");
    setMovieId("");
    setSlotType("");
    setNetworkId("");
    setChannelId("");
    setSeriesId("");
    setSeasonId("");
    setEpisodeId("");
    setServiceId("");
    setGeoValues([]);
    setDeviceValues([]);
    setDropReasonValues([]);
    setBrandSafetyValue("");
  }

  function saveCurrentView() {
    const name = prompt("Name this view");

    if (!name) return;

    const view = { name, queryString: searchParams.toString() };
    const next = [...savedViews, view];

    setSavedViews(next);

    try {
      localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(next));
    } catch {}
  }
  function applySavedView(index: number) {
    const view = savedViews[index];

    if (!view) return;

    router.push(`${pathname}?${view.queryString}`);

    onClose();
  }

  function deleteSavedView(index: number) {
    const next = savedViews.filter((_, i) => i !== index);

    setSavedViews(next);

    try {
      localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(next));
    } catch {}
  }

  if (!open) return;

  return (
    <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose}>
      <aside
        className="absolute right-0 top-0 bottom-0 w-[420px] bg-white border-l p-4 grid"
        style={{ gridTemplateRows: "auto 1fr auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Filters</h3>
          <div className="flex items-center gap-2">
            <details>
              <summary className="cursor-pointer text-sm px-2 py-1 border rounded-lg hover:bg-gray-50">
                Saved Views
              </summary>
              <div className="absolute right-4 mt-2 bg-white border border-gray-200 rounded-lg shadow-sm min-w-[220px] p-2 z-10">
                {savedViews.length === 0 && (
                  <div className="text-sm opacity-75 px-2 py-1">
                    No saved views
                  </div>
                )}
                {savedViews.map((v, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 px-2 py-1"
                  >
                    <button
                      className="text-sm text-blue-700 hover:text-blue-800"
                      onClick={() => applySavedView(i)}
                    >
                      {v.name}
                    </button>
                    <button
                      className="text-xs px-2 py-0.5 border rounded-lg hover:bg-gray-50"
                      onClick={() => deleteSavedView(i)}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </details>
            <button
              className="text-sm px-2 py-1 border rounded-lg hover:bg-gray-50"
              onClick={saveCurrentView}
            >
              Save current
            </button>
            <button
              className="text-sm px-2 py-1 border rounded-lg hover:bg-gray-50"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="grid gap-4 overflow-y-auto pr-1">
          {/* Demand facets */}
          <div className="flex flex-wrap items-end gap-3">
            <SelectControl
              label="Brand"
              value={brandId}
              onChange={(v) => {
                setBrandId(v);
                setProductId("");
              }}
              options={brandOptions}
              placeholder="— Any —"
            />
            <SelectControl
              label="Product"
              value={productId}
              onChange={setProductId}
              options={productOptions}
              placeholder={brandId ? "— Any —" : "(select brand)"}
              disabled={!brandId}
            />
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <SelectControl
              label="Studio"
              value={studioId}
              onChange={(v) => {
                setStudioId(v);
                setMovieId("");
              }}
              options={studioOptions}
              placeholder="— Any —"
            />
            <SelectControl
              label="Movie"
              value={movieId}
              onChange={setMovieId}
              options={movieOptions}
              placeholder={studioId ? "— Any —" : "(select studio)"}
              disabled={!studioId}
            />
          </div>

          {/* Inventory tree */}
          <div className="flex flex-wrap items-end gap-3">
            <SelectControl
              label="Network"
              value={networkId}
              onChange={(v) => {
                setNetworkId(v);
                setChannelId("");
              }}
              options={networkOptions}
              placeholder="— Any —"
            />
            <SelectControl
              label="Channel"
              value={channelId}
              onChange={setChannelId}
              options={channelOptions}
              placeholder={networkId ? "— Any —" : "(select network)"}
              disabled={!networkId}
            />
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <SelectControl
              label="Series"
              value={seriesId}
              onChange={(v) => {
                setSeriesId(v);
                setSeasonId("");
                setEpisodeId("");
              }}
              options={seriesOptions}
              placeholder="— Any —"
            />
            <SelectControl
              label="Season"
              value={seasonId}
              onChange={(v) => {
                setSeasonId(v);
                setEpisodeId("");
              }}
              options={seasonOptions}
              placeholder={seriesId ? "— Any —" : "(select series)"}
              disabled={!seriesId}
            />
            <SelectControl
              label="Episode"
              value={episodeId}
              onChange={setEpisodeId}
              options={episodeOptions}
              placeholder={seasonId ? "— Any —" : "(select season)"}
              disabled={!seasonId}
            />
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <SelectControl
              label="Service/App"
              value={serviceId}
              onChange={setServiceId}
              options={(inventoryTree?.services ?? []).map((s) => ({
                id: s.id,
                label: s.name,
              }))}
              placeholder="— Any —"
            />
            <SelectControl
              label="Slot"
              value={slotType}
              onChange={setSlotType}
              options={[
                { id: "preroll", label: "Preroll" },
                { id: "midroll", label: "Midroll" },
                { id: "display", label: "Display" },
              ]}
              placeholder="— Any —"
            />
          </div>

          {/* Advanced groups */}
          <MultiToggleGroup
            label="Geo"
            options={["US", "CA", "GB", "DE", "FR", "AU", "IN", "BR"]}
            value={geoValues}
            onChange={setGeoValues}
          />
          <MultiToggleGroup
            label="Device"
            options={["desktop", "mobile"]}
            value={deviceValues}
            onChange={setDeviceValues}
          />
          <MultiToggleGroup
            label="Drop reasons"
            options={[
              "budget",
              "frequency",
              "brand_safety",
              "floor",
              "format_mismatch",
              "no_creatives",
              "inactive",
              "pacing_overspend",
            ]}
            value={dropReasonValues}
            onChange={setDropReasonValues}
          />

          <div>
            <SectionLabel>Brand safety</SectionLabel>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              value={brandSafetyValue}
              onChange={(e) => setBrandSafetyValue(e.target.value)}
            >
              <option value="">— Any —</option>
              <option value="G">G</option>
              <option value="PG">PG</option>
              <option value="M">M</option>
            </select>
          </div>
        </div>

        {/* Sticky footer */}
        <div className="flex items-center justify-between gap-2 border-t pt-3">
          <div className="text-sm opacity-75">{resultsCountLabel ?? ""}</div>
          <div className="flex items-center gap-2">
            <button
              className="text-sm px-2 py-1 border rounded-lg hover:bg-gray-50"
              onClick={resetFilters}
            >
              Reset
            </button>
            <button
              className="inline-flex items-center rounded-lg border border-blue-800 bg-blue-700 text-white px-3 py-2 hover:bg-blue-800"
              onClick={applyFilters}
            >
              Apply
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
