// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

import {LoanContract} from "../src/LoanContract.sol";
import {ILendingMarket} from "../src/interfaces/ILendingMarket.sol";
import {AssetType} from "../src/interfaces/IMarketFactory.sol";

import {MockERC20} from "./fizz/utils/MockERC20.sol";

// Minimal ERC721 for testing
contract MockERC721 {
    mapping(uint256 => address) private _owners;
    mapping(uint256 => address) private _approvals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    function mint(address to, uint256 tokenId) external {
        _owners[tokenId] = to;
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        address owner = _owners[tokenId];
        require(owner != address(0), "nonexistent");
        return owner;
    }

    function approve(address to, uint256 tokenId) external {
        _approvals[tokenId] = to;
    }

    function getApproved(uint256 tokenId) external view returns (address) {
        return _approvals[tokenId];
    }

    function isApprovedForAll(address owner, address operator) external view returns (bool) {
        return _operatorApprovals[owner][operator];
    }

    function setApprovalForAll(address operator, bool approved) external {
        _operatorApprovals[msg.sender][operator] = approved;
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        require(_owners[tokenId] == from, "not owner");
        _owners[tokenId] = to;
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata) external {
        require(_owners[tokenId] == from, "not owner");
        _owners[tokenId] = to;
    }

    function transferFrom(address from, address to, uint256 tokenId) external {
        require(_owners[tokenId] == from, "not owner");
        _owners[tokenId] = to;
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x80ac58cd;
    }
}

// Minimal ERC1155 for testing
contract MockERC1155 {
    mapping(uint256 => mapping(address => uint256)) private _balances;
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    function mint(address to, uint256 id, uint256 amount) external {
        _balances[id][to] += amount;
    }

    function balanceOf(address owner, uint256 id) external view returns (uint256) {
        return _balances[id][owner];
    }

    function setApprovalForAll(address operator, bool approved) external {
        _operatorApprovals[msg.sender][operator] = approved;
    }

    function isApprovedForAll(address owner, address operator) external view returns (bool) {
        return _operatorApprovals[owner][operator];
    }

    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata) external {
        require(_balances[id][from] >= amount, "insufficient");
        _balances[id][from] -= amount;
        _balances[id][to] += amount;
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0xd9b67a26;
    }
}

// Mock lending market for LoanContract testing
contract MockLendingMarket is ILendingMarket {
    address public collateralAsset;
    address public loanAsset;
    address public protocolTreasury;
    address public oracle;
    AssetType public assetType;
    uint256 public healthFactorThreshold;
    uint256 public collateralPrice;

    constructor(
        address _collateralAsset,
        address _loanAsset,
        address _protocolTreasury,
        address _oracle,
        AssetType _assetType,
        uint256 _healthFactorThreshold,
        uint256 _collateralPrice
    ) {
        collateralAsset = _collateralAsset;
        loanAsset = _loanAsset;
        protocolTreasury = _protocolTreasury;
        oracle = _oracle;
        assetType = _assetType;
        healthFactorThreshold = _healthFactorThreshold;
        collateralPrice = _collateralPrice;
    }

    // --- ILendingMarket ---

    function depositLiquidity(uint256) external pure returns (uint256) { return 0; }
    function withdrawLiquidity(uint256) external pure returns (uint256) { return 0; }
    function requestLoan(uint256, uint256, uint256) external pure returns (address) { return address(0); }
    function getAvailableLiquidity() external pure returns (uint256) { return 0; }
    function isCircuitBreakerTriggered() external pure returns (bool) { return false; }
    function removeLoan(address, uint256) external {} // no-op
    function getLoanConfig() external view returns (address, address, address, address, AssetType, uint256) {
        return (collateralAsset, loanAsset, protocolTreasury, oracle, assetType, healthFactorThreshold);
    }
    function getCollateralPrice() external view returns (uint256) { return collateralPrice; }
}

