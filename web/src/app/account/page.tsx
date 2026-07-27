"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useAccount } from "wagmi";
import { useMarkets } from "@/hooks/useMarkets";
import { useLoans } from "@/hooks/useLoans";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { DepositModal } from "@/components/modals/DepositModal";
import { WithdrawModal } from "@/components/modals/WithdrawModal";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Copy,
  Wallet,
  TrendingUp,
  Layers,
  Shield,
  Clock,
  Settings,
  History,
  Download,
  Activity,
  KeyRound,
  CheckCircle2,
} from "lucide-react";

function formatAmount(value: string | undefined, decimals = 18): string {
  if (!value) return "0.00";
  try {
    const bigint = BigInt(value);
    const divisor = BigInt(10 ** decimals);
    const integerPart = bigint / divisor;
    const fractionalPart = bigint % divisor;
    const fracStr = fractionalPart.toString().padStart(decimals, "0").slice(0, 4);
    const trimmedFrac = fracStr.replace(/0+$/, "");
    const fracDisplay = trimmedFrac ? `.${trimmedFrac}` : "";
    return `${integerPart.toLocaleString()}${fracDisplay}`;
  } catch {
    return value;
  }
}

type SubTab = "overview" | "config" | "activity" | "settings";

function AuthGate({ children }: { children: React.ReactNode }) {
  const { authenticated, ready } = usePrivy();
  const { login } = usePrivy();
  const isReady = ready !== false;

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="h-10 w-40 bg-muted" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Wallet className="h-12 w-12 text-muted-foreground mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">Account Dashboard</h1>
          <p className="text-muted-foreground text-sm max-w-md">
            Connect your wallet to manage your account, deposits, withdrawals, and settings.
          </p>
          <button
            type="button"
            onClick={async () => { try { await login(); } catch (e) { console.error(e); } }}
            className="rounded-2xl bg-ice-300 text-slate-900 px-6 py-2.5 text-sm font-semibold hover:bg-ice-400 transition-colors"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function AccountPage() {
  return (
    <AuthGate>
      <AccountContent />
    </AuthGate>
  );
}

function AccountContent() {
  const [subTab, setSubTab] = useState<SubTab>("overview");
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [exportPassword, setExportPassword] = useState("");
  const [exportStatus, setExportStatus] = useState<"idle" | "exporting" | "done" | "error">("idle");
  const { user, exportWallet, logout: privyLogout } = usePrivy();
  const { address } = useAccount();

  // Detect embedded wallet (Privy-managed) vs external wallet (MetaMask, etc.)
  const isEmbeddedWallet = user?.wallet?.walletClientType === "privy" || user?.wallet?.connectorType === "embedded";

  const handleLogout = () => {
    privyLogout();
  };

  const handleExportWallet = async () => {
    if (!exportPassword || !exportWallet) return;
    setExportStatus("exporting");
    try {
      await exportWallet(exportPassword);
      setExportStatus("done");
      setExportPassword("");
    } catch (err) {
      console.error("Wallet export failed:", err);
      setExportStatus("error");
    }
  };

  const { data: loansData, isLoading: loansLoading } = useLoans(
    { borrower: address, status: "ACTIVE" },
    { enabled: !!address }
  );
  const { data: marketsData, isLoading: marketsLoading } = useMarkets(0, 100);

  const activeLoans: any[] = loansData?.loans || [];
  const allMarkets: any[] = marketsData?.markets || [];
  const myMarkets = address
    ? allMarkets.filter((m: any) => m.owner.toLowerCase() === address.toLowerCase())
    : [];

  const totalBorrowed = activeLoans.reduce((s: bigint, l: any) => s + BigInt(l.principal || 0), BigInt(0));
  const totalLiquidity = myMarkets.reduce((s: bigint, m: any) => s + BigInt(m.liquidity?.available || 0), BigInt(0));

  const SUB_TABS: { id: SubTab; label: string; icon: any }[] = [
    { id: "overview", label: "Overview", icon: Activity },
    { id: "config", label: "Config & Rules", icon: Settings },
    { id: "activity", label: "Activity", icon: History },
    { id: "settings", label: "Settings & Export", icon: Download },
  ];

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-8 space-y-8">
        {/* Account Header */}
        <div className="p-6 md:p-8 rounded-3xl border border-border bg-card flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-soft">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-ice-100 dark:bg-ice-900/40 text-ice-600 dark:text-ice-300 flex items-center justify-center font-extrabold text-xl">
              oA
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-foreground">
                  {user?.email?.address || "Account"}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[10px] font-bold">
                  Connected
                </span>
              </div>
              <div className="text-xs font-mono text-muted-foreground mt-1 flex items-center gap-2">
                <span>{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(address || "")}
                  title="Copy Address"
                  className="hover:text-foreground transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDepositOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-white transition-colors"
            >
              <ArrowDownLeft className="h-4 w-4" /> Deposit Funds
            </button>
            <button
              onClick={() => setWithdrawOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border border-border text-xs font-semibold hover:bg-accent transition-colors"
            >
              <ArrowUpRight className="h-4 w-4" /> Withdraw
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="p-5 rounded-2xl border border-border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-ice-500" />
              <span className="text-xs text-muted-foreground">Total Asset Value</span>
            </div>
            <span className="text-xl font-bold text-foreground">
              {loansLoading || marketsLoading ? (
                <Skeleton className="h-7 w-28 bg-muted inline-block" />
              ) : `$${formatAmount(totalBorrowed.toString())}`}
            </span>
          </div>
          <div className="p-5 rounded-2xl border border-border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-ice-500" />
              <span className="text-xs text-muted-foreground">Active Deposits</span>
            </div>
            <span className="text-xl font-bold text-foreground">
              {marketsLoading ? (
                <Skeleton className="h-7 w-24 bg-muted inline-block" />
              ) : `${formatAmount(totalLiquidity.toString())} USDC`}
            </span>
          </div>
          <div className="p-5 rounded-2xl border border-border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="h-4 w-4 text-ice-500" />
              <span className="text-xs text-muted-foreground">Net Yield APY</span>
            </div>
            <span className="text-xl font-bold text-ice-600 dark:text-ice-300">
              {myMarkets.length > 0
                ? `+${(myMarkets.reduce((s: number, m: any) => s + (m.aprBps || 0), 0) / myMarkets.length / 100).toFixed(2)}%`
                : "0%"}
            </span>
          </div>
          <div className="p-5 rounded-2xl border border-border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-ice-500" />
              <span className="text-xs text-muted-foreground">Account Risk</span>
            </div>
            <span className="text-xl font-bold text-emerald-500">
              {loansLoading ? <Skeleton className="h-7 w-16 bg-muted inline-block" /> : "Healthy"}
            </span>
          </div>
        </div>

        {/* Sub-tab Navigation */}
        <div className="flex items-center gap-2 border-b border-border pb-3 overflow-x-auto text-xs font-semibold scrollbar-hide">
          {SUB_TABS.map((st) => {
            const Icon = st.icon;
            return (
              <button
                key={st.id}
                onClick={() => setSubTab(st.id)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 rounded-xl transition-all whitespace-nowrap",
                  subTab === st.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {st.label}
              </button>
            );
          })}
        </div>

        {/* Sub-tab: Overview */}
        {subTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 p-6 rounded-3xl border border-border bg-card space-y-4">
              <h3 className="text-sm font-bold">Portfolio Performance</h3>
              <div className="h-60 relative">
                <svg viewBox="0 0 600 200" className="w-full h-full" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="perfGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#A8D8FF" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#A8D8FF" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <line key={i} x1="0" y1={i * 50} x2="600" y2={i * 50} className="stroke-border" strokeWidth="0.5" />
                  ))}
                  <path d="M0,160 C60,140 120,150 180,120 C240,90 300,100 360,80 C420,60 480,70 540,50 C570,40 590,45 600,40 L600,200 L0,200 Z" fill="url(#perfGradient)" />
                  <path d="M0,160 C60,140 120,150 180,120 C240,90 300,100 360,80 C420,60 480,70 540,50 C570,40 590,45 600,40" fill="none" stroke="#A8D8FF" strokeWidth="2" />
                  <circle cx="600" cy="40" r="4" fill="#A8D8FF" />
                </svg>
              </div>
            </div>
            <div className="lg:col-span-4 p-6 rounded-3xl border border-border bg-card space-y-4">
              <h3 className="text-sm font-bold">Capital Allocation</h3>
              <div className="space-y-3 text-xs">
                {myMarkets.length === 0 ? (
                  <p className="text-muted-foreground py-4 text-center">No markets created yet</p>
                ) : (
                  myMarkets.slice(0, 5).map((m: any) => (
                    <div key={m.marketAddress} className="flex items-center justify-between p-3 rounded-2xl bg-muted/50">
                      <span className="font-bold truncate">Market {m.marketAddress.slice(0, 8)}...</span>
                      <span className="font-mono">{formatAmount(m.liquidity?.available)} USDC</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Sub-tab: Config */}
        {subTab === "config" && (
          <div className="p-6 rounded-3xl border border-border bg-card space-y-6 max-w-2xl">
            <h3 className="text-sm font-bold">Risk Management & Configuration</h3>
            <div className="space-y-3 text-xs">
              {(
                [
                  ["Auto-Apply LP Earnings", "Automatically direct pool yields towards active loan debt", true],
                  ["Circuit Breaker Alerts", "Instant notifications when pricing feeds halt or reset", true],
                  ["Liquidation Alerts", "Get notified when loans approach liquidation thresholds", true],
                ] as [string, string, boolean][]
              ).map(([label, desc, checked]) => (
                <div key={label} className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/50">
                  <div>
                    <div className="font-bold text-foreground">{label}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{desc}</div>
                  </div>
                  <input type="checkbox" defaultChecked={checked as boolean} className="w-4 h-4 accent-ice-500 rounded" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sub-tab: Activity */}
        {subTab === "activity" && (
          <div className="p-6 rounded-3xl border border-border bg-card space-y-4">
            <h3 className="text-sm font-bold">On-Chain Activity Log</h3>
            <div className="text-center py-12 text-muted-foreground text-xs">
              <History className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p>Transaction history will appear here once you have activity.</p>
            </div>
          </div>
        )}

        {/* Sub-tab: Settings */}
        {subTab === "settings" && (
          <div className="space-y-6 max-w-2xl">
            <div className="p-6 rounded-3xl border border-border bg-card space-y-6">
              <h3 className="text-sm font-bold">Wallet & Security</h3>
              <p className="text-xs text-muted-foreground">Manage your wallet connection and export settings.</p>
              <div className="space-y-3">
                <button
                  onClick={() => navigator.clipboard.writeText(address || "")}
                  className="w-full flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-border text-xs font-semibold hover:bg-accent transition-colors text-left"
                >
                  <Copy className="h-4 w-4" />
                  Copy Wallet Address
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-destructive/30 bg-destructive/5 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors text-left"
                >
                  <Wallet className="h-4 w-4" />
                  Disconnect Wallet
                </button>
              </div>
            </div>

            {/* Wallet Export — embedded wallets only */}
            {isEmbeddedWallet && (
              <div className="p-6 rounded-3xl border border-border bg-card space-y-4">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-ice-500" />
                  <h3 className="text-sm font-bold">Export Wallet</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Export your embedded wallet private key. This is only available for Privy-managed wallets.
                </p>
                {exportStatus === "done" ? (
                  <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                    <CheckCircle2 className="h-4 w-4" />
                    Wallet exported successfully
                  </div>
                ) : (
                  <div className="space-y-3">
                    <input
                      type="password"
                      value={exportPassword}
                      onChange={(e) => {
                        setExportPassword(e.target.value);
                        if (exportStatus === "error") setExportStatus("idle");
                      }}
                      placeholder="Set export password"
                      className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ice-400 placeholder:text-muted-foreground"
                    />
                    {exportStatus === "error" && (
                      <p className="text-xs text-destructive">Export failed. Please try again.</p>
                    )}
                    <button
                      onClick={handleExportWallet}
                      disabled={!exportPassword || exportStatus === "exporting"}
                      className={cn(
                        "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-semibold transition-colors",
                        exportPassword && exportStatus !== "exporting"
                          ? "bg-ice-300 text-slate-900 hover:bg-ice-400"
                          : "bg-muted text-muted-foreground cursor-not-allowed"
                      )}
                    >
                      {exportStatus === "exporting" ? (
                        <>
                          <Skeleton className="h-3.5 w-3.5 rounded-full bg-slate-400" />
                          Exporting...
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4" />
                          Export Private Key
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <DepositModal open={depositOpen} onOpenChange={setDepositOpen} />
      <WithdrawModal open={withdrawOpen} onOpenChange={setWithdrawOpen} />
    </div>
  );
}
