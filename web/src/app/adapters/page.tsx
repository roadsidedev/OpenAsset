"use client";

/**
 * @file adapters/page.tsx
 * @description Adapter Registry explorer + permissionless registration.
 *
 * End-to-end flow:
 * - Reads are chain-scoped to the SELECTED chain (chain selector across
 *   deployable networks), never the wallet's incidental chain, via a
 *   standalone client that can't throw the wagmi lazy-client render error.
 * - Registration is permissionless on-chain (`registerAdapterWithMetadata`);
 *   the CTA is auth-aware (fires Privy login when signed out) and
 *   chain-aware (silent switch for embedded wallets, one-click banner
 *   otherwise) through the shared write path in useContractInteraction.
 * - The in-page guide walks authors from interface to verification.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { type Address, isAddress } from "viem";
import { usePrivy } from "@privy-io/react-auth";
import { toast } from "sonner";
import { AdapterBadge } from "@/components/adapters/AdapterBadge";
import { ADAPTER_REGISTRY_ABI_TYPED, ADAPTER_TYPES } from "@/lib/contractAbis";
import { getContracts } from "@/lib/contracts";
import { getAdapterMeta, getAdapterFallbackName, getDeployedAdapters } from "@/lib/adapterRegistry";
import { createChainClient, DEFAULT_CHAIN_ID } from "@/lib/chains";
import { getChainLabel } from "@/lib/chainLabels";
import { decodeContractError } from "@/lib/contractErrors";
import { useSession } from "@/context/SessionContext";
import { useChainOrchestrator } from "@/hooks/useChainOrchestrator";
import { useContractInteraction } from "@/hooks/useContractInteraction";
import { useTxTrail } from "@/store/useTxTrail";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PuzzlePiece, ArrowsClockwise, Plus, BookOpen, CheckCircle } from "@phosphor-icons/react";

interface AdapterRow {
  adapterAddress: string;
  adapterType: number;
  registeredBy: string;
  verified: boolean;
  deprecated: boolean;
  auditReference: string;
  registeredAt: number;
  totalValueSecured: string;
  selectable: boolean;
  // On-chain developer catalog record (may be absent for legacy entries).
  metaName?: string;
  metaVersion?: string;
  reviewStatus?: number;
  usageCount?: string;
}

const TYPE_FILTERS = ["All", "ASSET", "ORACLE", "COMPLIANCE", "LIQUIDATION", "POSITION"] as const;
const TYPE_IDS: Record<string, number> = { ASSET: 0, ORACLE: 1, COMPLIANCE: 2, LIQUIDATION: 3, POSITION: 4 };
/** Chains with a registry deployment — the registry's supported networks. */
const REGISTRY_CHAINS = [84532, 11155111, 46630];

const REVIEW_LABELS = ["Unreviewed", "In review", "Approved", "Rejected"];

const GUIDE_STEPS = [
  {
    title: "Implement one of the five interfaces",
    body: "IAssetAdapter, IOracleAdapter, IComplianceAdapter, ILiquidationAdapter or IPositionAdapter. Start from the matching reference adapter in contracts/src/adapters and keep the exact function signatures — the engine calls them identically whether verified or not.",
  },
  {
    title: "Deploy your adapter contract",
    body: "Deploy to the network you want to serve (Base Sepolia for testing). Your adapter must be a deployed contract — the form checks on-chain bytecode before submitting.",
  },
  {
    title: "Register permissionlessly",
    body: "Use the Register adapter button on this page. Registration is open to anyone and starts as Unverified / Unreviewed. One transaction, no allowlist, no fee beyond gas.",
  },
  {
    title: "Fill in the catalog record",
    body: "Name, semantic version, category, supported assets, docs and repository URIs are stored on-chain via registerAdapterWithMetadata so market creators can evaluate your adapter. You can update them later with updateMetadata (developer only).",
  },
  {
    title: "Request verification (optional)",
    body: "Audit governance reviews committed source, tests and assumptions against the verification policy, then calls markVerified with an audit reference. Verified is a trust signal, not insurance — the engine independently verifies adapter outputs at runtime.",
  },
  {
    title: "Get used, stay maintained",
    body: "Usage and secured value accrue via recordUsage as markets adopt your adapter. If a critical issue appears, governance can markDeprecated — blocking new selection while existing markets keep running with warnings.",
  },
];

