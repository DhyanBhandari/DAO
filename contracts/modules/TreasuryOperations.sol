// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IErthaToken.sol";

/**
 * @title TreasuryOperations
 * @dev Treasury management functions for the ErthaToken contract
 */
contract TreasuryOperations is IErthaToken {
    
    /**
     * @dev Initiate a token buyback and burn (to be called by treasury)
     * @param _amount Amount of tokens to buy back and burn
     */
    function buybackAndBurn(uint256 _amount) external {
        require(msg.sender == treasuryWallet, "Only treasury can perform buybacks");
        require(_amount > 0, "Cannot buyback 0 tokens");
        require(balanceOf(treasuryWallet) >= _amount, "Treasury has insufficient balance");
        
        // Create action identifier for consensus
        bytes32 actionId = keccak256(abi.encodePacked(
            "buybackAndBurn",
            _amount,
            block.timestamp
        ));
        
        // Check if this action has already been confirmed
        if (!_confirmAction(actionId)) {
            return; // Wait for more confirmations
        }
        
        // Treasury transfers tokens to this contract
        super._update(treasuryWallet, address(this), _amount);
        
        // Burn the tokens
        _burn(address(this), _amount);
        
        emit ActionExecuted(actionId);
    }
    
    /**
     * @dev Pause all token transfers - requires multi-validator consensus
     */
    function pause() external onlyOwner {
        // Create action identifier for consensus
        bytes32 actionId = keccak256(abi.encodePacked(
            "pause",
            block.timestamp
        ));
        
        // If not already timelocked, set the timelock
        if (timelockExpirations[actionId] == 0) {
            timelockExpirations[actionId] = block.timestamp + timelockPeriod;
            emit ActionTimelocked(actionId, timelockExpirations[actionId]);
            return;
        }
        
        // Check if timelock has expired
        require(block.timestamp >= timelockExpirations[actionId], "Timelock not expired");
        
        // Check if this action has already been confirmed
        if (!_confirmAction(actionId)) {
            return; // Wait for more confirmations
        }
        
        // If we reach here, action is confirmed by enough validators
        _pause();
        emit ActionExecuted(actionId);
    }
    
    /**
     * @dev Unpause all token transfers - requires multi-validator consensus
     */
    function unpause() external onlyOwner {
        // Create action identifier for consensus
        bytes32 actionId = keccak256(abi.encodePacked(
            "unpause",
            block.timestamp
        ));
        
        // Check if this action has already been confirmed
        if (!_confirmAction(actionId)) {
            return; // Wait for more confirmations
        }
        
        // If we reach here, action is confirmed by enough validators
        _unpause();
        emit ActionExecuted(actionId);
    }
}