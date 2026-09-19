// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {MarketDeployer} from "../../src/MarketDeployer.sol";
import {LendingMarketV2} from "../../src/LendingMarketV2.sol";
import {AdapterRegistry} from "../../src/AdapterRegistry.sol";
import {IssuerRedemptionLiquidationAdapter} from "../../src/adapters/rwa/IssuerRedemptionLiquidationAdapter.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

contract MockERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true;
    }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 a = allowance[from][msg.sender];
        if (a != type(uint256).max) allowance[from][msg.sender] = a - amount;
        balanceOf[from] -= amount; balanceOf[to] += amount; return true;
    }
    function decimals() external pure returns (uint8) { return 18; }
    function totalSupply() external pure returns (uint256) { return 0; }
}

contract MockIssuerRedemption {
    uint256 public nextId = 1;
    function submitRedemption(address, address, uint256) external returns (uint256 redemptionId, uint256 expectedSettlementTime) {
        redemptionId = nextId++;
        expectedSettlementTime = block.timestamp + 1 days;
    }
    function checkSettlement(uint256) external pure returns (bool, uint256) {
        return (false, 0);
    }
}

contract StubAdapter {
    function configure(address, address) external {}
    function configure(address) external {}
}

contract SecurityRemediationTest is Test {
    address internal admin = address(0xA11CE);
    address internal attacker = address(0xBAD);
    address internal factoryAddr = address(0xFACA);

    MarketDeployer internal deployer;
    AdapterRegistry internal registry;

    function setUp() public {
        vm.prank(admin);
        deployer = new MarketDeployer();
        vm.prank(admin);
        registry = new AdapterRegistry(admin);
    }

    function _validParams() internal returns (LendingMarketV2.ConstructorParams memory p) {
        MockERC20 coll = new MockERC20();
        MockERC20 lend = new MockERC20();
        StubAdapter a = new StubAdapter();
        p = LendingMarketV2.ConstructorParams({
            factory: factoryAddr,
            marketOwner: admin,
            collateralAsset: address(coll),
            lendingAsset: address(lend),
            protocolTreasury: admin,
            assetAdapter: address(a),
            oracleAdapter: address(a),
            complianceAdapter: address(0),
            liquidationAdapter: address(a),
            positionAdapter: address(a),
            ltvBps: 5000,
            aprBps: 1000,
            durationSeconds: 30 days,
            gracePeriodHours: 24,
            enableHealthFactor: false,
            healthFactorThreshold: 0,
            cbConfig: LendingMarketV2.CircuitBreakerConfig({
                enabled: false,
                pauseThresholdBps: 0,
                lookbackPeriodSeconds: 0,
                resumeThresholdBps: 0,
                cooldownSeconds: 0
            })
        });
    }

    function test_nonFactoryDeployReverts() public {
        LendingMarketV2.ConstructorParams memory p = _validParams();

        vm.prank(admin);
        vm.expectRevert(MarketDeployer.OnlyFactory.selector);
        deployer.deploy(p);

        vm.prank(admin);
        deployer.setFactory(factoryAddr);

        vm.prank(attacker);
        vm.expectRevert(MarketDeployer.OnlyFactory.selector);
        deployer.deploy(p);

        vm.prank(factoryAddr);
        address market = deployer.deploy(p);
        assertTrue(market != address(0));
    }

    function test_directCloneInitializeReverts() public {
        LendingMarketV2.ConstructorParams memory p = _validParams();
        p.protocolTreasury = address(0); // would fail deploy validation if it got that far

        address clone = Clones.clone(deployer.template());
        vm.prank(attacker);
        vm.expectRevert(bytes("Only deployer"));
        LendingMarketV2(clone).initialize(p);
    }

    function test_rejectedAdapterNotSelectable() public {
        StubAdapter a = new StubAdapter();
        vm.prank(attacker);
        registry.registerAdapter(address(a), AdapterRegistry.AdapterType.ORACLE);

        assertFalse(registry.isSelectable(address(a)));

        vm.prank(admin);
        registry.markVerified(address(a), "audit-1");
        assertTrue(registry.isSelectable(address(a)));

        vm.prank(admin);
        registry.markRejected(address(a), "malicious");
        assertFalse(registry.isSelectable(address(a)));

        AdapterRegistry.AdapterInfo memory info = registry.getAdapterInfo(address(a));
        assertTrue(info.deprecated);
        assertFalse(info.verified);
    }

    function test_redemptionIdMarketScoped() public {
        vm.prank(admin);
        IssuerRedemptionLiquidationAdapter adapter =
            new IssuerRedemptionLiquidationAdapter(factoryAddr);

        MockIssuerRedemption issuerA = new MockIssuerRedemption();
        MockIssuerRedemption issuerB = new MockIssuerRedemption();
        address marketA = address(0xA1);
        address marketB = address(0xB2);
        address token = address(new MockERC20());

        vm.startPrank(factoryAddr);
        adapter.configure(marketA, address(0xADAD));
        adapter.configure(marketB, address(0xADAD));
        adapter.registerIssuer(marketA, address(issuerA), token, 1 days);
        adapter.registerIssuer(marketB, address(issuerB), token, 1 days);
        vm.stopPrank();

        uint256 loanId = 7;
        vm.prank(marketA);
        adapter.liquidate(loanId, 1e18);
        uint256 idA = adapter.loanRedemptionId(marketA, loanId);
        assertEq(idA, 1);

        vm.prank(marketB);
        adapter.liquidate(loanId, 2e18);
        uint256 idB = adapter.loanRedemptionId(marketB, loanId);
        assertEq(idB, 1);
        assertEq(adapter.loanRedemptionId(marketA, loanId), idA);
    }
}