export default function AdaptersPage() {
  const session = useSession();
  const { login: privyLogin } = usePrivy();
  const { nudgeChain } = useChainOrchestrator();
  const { registerAdapterWithMetadata, isLoading: isTxLoading } = useContractInteraction();
  const recordTx = useTxTrail((s) => s.record);

  // Selected chain is the source of truth for every read and write below.
  const [selectedChain, setSelectedChain] = useState<number>(() =>
    session.chainId && REGISTRY_CHAINS.includes(session.chainId) ? session.chainId : DEFAULT_CHAIN_ID,
  );
  const [filter, setFilter] = useState<string>("All");
  const [rows, setRows] = useState<AdapterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  // Register form state.
  const [formAddress, setFormAddress] = useState("");
  const [formType, setFormType] = useState("0");
  const [formName, setFormName] = useState("");
  const [formVersion, setFormVersion] = useState("1.0.0");
  const [formCategory, setFormCategory] = useState("ASSET");
  const [formAssets, setFormAssets] = useState("");
  const [formDocs, setFormDocs] = useState("");
  const [formRepo, setFormRepo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const registryAddress = useMemo(() => {
    const addr = getContracts(selectedChain)?.adapterRegistry;
    return addr && addr !== "0x0000000000000000000000000000000000000000" ? addr : undefined;
  }, [selectedChain]);

  const chainClient = useMemo(() => createChainClient(selectedChain), [selectedChain]);

  const loadRegistry = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (!registryAddress || !chainClient) {
      setRows([]);
      setError(
        registryAddress
          ? "Network client unavailable. Check your connection and retry."
          : `No AdapterRegistry deployed on ${getChainLabel(selectedChain)} yet.`,
      );
      setLoading(false);
      return;
    }
    try {
      const addresses = (await chainClient.readContract({
        address: registryAddress as Address,
        abi: ADAPTER_REGISTRY_ABI_TYPED,
        functionName: "getAllAdapters",
      })) as string[];

      const settled = await Promise.allSettled(
        addresses.map(async (addr) => {
          const [info, meta, selectable] = await Promise.all([
            chainClient.readContract({
              address: registryAddress as Address,
              abi: ADAPTER_REGISTRY_ABI_TYPED,
              functionName: "getAdapterInfo",
              args: [addr as Address],
            }) as Promise<readonly [string, number, string, boolean, boolean, string, bigint, bigint]>,
            chainClient
              .readContract({
                address: registryAddress as Address,
                abi: ADAPTER_REGISTRY_ABI_TYPED,
                functionName: "getAdapterMetadata",
                args: [addr as Address],
              })
              .catch(() => null) as Promise<readonly [string, string, string, string, string, string, string, string, number, bigint] | null>,
            chainClient
              .readContract({
                address: registryAddress as Address,
                abi: ADAPTER_REGISTRY_ABI_TYPED,
                functionName: "isSelectable",
                args: [addr as Address],
              })
              .catch(() => true) as Promise<boolean>,
          ]);
          return { addr, info, meta, selectable };
        }),
      );

      const next: AdapterRow[] = [];
      for (const r of settled) {
        if (r.status !== "fulfilled") continue;
        const { addr, info, meta, selectable } = r.value;
        next.push({
          adapterAddress: addr,
          adapterType: Number(info[1]),
          registeredBy: info[2],
          verified: info[3],
          deprecated: info[4],
          auditReference: info[5],
          registeredAt: Number(info[6]),
          totalValueSecured: (info[7] as bigint).toString(),
          selectable: selectable && !info[4],
          metaName: meta?.[0] || undefined,
          metaVersion: meta?.[1] || undefined,
          reviewStatus: meta ? Number(meta[8]) : undefined,
          usageCount: meta ? (meta[9] as bigint).toString() : undefined,
        });
      }
      // Newest first.
      next.sort((a, b) => b.registeredAt - a.registeredAt);
      setRows(next);
    } catch (err) {
      setRows([]);
      setError(decodeContractError(err));
    } finally {
      setLoading(false);
    }
  }, [registryAddress, chainClient, selectedChain]);

  useEffect(() => {
    void loadRegistry();
  }, [loadRegistry, refreshKey]);

  const pickChain = (chainId: number) => {
    setSelectedChain(chainId);
    setRefreshKey((k) => k + 1);
    if (session.chainId !== undefined && session.chainId !== chainId) {
      nudgeChain(chainId, `Adapter registry lives on ${getChainLabel(chainId)}`);
    }
  };

  const onChainAddresses = useMemo(() => new Set(rows.map((r) => r.adapterAddress.toLowerCase())), [rows]);
  const unregisteredDeployments = useMemo(
    () => getDeployedAdapters(selectedChain).filter((d) => !onChainAddresses.has(d.address.toLowerCase())),
    [selectedChain, onChainAddresses],
  );

  const stats = useMemo(() => {
    const verified = rows.filter((r) => r.verified && !r.deprecated).length;
    const deprecated = rows.filter((r) => r.deprecated).length;
    return { total: rows.length, verified, deprecated, unverified: rows.length - verified - deprecated };
  }, [rows]);

  const filtered = filter === "All" ? rows : rows.filter((r) => ADAPTER_TYPES[r.adapterType] === filter);

  const openRegister = (prefillAddress?: string, prefillType?: string) => {
    if (session.ready && (!session.isAuthenticated || !session.address)) {
      try {
        void (privyLogin as (() => unknown) | undefined)?.();
      } catch {
        toast.error("Sign in to register an adapter.");
      }
      return;
    }
    if (prefillAddress) setFormAddress(prefillAddress);
    if (prefillType !== undefined) {
      setFormType(prefillType);
      setFormCategory(ADAPTER_TYPES[Number(prefillType)] ?? "ASSET");
    }
    setRegisterOpen(true);
  };

  const handleRegister = async () => {
    if (!registryAddress || !chainClient) {
      toast.error("Registry is not available on this network.");
      return;
    }
    const adapter = formAddress.trim();
    if (!isAddress(adapter)) {
      toast.error("Enter a valid 0x adapter address.");
      return;
    }
    if (!formName.trim()) {
      toast.error("Give your adapter a name.");
      return;
    }
    setSubmitting(true);
    try {
      // Preflight 1: must be a deployed contract on the selected chain.
      const code = await chainClient.getBytecode({ address: adapter as Address });
      if (!code || code === "0x") {
        toast.error(`${adapter.slice(0, 10)}… is not a contract on ${getChainLabel(selectedChain)}.`);
        return;
      }
      // Preflight 2: fail fast on duplicates (chain reverts AlreadyRegistered).
      try {
        await chainClient.readContract({
          address: registryAddress as Address,
          abi: ADAPTER_REGISTRY_ABI_TYPED,
          functionName: "getAdapterInfo",
          args: [adapter as Address],
        });
        toast.error("This adapter is already registered on this network.");
        return;
      } catch {
        // Not registered — the expected path. getAdapterInfo reverts otherwise.
      }

      const toastId = toast.loading("Waiting for wallet confirmation…");
      const result = await registerAdapterWithMetadata(
        registryAddress,
        {
          adapterAddress: adapter,
          adapterType: Number(formType),
          name: formName.trim(),
          version: formVersion.trim() || "1.0.0",
          category: formCategory.trim() || ADAPTER_TYPES[Number(formType)] || "ASSET",
          supportedAssets: formAssets.trim(),
          documentationURI: formDocs.trim(),
          repositoryURI: formRepo.trim(),
        },
        selectedChain,
      );
      toast.success("Adapter registered!", {
        id: toastId,
        description: `Tx: ${result.txHash.slice(0, 10)}…${result.txHash.slice(-8)}`,
      });
      if (session.address) {
        recordTx({
          type: "ADAPTER_REGISTERED",
          txHash: result.txHash,
          chainId: selectedChain,
          address: session.address,
          summary: `${formName.trim()} (${ADAPTER_TYPES[Number(formType)]}) registered`,
          details: {
            adapter: adapter,
            txHash: result.txHash,
            message: `${formName.trim()} registered on ${getChainLabel(selectedChain)}`,
          },
        });
      }
      setRegisterOpen(false);
      setFormAddress("");
      setFormName("");
      setFormAssets("");
      setFormDocs("");
      setFormRepo("");
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(decodeContractError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh">
      <main className="mx-auto max-w-5xl px-4 py-8 md:px-8 space-y-8">
        {/* Header + CTA */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <PuzzlePiece className="h-6 w-6 text-ice-500" />
              <h1 className="text-2xl font-bold text-foreground text-balance">Adapter Registry</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Permissionless registration, governance-reviewed trust. Data sourced on-chain from the registry on{" "}
              <span className="font-semibold text-foreground">{getChainLabel(selectedChain)}</span>.
            </p>
          </div>
          <Button
            onClick={() => openRegister()}
            disabled={isTxLoading}
            className="shrink-0 rounded-2xl bg-ice-300 dark:bg-ice-400 text-slate-900 font-bold hover:bg-ice-400 dark:hover:bg-ice-300"
          >
            <Plus className="h-4 w-4" />
            {session.ready && (!session.isAuthenticated || !session.address) ? "Sign in to register" : "Register adapter"}
          </Button>
        </div>

        {/* Chain selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-muted-foreground">Network:</span>
          {REGISTRY_CHAINS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => pickChain(id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                id === selectedChain
                  ? "border-ice-400 bg-ice-500/10 text-ice-700 dark:text-ice-300"
                  : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-ice-300/50",
              )}
            >
              {getChainLabel(id)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loading}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <ArrowsClockwise className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </button>
        </div>

        {/* Stats */}
        {!loading && !error && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Registered", value: stats.total },
              { label: "Verified", value: stats.verified },
              { label: "Unverified", value: stats.unverified },
              { label: "Deprecated", value: stats.deprecated },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-border bg-card p-3 text-center">
                <div className="text-lg font-bold text-foreground">{s.value}</div>
                <div className="text-[11px] text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Guide */}
        <div className="rounded-2xl border border-border bg-muted/20">
          <button
            type="button"
            onClick={() => setGuideOpen(!guideOpen)}
            className="w-full flex items-center gap-3 p-4 text-left"
            aria-expanded={guideOpen}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ice-400/15 text-ice-600 dark:text-ice-300">
              <BookOpen className="h-4.5 w-4.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">How to register an adapter</span>
              <span className="block text-xs text-muted-foreground mt-0.5">
                Implement → deploy → register → get verified. Takes one transaction.
              </span>
            </span>
            <span className={cn("text-muted-foreground transition-transform", guideOpen && "rotate-180")}>▾</span>
          </button>
          {guideOpen && (
            <ol className="px-4 pb-4 space-y-3">
              {GUIDE_STEPS.map((step, i) => (
                <li key={step.title} className="flex gap-3 rounded-xl border border-border/60 bg-card p-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ice-400/15 text-xs font-bold text-ice-700 dark:text-ice-300">
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-foreground">{step.title}</span>
                    <span className="block text-xs text-muted-foreground mt-1 leading-relaxed">{step.body}</span>
                  </span>
                </li>
              ))}
              <li className="rounded-xl border border-ice-300/30 bg-ice-50 dark:bg-ice-500/10 p-3 text-xs text-muted-foreground leading-relaxed">
                Registration never implies verification, and deprecation never pauses existing markets — it only blocks
                new selection. See the full <Link href="/docs/protocol/adapter-registry" className="font-semibold text-ice-700 dark:text-ice-300 hover:underline">registry spec</Link> and the{" "}
                <Link href="/docs/guides/register-adapter" className="font-semibold text-ice-700 dark:text-ice-300 hover:underline">developer walkthrough</Link>.
              </li>
            </ol>
          )}
        </div>

        {/* Unregistered reference deployments */}
        {!loading && !error && unregisteredDeployments.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-foreground">
              Reference deployments not yet registered ({unregisteredDeployments.length})
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {unregisteredDeployments.map((d) => (
                <div key={d.address} className="rounded-2xl border border-dashed border-border bg-card p-4 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground">{d.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">{d.type}</span>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground truncate">{d.address}</p>
                  <button
                    type="button"
                    onClick={() => openRegister(d.address, String(TYPE_IDS[d.type] ?? 0))}
                    className="inline-flex items-center gap-1.5 rounded-full border border-ice-300/40 px-3 py-1.5 text-xs font-semibold text-ice-700 dark:text-ice-300 hover:bg-ice-500/10 transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                    Register this adapter
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 text-xs font-medium scrollbar-hide">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={cn(
                "whitespace-nowrap rounded-xl px-4 py-2 transition-colors",
                filter === t
                  ? "bg-primary text-primary-foreground font-bold"
                  : "bg-card border border-border text-muted-foreground hover:border-ice-300/50 hover:text-foreground"
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-muted/50 animate-pulse" />
            ))}
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-xs text-destructive">
            {error}
          </div>
        )}

        {/* Adapter Cards Grid */}
        {!loading && !error && (
          <div className="grid gap-4 sm:grid-cols-2">
            {filtered.map((adapter) => {
              const localMeta = getAdapterMeta(selectedChain, adapter.adapterAddress);
              const displayName = adapter.metaName || localMeta?.name || getAdapterFallbackName(adapter.adapterType, adapter.adapterAddress);
              return (
                <div
                  key={adapter.adapterAddress}
                  className="group rounded-2xl border border-border bg-card p-5 transition-all hover:border-ice-300/30 hover-lift"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        {ADAPTER_TYPES[adapter.adapterType]}
                      </span>
                      <p className="mt-1 text-sm font-semibold text-foreground truncate">{displayName}</p>
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground truncate">
                        {adapter.adapterAddress.slice(0, 10)}...{adapter.adapterAddress.slice(-6)}
                      </p>
                    </div>
                    <AdapterBadge verified={adapter.verified} deprecated={adapter.deprecated} />
                  </div>
                  <div className="mt-3 flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
                    {adapter.metaVersion || localMeta?.version ? (
                      <span className="rounded-md bg-muted px-2 py-0.5 font-medium">{adapter.metaVersion || localMeta?.version}</span>
                    ) : null}
                    {adapter.reviewStatus !== undefined && (
                      <span className="rounded-md bg-muted px-2 py-0.5 font-medium">{REVIEW_LABELS[adapter.reviewStatus] ?? "Unknown"}</span>
                    )}
                    {!adapter.selectable && (
                      <span className="rounded-md bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-600 dark:text-amber-400">
                        {adapter.deprecated ? "Deprecated" : "Not selectable"}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground space-y-0.5">
                    <p>
                      By <span className="font-mono">{adapter.registeredBy.slice(0, 10)}…</span>
                      {adapter.registeredAt > 0 && (
                        <> · {new Date(adapter.registeredAt * 1000).toLocaleDateString()}</>
                      )}
                      {adapter.usageCount !== undefined && Number(adapter.usageCount) > 0 && (
                        <> · used {adapter.usageCount}×</>
                      )}
                    </p>
                    {adapter.auditReference && (
                      <p>
                        Audit: <span className="font-medium">{adapter.auditReference}</span>
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-16 space-y-4">
            <PuzzlePiece className="h-12 w-12 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground text-sm">
              {rows.length === 0 ? "No adapters registered on this network yet — be the first." : "No adapters found for this filter."}
            </p>
            {rows.length === 0 && (
              <Button onClick={() => openRegister()} variant="outline" className="rounded-2xl">
                <Plus className="h-4 w-4" />
                Register the first adapter
              </Button>
            )}
          </div>
        )}
      </main>

      {/* Register sheet — compact floating panel, same pattern as the workspace menu */}
      <Sheet open={registerOpen} onOpenChange={setRegisterOpen}>
        <SheetContent
          side="left"
          showCloseButton
          className="workspace-menu-panel !inset-y-auto !bottom-auto !left-4 !right-auto !top-20 !h-auto !w-[min(440px,calc(100vw-2rem))] !max-w-none max-h-[calc(100vh-6rem)] rounded-[28px] border border-border/80 p-0 shadow-2xl shadow-black/20"
        >
          <div className="flex max-h-[calc(100vh-6rem)] flex-col overflow-hidden">
            <SheetHeader className="sr-only">
              <SheetTitle>Register adapter</SheetTitle>
              <SheetDescription>Permissionlessly register an adapter on {getChainLabel(selectedChain)}</SheetDescription>
            </SheetHeader>
            <div className="shrink-0 p-5 pb-3 space-y-1">
              <h2 className="text-lg font-bold text-foreground">Register adapter</h2>
              <p className="text-xs text-muted-foreground">
                Permissionless on <span className="font-semibold text-foreground">{getChainLabel(selectedChain)}</span>. Starts Unverified — verification is a separate governance review.
              </p>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-3 min-h-0 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">Adapter contract address *</label>
                <input
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value.trim())}
                  placeholder="0x…"
                  spellCheck={false}
                  autoComplete="off"
                  className="w-full rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ice-400 placeholder:text-muted-foreground"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">Adapter type *</label>
                  <select
                    value={formType}
                    onChange={(e) => {
                      setFormType(e.target.value);
                      setFormCategory(ADAPTER_TYPES[Number(e.target.value)] ?? "ASSET");
                    }}
                    className="w-full rounded-2xl border border-border bg-muted/50 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ice-400"
                  >
                    {Object.entries(ADAPTER_TYPES).map(([id, name]) => (
                      <option key={id} value={id}>{name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">Version</label>
                  <input
                    value={formVersion}
                    onChange={(e) => setFormVersion(e.target.value)}
                    placeholder="1.0.0"
                    className="w-full rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ice-400 placeholder:text-muted-foreground"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">Name *</label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="My Oracle Adapter"
                  className="w-full rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ice-400 placeholder:text-muted-foreground"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">Supported assets</label>
                <input
                  value={formAssets}
                  onChange={(e) => setFormAssets(e.target.value)}
                  placeholder="e.g. USDC, WETH or ERC-721 collections"
                  className="w-full rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ice-400 placeholder:text-muted-foreground"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">Documentation URL</label>
                <input
                  value={formDocs}
                  onChange={(e) => setFormDocs(e.target.value)}
                  placeholder="https://…"
                  spellCheck={false}
                  className="w-full rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ice-400 placeholder:text-muted-foreground"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">Repository URL</label>
                <input
                  value={formRepo}
                  onChange={(e) => setFormRepo(e.target.value)}
                  placeholder="https://github.com/…"
                  spellCheck={false}
                  className="w-full rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ice-400 placeholder:text-muted-foreground"
                />
              </div>
              {session.chainId !== undefined && session.chainId !== selectedChain && (
                <p className="flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                  <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  Your wallet is on {getChainLabel(session.chainId)} — it will switch to {getChainLabel(selectedChain)} automatically (embedded) or with one click.
                </p>
              )}
            </div>
            <div className="shrink-0 p-5 pt-3 border-t border-border bg-card space-y-2">
              <Button
                onClick={handleRegister}
                disabled={submitting || isTxLoading || !isAddress(formAddress.trim()) || !formName.trim()}
                className="w-full rounded-2xl bg-ice-300 dark:bg-ice-400 text-slate-900 font-bold hover:bg-ice-400 dark:hover:bg-ice-300 disabled:opacity-50"
              >
                {submitting || isTxLoading ? "Confirm in wallet…" : `Register on ${getChainLabel(selectedChain)}`}
              </Button>
              <Button variant="outline" onClick={() => setRegisterOpen(false)} className="w-full rounded-2xl">
                Cancel
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
