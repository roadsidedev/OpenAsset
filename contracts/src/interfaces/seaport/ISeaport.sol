// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ISeaport
 * @notice Minimal Seaport (OpenSea) interface subset used by the NFT liquidation adapter.
 * @dev Mirrors Seaport v1.4/1.5 canonical type layout (order of fields matters for
 *      `abi.encode`/`cancel` compatibility). Only the surface the adapter needs is
 *      declared — fulfillment itself is performed by buyers through Seaport/OpenSea
 *      with orders posted off-chain by the keeper.
 */
interface ISeaport {
    enum ItemType {
        NATIVE,
        ERC20,
        ERC721,
        ERC1155,
        ERC721_WITH_CRITERIA,
        ERC1155_WITH_CRITERIA
    }

    struct OfferItem {
        ItemType itemType;
        address token;
        uint256 identifierOrCriteria;
        uint256 startAmount;
        uint256 endAmount;
    }

    struct ConsiderationItem {
        ItemType itemType;
        address token;
        uint256 identifierOrCriteria;
        uint256 startAmount;
        uint256 endAmount;
        address recipient;
    }

    struct OrderComponents {
        address offerer;
        address zone;
        OfferItem[] offer;
        ConsiderationItem[] consideration;
        uint8 orderType;
        uint256 startTime;
        uint256 endTime;
        bytes32 zoneHash;
        uint256 salt;
        bytes32 conduitKey;
        uint256 totalOriginalConsiderationItems;
        uint256 counter;
    }

    /**
     * @notice Cancel orders whose offerer is msg.sender
     * @param orders The order components to cancel
     * @return cancelled True if all orders were cancelled
     */
    function cancel(OrderComponents[] calldata orders) external returns (bool cancelled);

    /**
     * @notice Retrieve the offerer's current order counter (for order construction)
     */
    function getCounter(address offerer) external view returns (uint256 counter);
}
