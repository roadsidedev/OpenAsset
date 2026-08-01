// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

/**
 * @title MockChainlinkFeed
 * @notice Test-only Chainlink AggregatorV3Interface with settable round data
 */
contract MockChainlinkFeed is AggregatorV3Interface {
    int256 public answer;
    uint8 public immutable decimalsValue;
    uint256 public updatedAt;
    uint80 public nextRoundId;
    uint256 public startedAt;
    string public descriptionValue;

    constructor(int256 _answer, uint8 _decimals, uint256 _startedAt) {
        answer = _answer;
        decimalsValue = _decimals;
        startedAt = _startedAt;
        updatedAt = block.timestamp;
        nextRoundId = 1;
        descriptionValue = "Mock Feed";
    }

    function decimals() external view override returns (uint8) {
        return decimalsValue;
    }

    function description() external view override returns (string memory) {
        return descriptionValue;
    }

    function version() external pure override returns (uint256) {
        return 1;
    }

    function getRoundData(uint80 roundId)
        external
        view
        override
        returns (uint80, int256, uint256, uint256, uint80)
    {
        return (roundId, answer, startedAt, updatedAt, roundId);
    }

    function latestRoundData()
        external
        view
        override
        returns (uint80 roundId, int256, uint256, uint256, uint80)
    {
        return (nextRoundId, answer, startedAt, updatedAt, nextRoundId);
    }

    // ---- Test helpers ----

    function setAnswer(int256 _answer) external {
        answer = _answer;
        updatedAt = block.timestamp;
        nextRoundId++;
    }

    function setAnswerAndTimestamp(int256 _answer, uint256 _updatedAt) external {
        answer = _answer;
        updatedAt = _updatedAt;
        nextRoundId++;
    }

    function setStartedAt(uint256 _startedAt) external {
        startedAt = _startedAt;
    }

    function setDescription(string calldata _description) external {
        descriptionValue = _description;
    }
}
