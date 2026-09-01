const assert = require("assert");
const fs = require("fs");
const path = require("path");

const sdk = path.resolve(__dirname, "..");
for (const relative of [
  "contracts/interfaces/IAssetAdapter.sol",
  "contracts/interfaces/IOracleAdapter.sol",
  "contracts/interfaces/IComplianceAdapter.sol",
  "contracts/interfaces/ILiquidationAdapter.sol",
  "contracts/interfaces/IPositionAdapterInit.sol",
  "contracts/base/BaseAdapter.sol",
  "contracts/errors/AdapterErrors.sol",
  "contracts/types/AdapterTypes.sol",
  "contracts/helpers/AdapterMath.sol",
  "contracts/examples/ExampleOracleAdapter.sol",
  "bin/create-openasset-adapter.js",
]) assert.ok(fs.existsSync(path.join(sdk, relative)), `missing SDK file: ${relative}`);
console.log("Adapter SDK smoke test passed: interfaces, primitives, example, and scaffold are present.");
