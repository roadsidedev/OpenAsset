import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-red-500 selection:text-white">
      {/* Hero Section */}
      <section className="relative flex min-h-[80vh] flex-col items-center justify-center overflow-hidden pt-20 text-center">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-900/20 via-black to-black"></div>
        
        <div className="container px-6">
          <div className="mx-auto max-w-4xl space-y-8">
            <div className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-sm text-red-400 backdrop-blur-sm">
              <span className="mr-2 flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              Live on Sepolia Testnet
            </div>
            
            <h1 className="text-5xl font-extrabold tracking-tight sm:text-7xl">
              Permissionless Lending <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">
                for Any Asset
              </span>
            </h1>
            
            <p className="mx-auto max-w-2xl text-lg text-zinc-400 sm:text-xl">
              Turn your meme coins, gaming tokens, and NFTs into yield. 
              Create isolated lending markets in minutes with complete control over risk parameters.
            </p>

            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/create-market"
                className="w-full rounded-full bg-red-600 px-8 py-4 text-lg font-semibold transition hover:bg-red-500 sm:w-auto"
              >
                Launch a Market
              </Link>
              <Link
                href="/markets"
                className="w-full rounded-full border border-zinc-700 bg-zinc-900/50 px-8 py-4 text-lg font-semibold backdrop-blur-sm transition hover:bg-zinc-800 sm:w-auto"
              >
                Borrow Funds
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-y border-white/5 bg-zinc-900/20 py-12">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 gap-8 text-center sm:grid-cols-3">
            <div>
              <div className="text-4xl font-bold text-white">$1.2M+</div>
              <div className="text-sm uppercase tracking-wider text-zinc-500">Total Value Locked</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-white">42</div>
              <div className="text-sm uppercase tracking-wider text-zinc-500">Active Markets</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-white">1,500+</div>
              <div className="text-sm uppercase tracking-wider text-zinc-500">Loans Originated</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24">
        <div className="container mx-auto px-6">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold sm:text-4xl">Why Red Chips?</h2>
            <p className="mt-4 text-zinc-400">The infrastructure for the long tail of crypto assets.</p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {/* Feature 1 */}
            <div className="group rounded-2xl border border-white/10 bg-zinc-900/50 p-8 transition hover:border-red-500/50">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-red-500/10 text-red-500 group-hover:text-red-400">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="mb-2 text-xl font-semibold">Any Asset Support</h3>
              <p className="text-zinc-400">
                Lend against ERC20 tokens, gaming assets, and soon NFTs. No governance approval needed to list new assets.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group rounded-2xl border border-white/10 bg-zinc-900/50 p-8 transition hover:border-red-500/50">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-red-500/10 text-red-500 group-hover:text-red-400">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="mb-2 text-xl font-semibold">Isolated Risk</h3>
              <p className="text-zinc-400">
                Each market is independent. Volatility in one asset doesn't threaten the safety of the entire protocol.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group rounded-2xl border border-white/10 bg-zinc-900/50 p-8 transition hover:border-red-500/50">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-red-500/10 text-red-500 group-hover:text-red-400">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="mb-2 text-xl font-semibold">Instant Liquidity</h3>
              <p className="text-zinc-400">
                Deploy a market in one transaction. Or borrow instantly against your collateral without selling your bags.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-black py-8">
        <div className="container mx-auto px-6 text-center text-zinc-500">
          <p>&copy; 2026 Red Chips. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}