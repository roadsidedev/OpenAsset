"use client";

import { useEffect, useMemo, useReducer, useRef } from "react";
import {
  CaretDown,
  Check,
  MagnifyingGlass,
  SlidersHorizontal,
  SortDescending,
  X,
} from "@phosphor-icons/react";
import { useMarkets } from "@/hooks/useMarkets";
import { useEnrichedMarkets } from "@/hooks/useEnrichedMarkets";
import { MarketCard } from "@/components/MarketCard";
import { MarketCardSkeleton } from "@/components/skeletons/MarketCardSkeleton";
import { PlatformStatsDashboard } from "@/components/PlatformStatsDashboard";
import { cn } from "@/lib/utils";
import { assetSearchHaystack, ASSET_CATEGORY_LABELS } from "@/lib/assetIdentity";

// Tab values are canonical AssetCategory values (compared against identity.category).
// Labels are display-only — 'Tokenized Equities' renders as 'Tokenized Stocks'.
type Category = "All Markets" | "RWA" | "Tokenized Equities" | "Tokens" | "NFT";

const CATEGORY_TABS: Array<{ value: Category; label: string }> = [
  { value: "All Markets", label: "All Markets" },
  { value: "RWA", label: "RWA" },
  { value: "Tokenized Equities", label: ASSET_CATEGORY_LABELS["Tokenized Equities"] },
  { value: "Tokens", label: "Tokens" },
  { value: "NFT", label: "NFT" },
];
type SortBy = "liquidity" | "apr-asc" | "apr-desc" | "ltv-desc";
type Popover = "sort" | "filters" | null;
type FilterKey =
  | "activeOnly"
  | "verifiedOnly"
  | "liquidOnly"
  | "ltvMax"
  | "aprMax"
  | "minLiquidityUsd"
  | "creatorSearch";

type FilterState = {
  activeOnly: boolean;
  verifiedOnly: boolean;
  liquidOnly: boolean;
  ltvMax: number;
  aprMax: number;
  minLiquidityUsd: number;
  creatorSearch: string;
};

type ControlsState = {
  category: Category;
  search: string;
  sortBy: SortBy;
  filters: FilterState;
  draftFilters: FilterState;
  openPopover: Popover;
};

type ControlsAction =
  | { type: "SET_SEARCH"; value: string }
  | { type: "SET_CATEGORY"; value: Category }
  | { type: "SET_SORT"; value: SortBy }
  | { type: "TOGGLE_POPOVER"; value: Exclude<Popover, null> }
  | { type: "CLOSE_POPOVER" }
  | { type: "SET_DRAFT_FILTERS"; patch: Partial<FilterState> }
  | { type: "APPLY_FILTERS" }
  | { type: "RESET_ALL" }
  | { type: "CLEAR_FILTER"; key: FilterKey };

const SORT_OPTIONS: Array<{ value: SortBy; label: string; triggerLabel: string }> = [
  { value: "liquidity", label: "Highest Liquidity", triggerLabel: "Liquidity ↓" },
  { value: "apr-asc", label: "Lowest Borrow APR", triggerLabel: "Borrow APR ↑" },
  { value: "apr-desc", label: "Highest Borrow APR", triggerLabel: "Borrow APR ↓" },
  { value: "ltv-desc", label: "Highest Max LTV", triggerLabel: "Max LTV ↓" },
];

function createDefaultFilters(): FilterState {
  return {
    activeOnly: false,
    verifiedOnly: false,
    liquidOnly: false,
    ltvMax: 10000,
    aprMax: 10000,
    minLiquidityUsd: 0,
    creatorSearch: "",
  };
}

function createInitialControls(): ControlsState {
  const filters = createDefaultFilters();
  return {
    category: "All Markets",
    search: "",
    sortBy: "liquidity",
    filters,
    draftFilters: { ...filters },
    openPopover: null,
  };
}

