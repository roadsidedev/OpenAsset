// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../interfaces/adapters/IPositionAdapter.sol";
import "../../interfaces/adapters/IComplianceAdapter.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/**
 * @title TransferablePositionAdapter
 * @notice Reference position adapter — transferable ERC721 with compliance hook
 * @dev Implements IPositionAdapter as a standard transferable ERC721.
 *      When a ComplianceAdapter is attached, every transfer calls
 *      complianceAdapter.isEligible(recipient) — if it returns false,
 *      the transfer reverts.
 *
 * Use case: crypto-native collateral markets (gaming tokens, memes, generic
 * NFT collateral) where there's no eligibility rule to bypass and the
 * secondary-market/composability upside is highest (selling a position,
 * using it as collateral elsewhere, atomic refinancing).
 */
contract TransferablePositionAdapter is ERC721, IPositionAdapter {
    address public immutable factory;
    mapping(address => bool) public authorizedMarkets;

    IComplianceAdapter public immutable complianceAdapter;

    modifier onlyMarket() {
        require(authorizedMarkets[msg.sender], "Unauthorized");
        _;
    }

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    constructor(address _factory, address _complianceAdapter) ERC721("OpenAsset Market Transferable Position", "rcTP") {
        require(_factory != address(0), "Invalid factory");
        factory = _factory;
        complianceAdapter = IComplianceAdapter(_complianceAdapter);
    }

    /// @notice Register a market to use this adapter (callable only by factory)
    function registerMarket(address market) external onlyFactory {
        require(market != address(0), "Invalid market");
        authorizedMarkets[market] = true;
    }

    function mint(address to, uint256 loanId) external override onlyMarket {
        _safeMint(to, loanId);
    }

    function ownerOf(uint256 loanId) public view override(ERC721, IPositionAdapter) returns (address) {
        if (!_exists(loanId)) return address(0);
        return ERC721.ownerOf(loanId);
    }

    function burn(uint256 loanId) external override onlyMarket {
        _burn(loanId);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override {
        if (from == address(0) || to == address(0)) return;

        if (address(complianceAdapter) != address(0)) {
            try complianceAdapter.isEligible(to) returns (bool eligible) {
                require(eligible, "Transfer blocked: recipient not eligible");
            } catch {
                revert("Transfer blocked: compliance check failed");
            }
        }
    }
}
