// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IAssetAdapter
 * @notice Handles collateral custody for the lending engine
 * @dev Implementations: ERC20Adapter, ERC721Adapter, ERC1155Adapter
 *
 * The core engine never touches collateral directly — it delegates all
 * escrow and release operations to the market's configured AssetAdapter.
 * The engine independently verifies balance deltas after each call
 * (Section 4, Adapter Trust Model).
 *
 * Multi-tenancy: A single adapter instance serves many markets. The
 * factory calls configure() once per market at deployment time.
 */
interface IAssetAdapter {
    /**
     * @notice Configure the adapter for a specific market
     * @param market Address of the LendingMarket contract
     * @param collateralToken Address of the collateral token for this market
     */
    function configure(address market, address collateralToken) external;
    /**
     * @notice Escrow collateral from the sender to the lending market
     * @dev Must transfer `amountOrId` of the collateral asset from `from`
     *      to the calling LendingMarket contract. The engine will verify
     *      the actual balance delta matches the requested amount.
     * @param from Address sending the collateral
     * @param amountOrId Amount (ERC20/ERC1155) or token ID (ERC721)
     */
    function escrow(address from, uint256 amountOrId) external;

    /**
     * @notice Release collateral from the lending market to the recipient
     * @dev Must transfer `amountOrId` of the collateral asset from the
     *      calling LendingMarket contract to `to`.
     * @param to Address receiving the collateral
     * @param amountOrId Amount (ERC20/ERC1155) or token ID (ERC721)
     */
    function release(address to, uint256 amountOrId) external;

    /**
     * @notice Check if the collateral asset is transferable from sender to market
     * @dev Called before escrow to verify the transfer will succeed.
     *      For ERC20: checks allowance and balance.
     *      For ERC721/ERC1155: checks ownership and operator approval.
     * @param from Address sending the collateral
     * @param to Address receiving the collateral (the LendingMarket)
     * @param amountOrId Amount (ERC20/ERC1155) or token ID (ERC721)
     * @return transferable True if the transfer would succeed
     */
    function isTransferable(address from, address to, uint256 amountOrId) external view returns (bool);
}
