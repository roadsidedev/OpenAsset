// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../interfaces/adapters/IPositionAdapterInit.sol";
import "../../interfaces/adapters/IComplianceAdapter.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

/**
 * @title TransferablePositionAdapter
 * @notice Reference position adapter — transferable ERC721 with compliance hook (clone template)
 * @dev Implements IPositionAdapter as a standard transferable ERC721.
 *      Uses clone template pattern: constructor runs on implementation,
 *      initialize() is called on each cloned instance.
 *
 *      When a ComplianceAdapter is attached, every transfer calls
 *      complianceAdapter.isEligible(recipient) — if it returns false,
 *      the transfer reverts.
 */
contract TransferablePositionAdapter is ERC721, IPositionAdapterInit, Initializable {
    address public factory;
    mapping(address => bool) public authorizedMarkets;

    IComplianceAdapter public complianceAdapter;

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

    /// @notice Template constructor — sentinel; real factory set via initialize() on clones
    constructor() ERC721("OpenAsset Market Transferable Position", "rcTP") {
        // Review M8: lock the template against direct initialization
        _disableInitializers();
        factory = address(0xdead);
        _adapterName = "OpenAsset Market Transferable Position";
        _adapterSymbol = "rcTP";
    }

    /**
     * @notice Initialize cloned instance (called by factory after minimal proxy deployment)
     * @param _factory Address of the MarketFactory
     * @param _complianceAdapter Address of the ComplianceAdapter (address(0) if none)
     */
    function initialize(address _factory, address _complianceAdapter) external initializer {
        require(_factory != address(0), "Invalid factory");
        factory = _factory;
        complianceAdapter = IComplianceAdapter(_complianceAdapter);
        _adapterName = "OpenAsset Market Transferable Position";
        _adapterSymbol = "rcTP";
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
