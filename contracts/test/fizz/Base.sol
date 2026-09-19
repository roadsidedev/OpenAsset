// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Actor} from "./Actor.sol";
import {Clamp} from "./utils/Clamp.sol";
import {DecimalPrinter} from "./utils/DecimalPrinter.sol";
import {Deployer} from "./utils/Deployer.sol";
import {vm} from "./utils/Hevm.sol";
import {Math} from "./utils/Math.sol";
import {StringUtils} from "./utils/StringUtils.sol";
import {MockERC20} from "./utils/MockERC20.sol";
import {MockOracle} from "./utils/MockOracle.sol";

import {AdapterRegistry} from "../../src/AdapterRegistry.sol";
import {MarketFactoryV2} from "../../src/MarketFactoryV2.sol";
import {MarketDeployer} from "../../src/MarketDeployer.sol";
import {LendingMarketV2} from "../../src/LendingMarketV2.sol";
import {ERC20Adapter} from "../../src/adapters/asset/ERC20Adapter.sol";
import {StandardPositionAdapter} from "../../src/adapters/position/StandardPositionAdapter.sol";
import {DEXSwapLiquidationAdapter} from "../../src/adapters/liquidation/DEXSwapLiquidationAdapter.sol";

abstract contract Base is StringUtils, Clamp, Deployer, Math {
    using DecimalPrinter for uint256;

    string[] internal ACTOR_LABELS = ["Alice", "Bob", "Charlie"];
    uint256 internal constant BLOCK_INTERVAL = 12 seconds;
    uint256 internal constant INITIAL_ETH_BALANCE = 1_000 ether;
    uint256 internal constant INITIAL_LENDING_BALANCE = 1_000_000e6;   // 1M USDC
    uint256 internal constant INITIAL_COLLATERAL_BALANCE = 1_000e18;   // 1000 COLL

    uint256 internal constant LTV_BPS = 5000;
    uint256 internal constant APR_BPS = 500;
    uint256 internal constant DURATION = 7 days;

    // Ghosts
    uint256 public ghost_totalDeposited;
    uint256 public ghost_totalBorrowed;
    uint256 public ghost_totalRepaid;
    uint256 public ghost_loansCreated;

    address[] internal actors;
    address internal actor;
    address internal admin;

    modifier asActor() virtual {
        vm.startPrank(actor);
        _;
        vm.stopPrank();
    }

    modifier asAdmin() virtual {
        vm.startPrank(admin);
        _;
        vm.stopPrank();
    }

    MockERC20 public lendingAsset;
    MockERC20 public collateralAsset;

    ERC20Adapter public assetAdapter;
    MockOracle public oracleAdapter;
    StandardPositionAdapter public positionAdapter;
    DEXSwapLiquidationAdapter public liquidationAdapter;

    AdapterRegistry public registry;
    MarketFactoryV2 public factory;
    LendingMarketV2 public market;

    function setup() internal {
        admin = address(this);
        vm.label(admin, "Admin");

        _deployTokens();
        _deployAdaptersAndFactory();
        _createMarket();
        setupActors();
        _seedActorBalances();
    }

    function _deployTokens() internal {
        // MockERC20 mints mintAmount * 10**decimals to recipient
        lendingAsset = new MockERC20(address(this), 1_000_000_000, "USDC", "USDC", 6);
        vm.label(address(lendingAsset), "USDC");

        collateralAsset = new MockERC20(address(this), 1_000_000, "COLL", "COLL", 18);
        vm.label(address(collateralAsset), "COLL");
    }

    function _deployAdaptersAndFactory() internal {
        registry = new AdapterRegistry(admin);
        MarketDeployer deployer = new MarketDeployer();
        factory = new MarketFactoryV2(admin, admin, address(registry), deployer);
        deployer.setFactory(address(factory));
        factory.addLendingAsset(address(lendingAsset));

        assetAdapter = new ERC20Adapter(address(factory));
        oracleAdapter = new MockOracle();
        positionAdapter = new StandardPositionAdapter();
        liquidationAdapter = new DEXSwapLiquidationAdapter(address(factory));

        registry.registerAdapter(address(assetAdapter), AdapterRegistry.AdapterType.ASSET);
        registry.registerAdapter(address(oracleAdapter), AdapterRegistry.AdapterType.ORACLE);
        registry.registerAdapter(address(positionAdapter), AdapterRegistry.AdapterType.POSITION);
        registry.registerAdapter(address(liquidationAdapter), AdapterRegistry.AdapterType.LIQUIDATION);

        // Factory needs to own liquidation adapter registration path
        // registerMarket is called by factory during createMarket via low-level call
    }

    function _createMarket() internal {
        MarketFactoryV2.MarketConfig memory config = MarketFactoryV2.MarketConfig({
            lpAddress: admin,
            collateralAsset: address(collateralAsset),
            assetAdapter: address(assetAdapter),
            oracleAdapter: address(oracleAdapter),
            complianceAdapter: address(0),
            liquidationAdapter: address(liquidationAdapter),
            positionAdapter: address(positionAdapter),
            lendingAsset: address(lendingAsset),
            ltvBasisPoints: LTV_BPS,
            aprBasisPoints: APR_BPS,
            durationSeconds: DURATION,
            gracePeriodHours: 24,
            enableHealthFactor: true,
            healthFactorThreshold: 12000,
            enableCircuitBreaker: false, // disable CB for fuzz simplicity
            pauseThresholdBps: 2000,
            lookbackPeriodSeconds: 3600,
            resumeThresholdBps: 1000,
            cooldownSeconds: 7200
        });

        uint256 initialLiquidity = 100_000e6;
        lendingAsset.approve(address(factory), initialLiquidity);
        address marketAddr = factory.createMarket(config, initialLiquidity);
        market = LendingMarketV2(marketAddr);
        vm.label(marketAddr, "Market");

        ghost_totalDeposited = initialLiquidity;
    }

    function setupActors() internal {
        for (uint256 i; i < ACTOR_LABELS.length; i++) {
            address _actor = address(new Actor{value: INITIAL_ETH_BALANCE}());
            actors.push(_actor);
            vm.label(_actor, ACTOR_LABELS[i]);
        }
        actor = actors[0];
    }

    function _seedActorBalances() internal {
        for (uint256 i; i < actors.length; i++) {
            lendingAsset.deal(actors[i], INITIAL_LENDING_BALANCE);
            collateralAsset.deal(actors[i], INITIAL_COLLATERAL_BALANCE);

            vm.startPrank(actors[i]);
            lendingAsset.approve(address(market), type(uint256).max);
            lendingAsset.approve(address(factory), type(uint256).max);
            // Escrow pulls via assetAdapter: borrower must approve adapter
            collateralAsset.approve(address(assetAdapter), type(uint256).max);
            // Market holds collateral after escrow; release uses market->adapter approval (set in market ctor)
            vm.stopPrank();
        }
    }

    function toActor(address addy) internal view returns (address) {
        return actors[uint256(uint160(addy)) % actors.length];
    }

    function toActorNotCurrent(address addy) internal view returns (address) {
        address _actor = actors[uint256(uint160(addy)) % actors.length];
        if (_actor == actor) {
            _actor = actors[(uint256(uint160(addy)) + 1) % actors.length];
        }
        return _actor;
    }

    function sumActorsERC20Balances(address _token) internal view returns (uint256 sumOfBalances) {
        for (uint256 i; i < actors.length; i++) {
            (bool success, bytes memory result) =
                _token.staticcall(abi.encodeWithSignature("balanceOf(address)", actors[i]));
            require(success, "balanceOf failed");
            sumOfBalances += abi.decode(result, (uint256));
        }
    }

    function skipBlocks(uint256 blocks) internal {
        vm.roll(block.number + blocks);
        vm.warp(block.timestamp + blocks * BLOCK_INTERVAL);
    }

    function skipTime(uint256 time) internal {
        uint256 blocks = (time + BLOCK_INTERVAL - 1) / BLOCK_INTERVAL;
        vm.roll(block.number + blocks);
        vm.warp(block.timestamp + time);
    }
}
