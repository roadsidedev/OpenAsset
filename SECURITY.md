# Security

## Liquidation model

OpenAsset Market V2 liquidations are **permissionless by design** (Aave-style):
any address may call `liquidate` / `settleLiquidation` when a loan is eligible.

This is an **accepted risk**. Grief around async CURE windows is mitigated by
cure penalties and operational monitoring — see `contracts/SECURITY_REMEDIATION.md`
(R-20). A liquidator allowlist is a possible future hardening step if abuse appears.

## Adapter trust

New markets may only select adapters that are **verified**, **not deprecated**,
and **not rejected** (`AdapterRegistry.isSelectable`).