function controlsReducer(state: ControlsState, action: ControlsAction): ControlsState {
  switch (action.type) {
    case "SET_SEARCH":
      return { ...state, search: action.value };
    case "SET_CATEGORY":
      return { ...state, category: action.value };
    case "SET_SORT":
      return { ...state, sortBy: action.value, openPopover: null };
    case "TOGGLE_POPOVER": {
      const isOpening = state.openPopover !== action.value;
      return {
        ...state,
        openPopover: isOpening ? action.value : null,
        draftFilters:
          isOpening && action.value === "filters"
            ? { ...state.filters }
            : state.draftFilters,
      };
    }
    case "CLOSE_POPOVER":
      return { ...state, openPopover: null };
    case "SET_DRAFT_FILTERS":
      return {
        ...state,
        draftFilters: { ...state.draftFilters, ...action.patch },
      };
    case "APPLY_FILTERS":
      return {
        ...state,
        filters: { ...state.draftFilters },
        openPopover: null,
      };
    case "RESET_ALL": {
      const initial = createInitialControls();
      return { ...initial, openPopover: state.openPopover };
    }
    case "CLEAR_FILTER": {
      const defaults = createDefaultFilters();
      return {
        ...state,
        filters: { ...state.filters, [action.key]: defaults[action.key] },
        draftFilters: { ...state.draftFilters, [action.key]: defaults[action.key] },
      };
    }
  }
}

function liquidityUsd(value: string | undefined): number {
  try {
    return Number(BigInt(value || "0")) / 1_000_000;
  } catch {
    return 0;
  }
}

function countActiveFilters(filters: FilterState): number {
  return [
    filters.activeOnly,
    filters.verifiedOnly,
    filters.liquidOnly,
    filters.ltvMax !== 10000,
    filters.aprMax !== 10000,
    filters.minLiquidityUsd > 0,
    filters.creatorSearch.trim() !== "",
  ].filter(Boolean).length;
}

function formatPercentBps(value: number): string {
  return `${(value / 100).toFixed(value % 100 === 0 ? 0 : 1)}%`;
}

function formatLiquidityChip(value: number): string {
  if (value >= 1000000) return `$${value / 1000000}M+`;
  if (value >= 1000) return `$${value / 1000}K+`;
  return `$${value}+`;
}

function ActiveFilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={onClear}
      aria-label={`Clear ${label} filter`}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1.5 text-[11px] font-medium text-foreground shadow-sm transition-colors hover:border-foreground/20 hover:bg-muted"
    >
      <span>{label}</span>
      <X aria-hidden="true" className="h-3 w-3 text-muted-foreground" />
    </button>
  );
}

type ControlBarProps = {
  state: ControlsState;
  dispatch: React.Dispatch<ControlsAction>;
  filterCount: number;
};

