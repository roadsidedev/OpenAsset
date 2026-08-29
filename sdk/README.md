# @openasset/adapter-sdk (stub — publishable)

This folder is the publishable SDK for external adapter developers. Until published to npm, copy this folder or use `docs/ADAPTER_DEVELOPER.md` as source of truth.

## Install

```bash
npm i @openasset/adapter-sdk
# or local
npm i file:../sdk
```

## Contents

- `interfaces/` — re-exported `IAssetAdapter`, `IOracleAdapter`, `IComplianceAdapter`, `ILiquidationAdapter`, `IPositionAdapterInit` ABIs + TypeScript types
- `templates/` — `erc20-asset`, `twap-oracle`, `b20-compliance`, `dex-liquidation` starter contracts (see `contracts/src/adapters/` as live templates)
- `test-utils/` — mock factories (`MockERC20`, `MockChainlinkFeed`, etc) + `expectRevert` helpers
- `cli/` — `npx create-openasset-adapter --type oracle --name MyPythAdapter` (planned)

## Quick Start

```bash
npx create-openasset-adapter --type oracle --name PythAdapter
cd pyth-adapter
npm test
# deploy
npx hardhat run scripts/deploy.ts --network baseSepolia
# register
cast send $REGISTRY "registerAdapter(address,uint8)" $ADAPTER 1 --rpc-url $RPC
```

## Types

```ts
import type { IAssetAdapter, IOracleAdapter } from "@openasset/adapter-sdk";
```

See `docs/ADAPTER_DEVELOPER.md` for the 5 interfaces + multi-tenancy pattern + clone template.