contract LoanContractLiquidationsTest is Test {
    using Clones for address;

    // Constants matching LoanContract
    uint256 constant BPS_DENOMINATOR = 10000;
    uint256 constant ORIGINATION_FEE_BPS = 50;
    uint256 constant GRACE_PERIOD = 1 hours;

    LoanContract public implementation;

    MockERC20 public collateralToken;
    MockERC20 public loanToken;
    MockERC721 public nftToken;
    MockERC1155 public erc1155Token;

    address public treasury = makeAddr("treasury");
    address public liquidator = makeAddr("liquidator");
    address public borrower = makeAddr("borrower");

    function setUp() public {
        implementation = new LoanContract();
        collateralToken = new MockERC20(address(this), 1_000_000, "COL", "COL", 18);
        loanToken = new MockERC20(address(this), 1_000_000, "LOAN", "LOAN", 18);
        nftToken = new MockERC721();
        erc1155Token = new MockERC1155();

        // Seed tokens to test addresses
        collateralToken.deal(borrower, 100_000e18);
        loanToken.deal(liquidator, 1_000_000e6);
        // Collateral token for ERC1155
        erc1155Token.mint(borrower, 1, 1000);
    }

    // ─── helpers ───

    function _createLoan(address _collateralAsset, address _loanAsset, AssetType _atype, uint256 _price)
        internal returns (LoanContract loan)
    {
        MockLendingMarket market = new MockLendingMarket(
            _collateralAsset,
            _loanAsset,
            treasury,
            address(0xdead),
            _atype,
            11000,
            _price
        );

        address loanAddr = address(implementation).clone();
        loan = LoanContract(loanAddr);

        // For ERC20: collateralAmount = amount; tokenId = 0; erc1155Amount = 0
        // For ERC721: collateralAmount = 0; tokenId = NFT id; erc1155Amount = 0
        // For ERC1155: collateralAmount = tokenID; tokenId = 0; erc1155Amount = amount
        uint256 erc20collateral = _atype == AssetType.ERC20 ? 100e18 : 0;
        uint256 erc721tokenId  = _atype == AssetType.ERC721 ? 42 : 0;
        uint256 erc1155tokenId = _atype == AssetType.ERC1155 ? 1 : 0;
        // For ERC1155, collateralAmount stores the token ID
        uint256 erc1155collateralTokenId = _atype == AssetType.ERC1155 ? erc1155tokenId : 0;
        uint256 erc1155Amount = _atype == AssetType.ERC1155 ? 100 : 0;

        // Fund collateral to loan contract
        if (_atype == AssetType.ERC20) {
            vm.prank(borrower);
            collateralToken.transfer(address(loan), erc20collateral);
        } else if (_atype == AssetType.ERC721) {
            nftToken.mint(address(loan), erc721tokenId);
        } else {
            erc1155Token.mint(address(loan), erc1155tokenId, erc1155Amount);
            // Also approve the loan contract to spend
            vm.prank(address(loan));
            erc1155Token.setApprovalForAll(address(loan), true);
        }

        loanToken.deal(address(loan), 1_000_000e6);

        uint256 principal = 1000e6;
        uint256 interest = 50e6;

        vm.prank(address(market));
        loan.initialize(
            borrower,
            erc20collateral + erc1155collateralTokenId, // collateralAmount: ERC20 amount or ERC1155 token ID
            erc721tokenId,
            erc1155Amount,
            principal,
            interest,
            block.timestamp + 30 days
        );
    }

    function _getLoan(address _collateralAsset, address _loanAsset, AssetType _atype, uint256 _price)
        internal returns (LoanContract loan)
    {
        loan = _createLoan(_collateralAsset, _loanAsset, _atype, _price);
    }

    // ─── ERC20 underwater liquidation ───
    function test_ERC20_underwater_liquidate() public {
        // Price low enough that collateralValue < totalDebt
        LoanContract loan = _getLoan(address(collateralToken), address(loanToken), AssetType.ERC20, 5e18);
        skip(31 days); // past expiry

        vm.prank(liquidator);
        loanToken.approve(address(loan), type(uint256).max);

        // Must not revert
        vm.prank(liquidator);
        loan.liquidate();

        assertTrue(uint256(loan.status()) == 2, "should be LIQUIDATED"); // LIQUIDATED = 2
    }

    // ─── ERC20 solvent liquidation ───
    function test_ERC20_solvent_liquidate() public {
        // Price high enough that collateralValue > totalDebt
        LoanContract loan = _getLoan(address(collateralToken), address(loanToken), AssetType.ERC20, 200e18);
        skip(31 days);

        vm.prank(liquidator);
        loanToken.approve(address(loan), type(uint256).max);

        vm.prank(liquidator);
        loan.liquidate();

        assertTrue(uint256(loan.status()) == 2, "should be LIQUIDATED");
    }

    // ─── ERC721 liquidation ───
    function test_ERC721_liquidate() public {
        LoanContract loan = _getLoan(address(nftToken), address(loanToken), AssetType.ERC721, 200e18);
        skip(31 days);

        vm.prank(liquidator);
        loanToken.approve(address(loan), type(uint256).max);

        vm.prank(liquidator);
        loan.liquidate();

        assertTrue(uint256(loan.status()) == 2, "should be LIQUIDATED");
    }

    // ─── ERC1155 underwater liquidation ───
    function test_ERC1155_underwater_liquidate() public {
        LoanContract loan = _getLoan(address(erc1155Token), address(loanToken), AssetType.ERC1155, 1e18);
        skip(31 days);

        vm.prank(liquidator);
        loanToken.approve(address(loan), type(uint256).max);

        vm.prank(liquidator);
        loan.liquidate();

        assertTrue(uint256(loan.status()) == 2, "should be LIQUIDATED");
    }

    // ─── ERC1155 solvent liquidation ───
    function test_ERC1155_solvent_liquidate() public {
        LoanContract loan = _getLoan(address(erc1155Token), address(loanToken), AssetType.ERC1155, 200e18);
        skip(31 days);

        vm.prank(liquidator);
        loanToken.approve(address(loan), type(uint256).max);

        vm.prank(liquidator);
        loan.liquidate();

        assertTrue(uint256(loan.status()) == 2, "should be LIQUIDATED");
    }

    // ─── ERC20 underwater → repay still allowed ───
    function test_ERC20_underwater_cannotRepayAfterExpiryGrace() public {
        LoanContract loan = _getLoan(address(collateralToken), address(loanToken), AssetType.ERC20, 5e18);
        skip(31 days + GRACE_PERIOD + 1); // beyond grace

        uint256 totalDebt = 1000e6 + 50e6; // principal + interest
        vm.prank(borrower);
        loanToken.approve(address(loan), totalDebt);

        vm.prank(borrower);
        vm.expectRevert();
        loan.repay();
    }
}