function ControlBar({ state, dispatch, filterCount }: ControlBarProps) {
  const controlBarRef = useRef<HTMLDivElement>(null);
  const selectedSort = SORT_OPTIONS.find((option) => option.value === state.sortBy) || SORT_OPTIONS[0];

  useEffect(() => {
    if (!state.openPopover) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!controlBarRef.current?.contains(event.target as Node)) {
        dispatch({ type: "CLOSE_POPOVER" });
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dispatch({ type: "CLOSE_POPOVER" });
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [dispatch, state.openPopover]);

  return (
    <div
      ref={controlBarRef}
      className="relative z-20 flex w-full flex-row items-stretch rounded-[28px] border border-border/80 bg-muted/60 p-1.5 shadow-[0_18px_48px_-28px_rgba(15,23,42,0.45)] backdrop-blur-sm"
    >
      {/* Segment A: instant search */}
      <div className="flex min-w-0 flex-1 items-center px-2.5 py-2 md:px-4 md:py-2.5">
        <MagnifyingGlass aria-hidden="true" className="mr-2.5 h-[18px] w-[18px] shrink-0 text-muted-foreground" />
        <input
          type="search"
          aria-label="Search markets by name, symbol, or address"
          placeholder="Search markets by name, symbol, or address..."
          value={state.search}
          onChange={(event) => dispatch({ type: "SET_SEARCH", value: event.target.value })}
          className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground sm:text-sm"
        />
        {state.search && (
          <button
            type="button"
            onClick={() => dispatch({ type: "SET_SEARCH", value: "" })}
            aria-label="Clear market search"
            className="ml-2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="my-2 h-auto w-px shrink-0 bg-border" />

      {/* Segment B: sort popover */}
      <div className="relative flex min-w-[118px] shrink-0 items-center md:min-w-[184px]">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={state.openPopover === "sort"}
          onClick={() => dispatch({ type: "TOGGLE_POPOVER", value: "sort" })}
          className="flex w-full items-center justify-between gap-1.5 rounded-[20px] px-2.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted sm:text-sm md:px-4 md:py-2.5"
        >
          <span className="flex min-w-0 items-center gap-2">
            <SortDescending aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
            <span className="truncate">{selectedSort.triggerLabel}</span>
          </span>
          <CaretDown aria-hidden="true" className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", state.openPopover === "sort" && "rotate-180")} />
        </button>
        {state.openPopover === "sort" && (
          <div role="menu" className="absolute right-0 top-[calc(100%+10px)] z-50 w-64 rounded-2xl border border-border bg-card p-1.5 shadow-[0_20px_50px_-20px_rgba(15,23,42,0.35)]">
            <p className="px-3 pb-1.5 pt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Sort markets</p>
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="menuitem"
                onClick={() => dispatch({ type: "SET_SORT", value: option.value })}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
              >
                <span>{option.label}</span>
                {state.sortBy === option.value && <Check aria-hidden="true" className="h-4 w-4 text-ice-600" weight="bold" />}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="my-2 h-auto w-px shrink-0 bg-border" />

      {/* Segment C: filter drawer popover */}
      <div className="relative flex min-w-[105px] shrink-0 items-center md:min-w-[132px]">
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={state.openPopover === "filters"}
          onClick={() => dispatch({ type: "TOGGLE_POPOVER", value: "filters" })}
          className="flex w-full items-center justify-between gap-1.5 rounded-[20px] px-2.5 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted sm:text-sm md:px-4 md:py-2.5"
        >
          <span className="flex items-center gap-2">
            <SlidersHorizontal aria-hidden="true" className="h-[18px] w-[18px] text-foreground" />
            Filters
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 py-0.5 text-[10px] font-bold leading-none text-background">
              {filterCount}
            </span>
          </span>
          <CaretDown aria-hidden="true" className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", state.openPopover === "filters" && "rotate-180")} />
        </button>
        {state.openPopover === "filters" && (
          <div role="dialog" aria-label="Market filters" className="absolute right-0 top-[calc(100%+10px)] z-50 max-h-[calc(100dvh-2rem)] w-[min(420px,calc(100vw-2rem))] overflow-y-auto rounded-[26px] border border-border bg-card p-5 shadow-[0_24px_70px_-24px_rgba(15,23,42,0.42)]">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-lg font-semibold tracking-[-0.02em] text-foreground">
                  <SlidersHorizontal aria-hidden="true" className="h-5 w-5 text-ice-600" />
                  Market Filters
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Refine the markets shown below.</p>
              </div>
              <button
                type="button"
                onClick={() => dispatch({ type: "RESET_ALL" })}
                className="shrink-0 text-sm font-semibold text-ice-600 underline-offset-2 transition-colors hover:underline dark:text-ice-400"
              >
                Reset all
              </button>
            </div>

            <div className="space-y-1 border-y border-border py-3">
              {([
                ["activeOnly", "Active markets only"],
                ["verifiedOnly", "Verified / low-risk markets"],
                ["liquidOnly", "Has active liquidity"],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-2.5 py-3 text-sm text-foreground transition-colors hover:bg-muted">
                  <span>{label}</span>
                  <input
                    type="checkbox"
                    checked={state.draftFilters[key]}
                    onChange={(event) => dispatch({ type: "SET_DRAFT_FILTERS", patch: { [key]: event.target.checked } })}
                    className="h-5 w-5 shrink-0 rounded border-border accent-foreground"
                  />
                </label>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 border-b border-border py-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                LTV Limit
                <select
                  value={state.draftFilters.ltvMax}
                  onChange={(event) => dispatch({ type: "SET_DRAFT_FILTERS", patch: { ltvMax: Number(event.target.value) } })}
                  className="mt-1 h-12 w-full rounded-2xl border border-border bg-muted/40 px-3 text-base font-normal text-foreground outline-none transition-colors focus:border-foreground/25 focus:bg-card"
                >
                  <option value={10000}>No limit</option>
                  <option value={8000}>Max 80%</option>
                  <option value={7000}>Max 70%</option>
                  <option value={6000}>Max 60%</option>
                </select>
              </label>
              <label className="space-y-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Borrow APR
                <select
                  value={state.draftFilters.aprMax}
                  onChange={(event) => dispatch({ type: "SET_DRAFT_FILTERS", patch: { aprMax: Number(event.target.value) } })}
                  className="mt-1 h-12 w-full rounded-2xl border border-border bg-muted/40 px-3 text-base font-normal text-foreground outline-none transition-colors focus:border-foreground/25 focus:bg-card"
                >
                  <option value={10000}>No limit</option>
                  <option value={1000}>Under 10%</option>
                  <option value={1500}>Under 15%</option>
                  <option value={2000}>Under 20%</option>
                </select>
              </label>
              <label className="space-y-1.5 text-xs font-medium text-muted-foreground sm:col-span-2">
                Min Liquidity threshold
                <select
                  value={state.draftFilters.minLiquidityUsd}
                  onChange={(event) => dispatch({ type: "SET_DRAFT_FILTERS", patch: { minLiquidityUsd: Number(event.target.value) } })}
                  className="mt-1 h-12 w-full rounded-2xl border border-border bg-muted/40 px-3 text-base font-normal text-foreground outline-none transition-colors focus:border-foreground/25 focus:bg-card"
                >
                  <option value={0}>Any liquidity</option>
                  <option value={1000}>$1K+</option>
                  <option value={10000}>$10K+</option>
                  <option value={100000}>$100K+</option>
                </select>
              </label>
            </div>

            <label className="mt-4 block space-y-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Creator address filter
              <input
                type="text"
                inputMode="text"
                placeholder="0x..."
                value={state.draftFilters.creatorSearch}
                onChange={(event) => dispatch({ type: "SET_DRAFT_FILTERS", patch: { creatorSearch: event.target.value } })}
                className="mt-1 h-12 w-full rounded-2xl border border-border bg-muted/40 px-3 text-base font-normal text-foreground outline-none placeholder:text-muted-foreground transition-colors focus:border-foreground/25 focus:bg-card"
              />
            </label>

            <button
              type="button"
              onClick={() => dispatch({ type: "APPLY_FILTERS" })}
              className="mt-5 flex h-12 w-full items-center justify-center rounded-2xl bg-foreground text-sm font-semibold text-background transition-colors hover:bg-foreground/90"
            >
              Apply Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MarketsPage() {
  const [controls, dispatch] = useReducer(controlsReducer, undefined, createInitialControls);
  const { data, isLoading, error } = useMarkets(0, 50);
  const { category, search, sortBy, filters } = controls;
  const filterCount = countActiveFilters(filters);

  const allMarkets = data?.markets || [];
  const { enriched } = useEnrichedMarkets(allMarkets);

  const filteredEnriched = useMemo(() => {
    let list = enriched;
    const normalizedSearch = search.trim().toLowerCase();
    const normalizedCreator = filters.creatorSearch.trim().toLowerCase();

    if (category !== "All Markets") {
      list = list.filter((entry) => entry.identity.category === category);
    }
    if (normalizedSearch) {
      list = list.filter((entry) => assetSearchHaystack(entry.identity, entry.market).includes(normalizedSearch));
    }
    if (normalizedCreator) {
      list = list.filter((entry) => (entry.market.owner || "").toLowerCase().includes(normalizedCreator));
    }
    if (filters.activeOnly) {
      list = list.filter((entry) => entry.market.active);
    }
    if (filters.liquidOnly) {
      list = list.filter((entry) => liquidityUsd(entry.market.liquidity.available) > 0);
    }
    if (filters.verifiedOnly) {
      const emptyProviderId = `0x${"0".repeat(64)}`;
      list = list.filter(
        (entry) =>
          (!!entry.market.providerId && entry.market.providerId !== emptyProviderId) ||
          entry.identity.category !== "Tokens" ||
          entry.market.ltvBps <= 7500,
      );
    }

    list = list.filter((entry) => entry.market.ltvBps <= filters.ltvMax);
    list = list.filter((entry) => entry.market.aprBps <= filters.aprMax);
    if (filters.minLiquidityUsd > 0) {
      list = list.filter((entry) => liquidityUsd(entry.market.liquidity.available) >= filters.minLiquidityUsd);
    }

    return [...list].sort((a, b) => {
      switch (sortBy) {
        case "liquidity":
          return liquidityUsd(b.market.liquidity.available) - liquidityUsd(a.market.liquidity.available);
        case "apr-asc":
          return a.market.aprBps - b.market.aprBps;
        case "apr-desc":
          return b.market.aprBps - a.market.aprBps;
        case "ltv-desc":
          return b.market.ltvBps - a.market.ltvBps;
      }
    });
  }, [enriched, category, search, filters, sortBy]);

  const activeFilterChips = [
    filters.activeOnly
      ? { label: "Active only", key: "activeOnly" as FilterKey }
      : null,
    filters.verifiedOnly
      ? { label: "Verified / low-risk", key: "verifiedOnly" as FilterKey }
      : null,
    filters.liquidOnly
      ? { label: "Has active liquidity", key: "liquidOnly" as FilterKey }
      : null,
    filters.ltvMax !== 10000
      ? { label: `LTV ≤ ${formatPercentBps(filters.ltvMax)}`, key: "ltvMax" as FilterKey }
      : null,
    filters.aprMax !== 10000
      ? { label: `APR ≤ ${formatPercentBps(filters.aprMax)}`, key: "aprMax" as FilterKey }
      : null,
    filters.minLiquidityUsd > 0
      ? { label: `Liquidity ≥ ${formatLiquidityChip(filters.minLiquidityUsd)}`, key: "minLiquidityUsd" as FilterKey }
      : null,
    filters.creatorSearch.trim()
      ? {
          label: `Creator ${filters.creatorSearch.trim().slice(0, 8)}…`,
          key: "creatorSearch" as FilterKey,
        }
      : null,
  ].filter((chip): chip is { label: string; key: FilterKey } => chip !== null);

  return (
    <div className="min-h-dvh">
      <main className="mx-auto max-w-[1160px] px-4 py-6 md:px-6 md:py-7">
        <section className="space-y-3.5">
          <div className="flex items-baseline justify-between gap-4">
            <h1 className="font-display text-[28px] leading-[0.95] tracking-[-0.025em] text-foreground md:text-[32px]">
              Market pulse
            </h1>
            <span className="hidden items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground md:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Network · Active
            </span>
          </div>
          <PlatformStatsDashboard />
        </section>

        <section className="mt-8 space-y-4 md:mt-10">
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-display text-[22px] leading-none tracking-[-0.022em] text-foreground md:text-[24px]">
              Open markets
            </h2>
            <span className="hidden text-xs text-muted-foreground md:inline">
              {filteredEnriched.length} {filteredEnriched.length === 1 ? "market" : "markets"}
            </span>
          </div>

          <ControlBar state={controls} dispatch={dispatch} filterCount={filterCount} />

          {/* Category navigation and applied filter chips */}
          <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 max-w-full items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
              {CATEGORY_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => dispatch({ type: "SET_CATEGORY", value: tab.value })}
                  className={cn(
                    "shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-medium leading-none transition-colors",
                    category === tab.value
                      ? "bg-foreground text-background"
                      : "border border-border bg-card text-muted-foreground hover:border-foreground/15 hover:text-foreground",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeFilterChips.length > 0 && (
              <div className="flex min-w-0 max-w-full items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide md:justify-end">
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Applied</span>
                {activeFilterChips.map((chip) => (
                  <ActiveFilterChip
                    key={chip.key}
                    label={chip.label}
                    onClear={() => dispatch({ type: "CLEAR_FILTER", key: chip.key })}
                  />
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-2xl border border-destructive/50 bg-destructive/10 p-3.5 text-sm text-destructive">
              Error loading markets: {error.message}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {isLoading
              ? Array.from({ length: 6 }).map((_, index) => <MarketCardSkeleton key={index} />)
              : filteredEnriched.length > 0
                ? filteredEnriched.map(({ market, identity, oracleLabel, loanAssetSymbol }) => (
                    <MarketCard
                      key={market.marketAddress}
                      market={market}
                      identity={identity}
                      oracleLabel={oracleLabel}
                      loanAssetSymbol={loanAssetSymbol}
                    />
                  ))
                : (
                    <div className="col-span-full rounded-2xl border border-dashed border-border bg-card/50 py-12 text-center">
                      <p className="text-sm font-medium text-foreground">No markets found</p>
                      <p className="mt-1 text-xs text-muted-foreground">Try adjusting your search or filters.</p>
                    </div>
                  )}
          </div>
        </section>
      </main>
    </div>
  );
}
