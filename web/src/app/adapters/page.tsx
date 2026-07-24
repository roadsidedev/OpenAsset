'use client';

import { useState } from 'react';
import { AdapterBadge } from '@/components/adapters/AdapterBadge';
import { ADAPTER_TYPES } from '@/lib/contractAbis';

interface AdapterInfo {
  adapterAddress: string;
  adapterType: number;
  verified: boolean;
  deprecated: boolean;
  auditReference: string;
  registeredAt: number;
}

// Mock data — in production, fetch from /api/v1/adapters
const MOCK_ADAPTERS: AdapterInfo[] = [
  { adapterAddress: '0x0000000000000000000000000000000000000001', adapterType: 0, verified: true, deprecated: false, auditReference: 'Internal #1', registeredAt: 1700000000 },
  { adapterAddress: '0x0000000000000000000000000000000000000002', adapterType: 1, verified: true, deprecated: false, auditReference: 'Internal #1', registeredAt: 1700000000 },
  { adapterAddress: '0x0000000000000000000000000000000000000003', adapterType: 1, verified: true, deprecated: false, auditReference: '', registeredAt: 1700001000 },
  { adapterAddress: '0x0000000000000000000000000000000000000005', adapterType: 3, verified: true, deprecated: false, auditReference: 'Internal #1', registeredAt: 1700002000 },
  { adapterAddress: '0x0000000000000000000000000000000000000006', adapterType: 3, verified: true, deprecated: false, auditReference: '', registeredAt: 1700003000 },
  { adapterAddress: '0x0000000000000000000000000000000000000007', adapterType: 4, verified: true, deprecated: false, auditReference: 'Internal #1', registeredAt: 1700004000 },
  { adapterAddress: '0x0000000000000000000000000000000000000008', adapterType: 4, verified: true, deprecated: false, auditReference: 'Internal #1', registeredAt: 1700005000 },
  { adapterAddress: '0x0000000000000000000000000000000000000009', adapterType: 4, verified: true, deprecated: false, auditReference: 'Internal #1', registeredAt: 1700006000 },
  { adapterAddress: '0x000000000000000000000000000000000000DEAD', adapterType: 3, verified: false, deprecated: true, auditReference: '', registeredAt: 1690000000 },
];

const TYPE_FILTERS = ['All', 'ASSET', 'ORACLE', 'COMPLIANCE', 'LIQUIDATION', 'POSITION'] as const;

export default function AdaptersPage() {
  const [filter, setFilter] = useState<string>('All');

  const filtered = filter === 'All'
    ? MOCK_ADAPTERS
    : MOCK_ADAPTERS.filter((a) => ADAPTER_TYPES[a.adapterType] === filter);

  return (
    <div className="min-h-screen bg-black px-4 py-12">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-2 text-2xl font-bold text-white">Adapter Registry</h1>
        <p className="mb-8 text-sm text-zinc-400">
          Browse all registered adapters. Verified adapters have been audited and reviewed.
        </p>

        {/* Filter tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === t
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Adapter cards */}
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((adapter) => (
            <div
              key={adapter.adapterAddress}
              className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-medium text-zinc-500">
                    {ADAPTER_TYPES[adapter.adapterType]}
                  </span>
                  <p className="mt-1 font-mono text-sm text-white">
                    {adapter.adapterAddress.slice(0, 10)}...{adapter.adapterAddress.slice(-6)}
                  </p>
                </div>
                <AdapterBadge verified={adapter.verified} deprecated={adapter.deprecated} />
              </div>
              {adapter.auditReference && (
                <p className="mt-2 text-xs text-zinc-500">
                  Audit: {adapter.auditReference}
                </p>
              )}
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="mt-12 text-center text-sm text-zinc-500">No adapters found for this filter.</p>
        )}
      </div>
    </div>
  );
}
