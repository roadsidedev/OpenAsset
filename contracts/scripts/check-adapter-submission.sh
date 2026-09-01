#!/usr/bin/env bash
set -euo pipefail

TYPE="${1:-}"
SOURCE="${2:-}"
if [[ -z "$TYPE" || -z "$SOURCE" ]]; then
  echo "Usage: $0 <asset|oracle|compliance|liquidation|position> <path-to-solidity-source>" >&2
  exit 2
fi
case "$TYPE" in
  asset) INTERFACE="IAssetAdapter" ;;
  oracle) INTERFACE="IOracleAdapter" ;;
  compliance) INTERFACE="IComplianceAdapter" ;;
  liquidation) INTERFACE="ILiquidationAdapter" ;;
  position) INTERFACE="IPositionAdapter" ;;
  *) echo "Unknown adapter type: $TYPE" >&2; exit 2 ;;
esac

[[ -f "$SOURCE" ]] || { echo "Source file not found: $SOURCE" >&2; exit 1; }
grep -q "${INTERFACE}" "$SOURCE" || { echo "Missing interface marker: ${INTERFACE}" >&2; exit 1; }
grep -q "pragma solidity \^0.8.20" "$SOURCE" || { echo "Expected Solidity ^0.8.20" >&2; exit 1; }
if grep -q "tx.origin" "$SOURCE"; then echo "tx.origin is prohibited" >&2; exit 1; fi

npm run compile >/dev/null
npx hardhat test test/adapter-environment/AdapterEnvironment.test.ts >/dev/null
echo "Automated checks passed for ${TYPE}: ${SOURCE}"
