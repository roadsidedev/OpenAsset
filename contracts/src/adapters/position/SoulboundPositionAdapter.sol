// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../interfaces/adapters/IPositionAdapterInit.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

/**
 * @title SoulboundPositionAdapter
 * @notice Reference position adapter — non-transferable ERC721 (clone template)
 * @dev Implements IPositionAdapter as a soulbound (non-transferable) ERC721.
 *      Uses clone template pattern: constructor runs on implementation,
 *      initialize() is called on each cloned instance.
 *
 *      Transfer always reverts — the position can never change hands.
 *      Default for any market with a non-null Compliance Adapter.
 */
contract SoulboundPositionAdapter is ERC721, IPositionAdapterInit, Initializable {
    address public factory;
    mapping(address => bool) public authorizedMarkets;

    string private _adapterName;
    string private _adapterSymbol;

    modifier onlyMarket() {
        require(authorizedMarkets[msg.sender], "Unauthorized");
        _;
    }

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    /// @notice Multi-tenant instance constructor — sets the factory so the MarketFactory can
    ///         call registerMarket() directly. The clone-template initialize() path is preserved
    ///         for backwards compatibility but is not required for the standard flow.
    constructor(address _factory) ERC721("OpenAsset Market Soulbound Position", "rcSBP") {
        require(_factory != address(0), "Invalid factory");
        factory = _factory;
        _adapterName = "OpenAsset Market Soulbound Position";
        _adapterSymbol = "rcSBP";
    }

    /**
     * @notice Initialize cloned instance (called by factory after minimal proxy deployment)
     * @param _factory Address of the MarketFactory
     * @param complianceAdapter Address of ComplianceAdapter (unused — soulbound blocks all transfers)
     */
    function initialize(address _factory, address complianceAdapter) external initializer {
        require(_factory != address(0), "Invalid factory");
        factory = _factory;
        _adapterName = "OpenAsset Market Soulbound Position";
        _adapterSymbol = "rcSBP";
        // complianceAdapter is intentionally unused — soulbound blocks all transfers regardless
    }

    function name() public view override returns (string memory) {
        return bytes(_adapterName).length > 0 ? _adapterName : super.name();
    }

    function symbol() public view override returns (string memory) {
        return bytes(_adapterSymbol).length > 0 ? _adapterSymbol : super.symbol();
    }

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
    ) internal pure override {
        require(to == address(0), "Soulbound: transfer not allowed");
    }
}
