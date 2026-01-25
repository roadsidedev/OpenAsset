// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../LendingMarket.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ReentrancyAttacker {
    LendingMarket public market;
    
    constructor(address _market) {
        market = LendingMarket(_market);
    }

    // Attempt to re-enter withdraw
    // Note: To truly test this with standard ERC20 is hard unless we have a hook. 
    // But we can check if the modifier is present by inspection or use a hook-enabled token.
    // For this demonstration, we'll try to call back if we receive ETH (if it was an ETH contract) 
    // or if we use an ERC777 token. 
    // Since we are using standard ERC20s in mocks, this might be a placeholder for a more complex attack
    // if we were supporting those tokens. 
    // Let's implement a fallback just in case.
    
    receive() external payable {
        // Attack logic would go here
    }
}
