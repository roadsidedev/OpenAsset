// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../interfaces/adapters/IPositionAdapterInit.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

/**
 * @title StandardPositionAdapter
 * @notice Reference position adapter — no token, plain mapping
 * @dev Implements IPositionAdapterInit with minimal gas overhead.
 *      Positions are tracked in a mapping with no ERC721 minting.
 *      Uses clone template pattern: constructor runs on implementation,
 *      initialize() is called on each cloned instance after minimal proxy deploy.
 *
 * Default use case: simple crypto-native markets with no compliance
 * requirement and no need for secondary-market/tooling benefits.
 */
contract StandardPositionAdapter is IPositionAdapterInit, Initializable {
    address public factory;
    mapping(address => bool) public authorizedMarkets;

    mapping(uint256 => address) public positionOwners;

    modifier onlyMarket() {
        require(authorizedMarkets[msg.sender], "Unauthorized");
        _;
    }

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    /// @notice Template constructor — sets sentinel so clone detection works; real factory set via initialize()
    constructor() {
        factory = address(0xdead);
    }

    /**
     * @notice Initialize cloned instance (called by factory after minimal proxy deployment)
     * @param _factory Address of the MarketFactory
     * @param complianceAdapter Address of ComplianceAdapter (unused, only for interface conformance)
     */
    function initialize(address _factory, address complianceAdapter) external initializer {
        require(_factory != address(0), "Invalid factory");
        factory = _factory;
        // complianceAdapter is intentionally unused — StandardPositionAdapter has no compliance hook
    }

    function registerMarket(address market) external onlyFactory {
        require(market != address(0), "Invalid market");
        authorizedMarkets[market] = true;
    }

    function mint(address to, uint256 loanId) external override onlyMarket {
        positionOwners[loanId] = to;
    }

    function ownerOf(uint256 loanId) external view override returns (address) {
        return positionOwners[loanId];
    }

    function burn(uint256 loanId) external override onlyMarket {
        delete positionOwners[loanId];
    }
}
