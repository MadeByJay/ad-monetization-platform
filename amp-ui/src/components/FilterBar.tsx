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

type SavedView = { name: string; queryString: string };

const SAVED_VIEWS_KEY = "amp_saved_views";

export default function GlobalFilterBar({
  onOpenAdvanced,
}: {
  onOpenAdvanced: () => void;
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  // Current selections (URL is source of truth)
  const selectedBrandId = searchParams.get("brand_id") || "";
  const selectedProductId = searchParams.get("product_id") || "";
  const selectedStudioId = searchParams.get("studio_id") || "";
  const selectedMovieId = searchParams.get("movie_id") || "";
  const selectedNetworkId = searchParams.get("network_id") || "";
  const selectedChannelId = searchParams.get("channel_id") || "";
  const selectedSeriesId = searchParams.get("series_id") || "";
  const selectedSeasonId = searchParams.get("season_id") || "";
  const selectedEpisodeId = searchParams.get("episode_id") || "";
  const selectedServiceId = searchParams.get("service_id") || "";
  const selectedSlotType = searchParams.get("slot") || "";

  // Data for selectors
  const [brandOptions, setBrandOptions] = useState<SelectOption[]>([]);
  const [productOptions, setProductOptions] = useState<SelectOption[]>([]);
  const [studioOptions, setStudioOptions] = useState<SelectOption[]>([]);
  const [movieOptions, setMovieOptions] = useState<SelectOption[]>([]);
  const [inventoryTree, setInventoryTree] = useState<InventoryTree | null>(
    null,
  );

  const [savedViews, setSavedViews] = useState<SavedView[]>([]);

  // Load reference lists
  useEffect(() => {
    fetch("/api/brands")
      .then((r) => r.json())
      .then((d) =>
        setBrandOptions(
          (d.brands ?? []).map((b: any) => ({ id: b.id, label: b.name })),
        ),
      );
  }, []);

  useEffect(() => {
    fetch("/api/studios")
      .then((r) => r.json())
      .then((d) =>
        setStudioOptions(
          (d.studios ?? []).map((s: any) => ({ id: s.id, label: s.name })),
        ),
      );
  }, []);

  useEffect(() => {
    fetch("/api/inventory/tree", { cache: "no-store" })
      .then((r) => r.json())
      .then(setInventoryTree);
  }, []);

  // Dependent lists
  useEffect(() => {
    if (!selectedBrandId) {
      setProductOptions([]);
      return;
    }
    fetch(`/api/products?brand_id=${selectedBrandId}`)
      .then((r) => r.json())
      .then((d) =>
        setProductOptions(
          (d.products ?? []).map((p: any) => ({ id: p.id, label: p.name })),
        ),
      );
  }, [selectedBrandId]);

  useEffect(() => {
    if (!selectedStudioId) {
      setMovieOptions([]);
      return;
    }
    fetch(`/api/movies?studio_id=${selectedStudioId}`)
      .then((r) => r.json())
      .then((d) =>
        setMovieOptions(
          (d.movies ?? []).map((m: any) => ({ id: m.id, label: m.title })),
        ),
      );
  }, [selectedStudioId]);

  // Inventory tree helpers
  const networkOptions = useMemo<SelectOption[]>(
    () =>
      (inventoryTree?.networks ?? []).map((n) => ({ id: n.id, label: n.name })),
    [inventoryTree],
  );

  const channelOptions = useMemo<SelectOption[]>(() => {
    const network = (inventoryTree?.networks ?? []).find(
      (n) => n.id === selectedNetworkId,
    );
    return (network?.channels ?? []).map((c) => ({ id: c.id, label: c.name }));
  }, [inventoryTree, selectedNetworkId]);

  const seriesOptions = useMemo<SelectOption[]>(
    () =>
      (inventoryTree?.series ?? []).map((s) => ({ id: s.id, label: s.title })),
    [inventoryTree],
  );

  const seasonOptions = useMemo<SelectOption[]>(() => {
    const series = (inventoryTree?.series ?? []).find(
      (s) => s.id === selectedSeriesId,
    );
    return (series?.seasons ?? []).map((se) => ({
      id: se.id,
      label: `Season ${se.number}`,
    }));
  }, [inventoryTree, selectedSeriesId]);

  const episodeOptions = useMemo<SelectOption[]>(() => {
    const series = (inventoryTree?.series ?? []).find(
      (s) => s.id === selectedSeriesId,
    );
    const season = series?.seasons.find((se) => se.id === selectedSeasonId);
    return (season?.episodes ?? []).map((ep) => ({
      id: ep.id,
      label: `Ep ${ep.number}`,
    }));
  }, [inventoryTree, selectedSeriesId, selectedSeasonId]);

  const serviceOptions = useMemo<SelectOption[]>(
    () =>
      (inventoryTree?.services ?? []).map((s) => ({ id: s.id, label: s.name })),
    [inventoryTree],
  );

  // Saved views (local)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_VIEWS_KEY);
      setSavedViews(raw ? JSON.parse(raw) : []);
    } catch {
      setSavedViews([]);
    }
  }, []);

  function saveCurrentView() {
    const name = prompt("Name this view");

    if (!name) return;

    const queryString = searchParams.toString();
    const next = [...savedViews, { name, queryString }];

    setSavedViews(next);
    localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(next));
  }

  function applySavedView(index: number) {
    const view = savedViews[index];

    if (!view) return;

    const url = `${pathname}?${view.queryString}`;
    router.push(url);
  }

  function deleteSavedView(index: number) {
    const next = savedViews.filter((_, i) => i !== index);
    setSavedViews(next);
    localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(next));
  }

  // Push URL updates
  function applyQueryPatch(patch: Record<string, string | null>) {
    const urlParams = new URLSearchParams(searchParams.toString());

    Object.entries(patch).forEach(([key, value]) => {
      if (!value) urlParams.delete(key);
      else urlParams.set(key, value);
    });

    router.push(`${pathname}?${urlParams.toString()}`);
  }

  // Chips
  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string }> = [];
    const label = (opts: SelectOption[], id: string) =>
      opts.find((o) => o.id === id)?.label || "…";

    if (selectedBrandId)
      chips.push({
        key: "brand_id",
        label: `Brand: ${label(brandOptions, selectedBrandId)}`,
      });

    if (selectedProductId)
      chips.push({
        key: "product_id",
        label: `Product: ${label(productOptions, selectedProductId)}`,
      });

    if (selectedStudioId)
      chips.push({
        key: "studio_id",
        label: `Studio: ${label(studioOptions, selectedStudioId)}`,
      });

    if (selectedMovieId)
      chips.push({
        key: "movie_id",
        label: `Movie: ${label(movieOptions, selectedMovieId)}`,
      });

    if (selectedNetworkId)
      chips.push({
        key: "network_id",
        label: `Network: ${label(networkOptions, selectedNetworkId)}`,
      });

    if (selectedChannelId)
      chips.push({
        key: "channel_id",
        label: `Channel: ${label(channelOptions, selectedChannelId)}`,
      });

    if (selectedSeriesId)
      chips.push({
        key: "series_id",
        label: `Series: ${label(seriesOptions, selectedSeriesId)}`,
      });

    if (selectedSeasonId)
      chips.push({
        key: "season_id",
        label: `Season: ${label(seasonOptions, selectedSeasonId)}`,
      });

    if (selectedEpisodeId)
      chips.push({
        key: "episode_id",
        label: `Episode: ${label(episodeOptions, selectedEpisodeId)}`,
      });

    if (selectedServiceId)
      chips.push({
        key: "service_id",
        label: `Service: ${label(serviceOptions, selectedServiceId)}`,
      });

    if (selectedSlotType)
      chips.push({ key: "slot", label: `Slot: ${selectedSlotType}` });
    return chips;
  }, [
    selectedBrandId,
    selectedProductId,
    selectedStudioId,
    selectedMovieId,
    selectedNetworkId,
    selectedChannelId,
    selectedSeriesId,
    selectedSeasonId,
    selectedEpisodeId,
    selectedServiceId,
    selectedSlotType,
    brandOptions,
    productOptions,
    studioOptions,
    movieOptions,
    networkOptions,
    channelOptions,
    seriesOptions,
    seasonOptions,
    episodeOptions,
    serviceOptions,
  ]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm grid gap-3">
      {/* Primary selectors row */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Brand/Product */}
        <SelectControl
          label="Brand"
          value={selectedBrandId}
          onChange={(v) =>
            applyQueryPatch({ brand_id: v || null, product_id: null })
          }
          options={brandOptions}
          placeholder="— Any —"
        />
        <SelectControl
          label="Product"
          value={selectedProductId}
          onChange={(v) => applyQueryPatch({ product_id: v || null })}
          options={productOptions}
          placeholder={selectedBrandId ? "— Any —" : "(select brand)"}
          disabled={!selectedBrandId}
        />
        {/* Studio/Movie */}
        <SelectControl
          label="Studio"
          value={selectedStudioId}
          onChange={(v) =>
            applyQueryPatch({ studio_id: v || null, movie_id: null })
          }
          options={studioOptions}
          placeholder="— Any —"
        />
        <SelectControl
          label="Movie"
          value={selectedMovieId}
          onChange={(v) => applyQueryPatch({ movie_id: v || null })}
          options={movieOptions}
          placeholder={selectedStudioId ? "— Any —" : "(select studio)"}
          disabled={!selectedStudioId}
        />
        {/* Slot pills */}
        <SlotPills
          value={selectedSlotType}
          onChange={(v) => applyQueryPatch({ slot: v || null })}
        />
        <div className="flex-1" />
        {/* Saved views control */}
        <div className="flex items-center gap-2">
          <button
            className="text-sm px-2 py-1 border rounded-lg hover:bg-gray-50"
            onClick={saveCurrentView}
          >
            Save view
          </button>
          <SavedViewsMenu
            savedViews={savedViews}
            onApply={applySavedView}
            onDelete={deleteSavedView}
          />
          <button
            onClick={onOpenAdvanced}
            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 hover:bg-gray-50"
          >
            Advanced
          </button>
        </div>
      </div>

      {/* Secondary selectors row (inventory tree) */}
      <div className="flex flex-wrap items-end gap-3">
        <SelectControl
          label="Network"
          value={selectedNetworkId}
          onChange={(v) =>
            applyQueryPatch({
              network_id: v || null,
              channel_id: null,
            })
          }
          options={networkOptions}
          placeholder="— Any —"
        />
        <SelectControl
          label="Channel"
          value={selectedChannelId}
          onChange={(v) => applyQueryPatch({ channel_id: v || null })}
          options={channelOptions}
          placeholder={selectedNetworkId ? "— Any —" : "(select network)"}
          disabled={!selectedNetworkId}
        />
        <SelectControl
          label="Series"
          value={selectedSeriesId}
          onChange={(v) =>
            applyQueryPatch({
              series_id: v || null,
              season_id: null,
              episode_id: null,
            })
          }
          options={seriesOptions}
          placeholder="— Any —"
        />
        <SelectControl
          label="Season"
          value={selectedSeasonId}
          onChange={(v) =>
            applyQueryPatch({
              season_id: v || null,
              episode_id: null,
            })
          }
          options={seasonOptions}
          placeholder={selectedSeriesId ? "— Any —" : "(select series)"}
          disabled={!selectedSeriesId}
        />
        <SelectControl
          label="Episode"
          value={selectedEpisodeId}
          onChange={(v) => applyQueryPatch({ episode_id: v || null })}
          options={episodeOptions}
          placeholder={selectedSeasonId ? "— Any —" : "(select season)"}
          disabled={!selectedSeasonId}
        />
        <SelectControl
          label="Service"
          value={selectedServiceId}
          onChange={(v) => applyQueryPatch({ service_id: v || null })}
          options={serviceOptions}
          placeholder="— Any —"
        />
      </div>

      {/* Active chips */}
      <div className="flex flex-wrap gap-2">
        {activeChips.map((chip) => (
          <button
            key={chip.key}
            onClick={() => applyQueryPatch({ [chip.key]: null })}
            className="text-sm px-2 py-1 rounded-full border border-gray-300 bg-gray-50 hover:bg-gray-100"
          >
            {chip.label} ✕
          </button>
        ))}
        {activeChips.length > 0 && (
          <button
            onClick={() =>
              applyQueryPatch({
                brand_id: null,
                product_id: null,
                studio_id: null,
                movie_id: null,
                network_id: null,
                channel_id: null,
                series_id: null,
                season_id: null,
                episode_id: null,
                service_id: null,
                slot: null,
              })
            }
            className="text-sm px-2 py-1 rounded-lg border hover:bg-gray-50"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}

function SelectControl(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder: string;
  disabled?: boolean;
}) {
  const { label, value, onChange, options, placeholder, disabled } = props;
  return (
    <div className="min-w-[220px]">
      <div className="text-[12px] font-semibold mb-1 opacity-75">{label}</div>
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

function SlotPills({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const options: SelectOption[] = [
    { id: "preroll", label: "Preroll" },
    { id: "midroll", label: "Midroll" },
    { id: "display", label: "Display" },
  ];
  return (
    <div className="min-w-[220px]">
      <div className="text-[12px] font-semibold mb-1 opacity-75">Slot</div>
      <div className="flex gap-2">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => onChange(value === o.id ? "" : o.id)}
            className={`text-sm px-2 py-1 rounded-full border ${value === o.id ? "bg-blue-600 text-white border-blue-700" : "bg-white hover:bg-gray-50 border-gray-300"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SavedViewsMenu({
  savedViews,
  onApply,
  onDelete,
}: {
  savedViews: SavedView[];
  onApply: (index: number) => void;
  onDelete: (index: number) => void;
}) {
  return (
    <div className="relative">
      <details>
        <summary className="cursor-pointer text-sm px-2 py-1 border rounded-lg hover:bg-gray-50">
          Views
        </summary>
        <div className="absolute z-10 mt-2 bg-white border border-gray-200 rounded-lg shadow-sm min-w-[220px] p-2">
          {savedViews.length === 0 && (
            <div className="text-sm opacity-75 px-2 py-1">No saved views</div>
          )}
          {savedViews.map((v, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-2 px-2 py-1"
            >
              <button
                className="text-sm text-blue-700 hover:text-blue-800"
                onClick={() => onApply(i)}
              >
                {v.name}
              </button>
              <button
                className="text-xs px-2 py-0.5 border rounded-lg hover:bg-gray-50"
                onClick={() => onDelete(i)}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
