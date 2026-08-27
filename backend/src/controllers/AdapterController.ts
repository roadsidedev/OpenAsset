/**
 * @file AdapterController.ts
 * @description Controller for adapter registry API endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { PrismaClient, AdapterType } from '@prisma/client';
import { logger } from '../utils/logger';
import { config } from '../config/unifiedConfig';
import { getProviderAssets } from '../config/providerCatalog';

const prisma = new PrismaClient();

// Default chain ID for adapter queries
const DEFAULT_CHAIN_ID = 11155111;

export class AdapterController {
  /**
   * GET /adapters
   * List all registered adapters, optionally filtered by type
   */
  async getAdapters(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { type, verified, deprecated, chainId } = req.query;
      const chain = parseInt(String(chainId || DEFAULT_CHAIN_ID), 10);

      const where: any = { chainId: chain };
      if (type && typeof type === 'string') where.adapterType = type;
      if (verified !== undefined) where.verified = verified === 'true';
      if (deprecated !== undefined) where.deprecated = deprecated === 'true';

      const adapters = await prisma.adapter.findMany({
        where,
        orderBy: { registeredAt: 'desc' },
      });

      res.json({ success: true, data: adapters });
    } catch (error) {
      logger.error({ err: error }, 'Error fetching adapters');
      next(error);
    }
  }

  /**
   * GET /adapters/:address
   * Get adapter detail by address
   */
  async getAdapter(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const address = req.params.address as string;
      const chainId = parseInt(String(req.query.chainId || DEFAULT_CHAIN_ID), 10);

      const adapter = await prisma.adapter.findUnique({
        where: { adapterAddress_chainId: { adapterAddress: address, chainId } },
      });

      if (!adapter) {
        res.status(404).json({ success: false, error: 'Adapter not found' });
        return;
      }

      res.json({ success: true, data: adapter });
    } catch (error) {
      logger.error({ err: error }, 'Error fetching adapter');
      next(error);
    }
  }

  /**
   * GET /adapters/verified
   * List all verified adapters
   */
  async getVerifiedAdapters(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const chainId = parseInt(String(req.query.chainId || DEFAULT_CHAIN_ID), 10);
      
      const adapters = await prisma.adapter.findMany({
        where: { chainId, verified: true, deprecated: false },
        orderBy: { totalValueSecured: 'desc' },
      });

      res.json({ success: true, data: adapters });
    } catch (error) {
      logger.error({ err: error }, 'Error fetching verified adapters');
      next(error);
    }
  }

  /**
   * GET /adapters/stats
   * Get adapter registry statistics
   */
  async getAdapterStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const chainId = parseInt(String(req.query.chainId || DEFAULT_CHAIN_ID), 10);
      
      const total = await prisma.adapter.count({ where: { chainId } });
      const verified = await prisma.adapter.count({ where: { chainId, verified: true } });
      const deprecated = await prisma.adapter.count({ where: { chainId, deprecated: true } });

      const byType = await prisma.adapter.groupBy({
        by: ['adapterType'],
        where: { chainId },
        _count: true,
      });

      res.json({
        success: true,
        data: {
          total,
          verified,
          deprecated,
          unverified: total - verified - deprecated,
          byType: byType.map((g) => ({ type: g.adapterType, count: g._count })),
        },
      });
    } catch (error) {
      logger.error({ err: error }, 'Error fetching adapter stats');
      next(error);
    }
  }

  /**
   * GET /adapters/:address/assets?chainId=&q=&limit=
   * Adapter-aware supported assets: distinct collateralAsset where assetAdapter == address
   * For B20AssetAdapter, unions curated B20Token table (hybrid KNOWN + B20Created) as fallback
   */
  async getAdapterAssets(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adapterAddress = req.params.address as string;
      const chainId = parseInt(String(req.query.chainId || DEFAULT_CHAIN_ID), 10);
      const q = String(req.query.q || "").toLowerCase();
      const limit = Math.min(parseInt(String(req.query.limit || "50"), 10), 100);
      const provider = String(req.query.provider || '').toLowerCase();

      // 1) Markets that use this asset adapter on this chain
      const markets = await prisma.market.findMany({
        where: { chainId, assetAdapter: adapterAddress },
        select: { collateralAsset: true, lendingAsset: true, totalLiquidity: true },
      });
      const byAsset = new Map<string, { marketCount: number; totalLiquidity: bigint }>();
      for (const m of markets) {
        const key = m.collateralAsset.toLowerCase();
        const prev = byAsset.get(key) || { marketCount: 0, totalLiquidity: 0n };
        prev.marketCount += 1;
        try { prev.totalLiquidity += BigInt(m.totalLiquidity || "0"); } catch {}
        byAsset.set(key, prev);
      }

      // 2) Curated B20 fallback for B20AssetAdapter (hybrid A)
      const configuredB20Adapter = config.contracts.b20AssetAdapter.get(chainId) || "";
      const isB20Adapter = configuredB20Adapter !== "" && adapterAddress.toLowerCase() === configuredB20Adapter.toLowerCase();
      let curated: Array<{ address: string; symbol: string; name: string; feed?: string; decimals: number }> = [];
      if (isB20Adapter) {
        try {
          const rows = await (prisma as any).b20Token.findMany({ where: { chainId } });
          if (rows.length > 0) {
            curated = rows.map((r: any) => ({ address: r.address, symbol: r.symbol, name: r.name, feed: r.feed || undefined, decimals: r.decimals || 8 }));
          }
        } catch {}
        if (curated.length === 0) {
          // Fallback to known 13 (mirrors web/src/lib/b20.ts + EventIndexerServiceV2 KNOWN_B20_TOKENS_BASE)
          const known: Record<string, { symbol: string; name: string; feed: string }> = {
            "0xb200000000000000000000c2e324d24d7eecd1fb": { symbol: "AAPLc", name: "Coinbase AAPL", feed: "0x787f13dEa48Db0897CbCDD985de77809D837F988" },
            "0xb200000000000000000000d9192b6b456483c2e8": { symbol: "AMZNc", name: "Coinbase AMZN", feed: "0x06A8E4b3aBB3B7543d8396FB2B763d22820cB295" },
            "0xb200000000000000000000c85a31389d71f3ecfb": { symbol: "COINc", name: "Coinbase COIN", feed: "0x408e44f504A7371a345F03a73dDC96A4b48e8aa7" },
            "0xb20000000000000000000019f6e7c675b73c2e4d": { symbol: "CRCLc", name: "Coinbase CRCL", feed: "0x0231cF2635D1E17bB5c2462cc7504Ba1fBd61f33" },
            "0xb2000000000000000000002d0ba3164cc74f58b7": { symbol: "GOOGLc", name: "Coinbase GOOGL", feed: "0x5bF49E0ffA937CE2FfF033c739aD7C634c4D34F2" },
            "0xb2000000000000000000004aff16039ba04bdfbc": { symbol: "INTCc", name: "Coinbase INTC", feed: "0xAB657C39bac0D5886250D70849e2E3E008F2EECB" },
            "0xb2000000000000000000008bc8786b856e61707c": { symbol: "METAc", name: "Coinbase META", feed: "0x6526aE6797A76123638b863AeE4dD27Ba4E4b27D" },
            "0xb200000000000000000000ab99cfa739e253872b": { symbol: "MSFTc", name: "Coinbase MSFT", feed: "0xeB10A6c9aa7E537aEd766C08c35Dae35B321b18c" },
            "0xb2000000000000000000004884b426556b92883d": { symbol: "MSTRc", name: "Coinbase MSTR", feed: "0xB3cE282CD188b35DA0E38D8Bc7d58e33173D202a" },
            "0xb20000000000000000000078ee7ce2fe4908108c": { symbol: "NVDAc", name: "Coinbase NVDA", feed: "0x04689a41629776563E6822F76f2e57D148d28513" },
            "0xb200000000000000000000397293cb8cda9a10c5": { symbol: "SNDKc", name: "Coinbase SNDK", feed: "0x388b0dC46C0Fb05A74BeE0994fa5b02c6Fcca2eA" },
            "0xb2000000000000000000007b9fcbd005511acbd5": { symbol: "SPCXc", name: "Coinbase SPCX", feed: "0x6A634B235903C4ad6376892180d6fF8612e3Fa68" },
            "0xb2000000000000000000001e800a7f5189430cd0": { symbol: "TSLAc", name: "Coinbase TSLA", feed: "0xFaf869185383a24F8cb00e27BdA6b63B9905DCb4" },
          };
          curated = Object.entries(known).map(([address, v]) => ({ address, symbol: v.symbol, name: v.name, feed: v.feed, decimals: 8 }));
        }
      }

      if (provider === 'robinhood') {
        curated = getProviderAssets(chainId, 'robinhood').map((asset) => ({
          address: asset.address,
          symbol: asset.symbol,
          name: asset.name,
          feed: asset.feed,
          decimals: asset.decimals,
        }));
      }

      // 3) Build union: curated + markets distinct
      const seen = new Set<string>();
      const assets: Array<{ address: string; symbol: string; name: string; feed?: string; decimals: number; marketCount: number; totalLiquidity: string; isB20: boolean; provider?: string; requiresAllowlist?: boolean }> = [];
      const add = (addr: string, symbol: string, name: string, feed?: string, decimals = 18) => {
        const key = addr.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        const m = byAsset.get(key);
        assets.push({
          address: addr,
          symbol,
          name,
          feed,
          decimals,
          marketCount: m?.marketCount || 0,
          totalLiquidity: (m?.totalLiquidity || 0n).toString(),
          isB20: curated.some(c => c.address.toLowerCase() === key) && provider !== 'robinhood',
          ...(provider === 'robinhood' ? { provider: 'robinhood', requiresAllowlist: true } : {}),
        });
      };
      for (const c of curated) add(c.address, c.symbol, c.name, c.feed, c.decimals);
      for (const [addr, m] of byAsset) {
        if (!seen.has(addr)) {
          // For non-curated (e.g., USDC, WETH), symbol/name will be enriched by frontend useTokenMetadata/CoinGecko (D)
          add(addr, addr.slice(0, 6) + "…", "Unknown", undefined, 18);
        }
      }
      // 4) Filter by q (symbol/name/address)
      let filtered = assets;
      if (q) {
        filtered = assets.filter(a => a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q) || a.address.toLowerCase().includes(q));
      }
      filtered = filtered.slice(0, limit);

      res.json({ success: true, data: filtered, chainId, adapterAddress });
    } catch (error) {
      logger.error({ err: error }, "Error fetching adapter assets");
      next(error);
    }
  }

  /**
   * GET /tokens?chainId=&type=b20|robinhood&q=&limit=
   * Provider-qualified token list for picker without adapter context
   */
  async getTokens(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const chainId = parseInt(String(req.query.chainId || DEFAULT_CHAIN_ID), 10);
      const type = String(req.query.type || "b20").toLowerCase();
      const q = String(req.query.q || "").toLowerCase();
      const limit = Math.min(parseInt(String(req.query.limit || "50"), 10), 100);
      if (type === 'robinhood') {
        const rows = getProviderAssets(chainId, 'robinhood').map((asset) => ({
          address: asset.address,
          symbol: asset.symbol,
          name: asset.name,
          feed: asset.feed,
          decimals: asset.decimals,
          provider: asset.provider,
          requiresAllowlist: asset.requiresAllowlist,
        }));
        const filtered = q ? rows.filter((row) => row.symbol.toLowerCase().includes(q) || row.name.toLowerCase().includes(q) || row.address.toLowerCase().includes(q)) : rows;
        res.json({ success: true, data: filtered.slice(0, limit), chainId, type });
        return;
      }
      if (type !== "b20") {
        res.json({ success: true, data: [], chainId });
        return;
      }
      let rows: Array<{ address: string; symbol: string; name: string; feed?: string; decimals: number }> = [];
      try {
        const db = await (prisma as any).b20Token.findMany({ where: { chainId } });
        if (db.length) rows = db.map((r: any) => ({ address: r.address, symbol: r.symbol, name: r.name, feed: r.feed, decimals: r.decimals }));
      } catch {}
      if (rows.length === 0) {
        // fallback same as above
        const known: Record<string, { symbol: string; name: string; feed: string }> = {
          "0xb200000000000000000000c2e324d24d7eecd1fb": { symbol: "AAPLc", name: "Coinbase AAPL", feed: "0x787f13dEa48Db0897CbCDD985de77809D837F988" },
          "0xb200000000000000000000d9192b6b456483c2e8": { symbol: "AMZNc", name: "Coinbase AMZN", feed: "0x06A8E4b3aBB3B7543d8396FB2B763d22820cB295" },
          "0xb200000000000000000000c85a31389d71f3ecfb": { symbol: "COINc", name: "Coinbase COIN", feed: "0x408e44f504A7371a345F03a73dDC96A4b48e8aa7" },
          "0xb20000000000000000000019f6e7c675b73c2e4d": { symbol: "CRCLc", name: "Coinbase CRCL", feed: "0x0231cF2635D1E17bB5c2462cc7504Ba1fBd61f33" },
          "0xb2000000000000000000002d0ba3164cc74f58b7": { symbol: "GOOGLc", name: "Coinbase GOOGL", feed: "0x5bF49E0ffA937CE2FfF033c739aD7C634c4D34F2" },
          "0xb2000000000000000000004aff16039ba04bdfbc": { symbol: "INTCc", name: "Coinbase INTC", feed: "0xAB657C39bac0D5886250D70849e2E3E008F2EECB" },
          "0xb2000000000000000000008bc8786b856e61707c": { symbol: "METAc", name: "Coinbase META", feed: "0x6526aE6797A76123638b863AeE4dD27Ba4E4b27D" },
          "0xb200000000000000000000ab99cfa739e253872b": { symbol: "MSFTc", name: "Coinbase MSFT", feed: "0xeB10A6c9aa7E537aEd766C08c35Dae35B321b18c" },
          "0xb2000000000000000000004884b426556b92883d": { symbol: "MSTRc", name: "Coinbase MSTR", feed: "0xB3cE282CD188b35DA0E38D8Bc7d58e33173D202a" },
          "0xb20000000000000000000078ee7ce2fe4908108c": { symbol: "NVDAc", name: "Coinbase NVDA", feed: "0x04689a41629776563E6822F76f2e57D148d28513" },
          "0xb200000000000000000000397293cb8cda9a10c5": { symbol: "SNDKc", name: "Coinbase SNDK", feed: "0x388b0dC46C0Fb05A74BeE0994fa5b02c6Fcca2eA" },
          "0xb2000000000000000000007b9fcbd005511acbd5": { symbol: "SPCXc", name: "Coinbase SPCX", feed: "0x6A634B235903C4ad6376892180d6fF8612e3Fa68" },
          "0xb2000000000000000000001e800a7f5189430cd0": { symbol: "TSLAc", name: "Coinbase TSLA", feed: "0xFaf869185383a24F8cb00e27BdA6b63B9905DCb4" },
        };
        rows = Object.entries(known).map(([address, v]) => ({ address, symbol: v.symbol, name: v.name, feed: v.feed, decimals: 8 }));
      }
      if (q) rows = rows.filter(r => r.symbol.toLowerCase().includes(q) || r.name.toLowerCase().includes(q) || r.address.toLowerCase().includes(q));
      rows = rows.slice(0, limit);
      res.json({ success: true, data: rows, chainId });
    } catch (error) {
      logger.error({ err: error }, "Error fetching tokens");
      next(error);
    }
  }

  /**
   * POST /adapters/upsert
   * Upsert adapter from indexer event (internal use)
   */
  async upsertAdapter(data: {
    adapterAddress: string;
    adapterType: AdapterType;
    registeredBy: string;
    chainId?: number;
    verified?: boolean;
    deprecated?: boolean;
    auditReference?: string;
  }): Promise<void> {
    try {
      const chainId = data.chainId || DEFAULT_CHAIN_ID;
      
      await prisma.adapter.upsert({
        where: { adapterAddress_chainId: { adapterAddress: data.adapterAddress, chainId } },
        update: {
          verified: data.verified ?? false,
          deprecated: data.deprecated ?? false,
          auditReference: data.auditReference,
        },
        create: {
          adapterAddress: data.adapterAddress,
          chainId,
          adapterType: data.adapterType,
          registeredBy: data.registeredBy,
          verified: data.verified ?? false,
          deprecated: data.deprecated ?? false,
          auditReference: data.auditReference,
        },
      });
    } catch (error) {
      logger.error({ err: error, address: data.adapterAddress }, 'Error upserting adapter');
    }
  }
}