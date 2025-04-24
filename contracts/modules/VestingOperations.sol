// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IErthaToken.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Address.sol";

/**
 * @title VestingOperations
 * @dev Vesting functions for the ErthaToken contract
 */
contract VestingOperations is IErthaToken {
    
    /**
     * @dev Release vested tokens for a beneficiary
     * @param _beneficiary Address of the beneficiary
     * @return Amount of tokens released
     */
    function releaseVestedTokens(address _beneficiary) external nonReentrant validAddress(_beneficiary) returns (uint256) {
        VestingSchedule storage schedule = vestingSchedules[_beneficiary];
        
        // Ensure the vesting schedule exists
        require(schedule.totalAmount > 0, "No vesting schedule exists for this address");
        
        // Calculate the amount of tokens that have vested
        uint256 vestedAmount = calculateVestedAmount(_beneficiary);
        
        // Calculate unreleased tokens
        uint256 unreleased = vestedAmount - schedule.releasedAmount;
        
        // Ensure there are tokens to release
        require(unreleased > 0, "No tokens are available for release");
        
        // Update released amount before transfer to prevent reentrancy
        schedule.releasedAmount += unreleased;
        
        // Mint tokens to the beneficiary
        _mint(_beneficiary, unreleased);
        
        emit TokensReleased(_beneficiary, unreleased, block.timestamp);
        
        return unreleased;
    }
    
    /**
     * @dev Calculate the amount of tokens that have vested for a beneficiary
     * @param _beneficiary Address of the beneficiary
     * @return Amount of vested tokens
     */
    function calculateVestedAmount(address _beneficiary) public view validAddress(_beneficiary) returns (uint256) {
        VestingSchedule storage schedule = vestingSchedules[_beneficiary];
        
        // Ensure the vesting schedule exists
        if (schedule.totalAmount == 0) {
            return 0;
        }
        
        // If the cliff period hasn't passed, nothing has vested
        if (block.timestamp < schedule.startTime + schedule.cliffDuration) {
            return 0;
        }
        
        // If the vesting period is complete, everything has vested
        if (block.timestamp >= schedule.startTime + schedule.duration) {
            return schedule.totalAmount;
        }
        
        // Calculate vested amount based on elapsed time (linear vesting)
        uint256 timeElapsed = block.timestamp - schedule.startTime;
        uint256 vestedAmount = (schedule.totalAmount * timeElapsed) / schedule.duration;
        
        return vestedAmount;
    }
    
    /**
     * @dev Get the vesting schedule for a beneficiary
     * @param _beneficiary Address of the beneficiary
     * @return totalAmount Total amount of tokens in the vesting schedule
     * @return releasedAmount Amount of tokens already released
     * @return startTime Time when vesting started
     * @return duration Duration of the vesting period
     * @return cliffDuration Duration of the cliff period
     */
    function getVestingSchedule(address _beneficiary) external view validAddress(_beneficiary) returns (
        uint256 totalAmount,
        uint256 releasedAmount,
        uint256 startTime,
        uint256 duration,
        uint256 cliffDuration
    ) {
        VestingSchedule storage schedule = vestingSchedules[_beneficiary];
        
        return (
            schedule.totalAmount,
            schedule.releasedAmount,
            schedule.startTime,
            schedule.duration,
            schedule.cliffDuration
        );
    }
    
    /**
     * @dev Internal function to set up a vesting schedule
     * @param _beneficiary Address of the beneficiary
     * @param _amount Total amount of tokens to vest
     * @param _duration Duration of the vesting period
     * @param _cliffDuration Duration of the cliff period
     */
    function _setupVesting(
        address _beneficiary,
        uint256 _amount,
        uint256 _duration,
        uint256 _cliffDuration
    ) internal validAddress(_beneficiary) {
        require(_amount > 0, "Vesting amount must be greater than 0");
        require(_duration > 0, "Vesting duration must be greater than 0");
        require(_cliffDuration <= _duration, "Cliff duration cannot exceed vesting duration");
        
        // Create vesting schedule
        VestingSchedule storage schedule = vestingSchedules[_beneficiary];
        
        // Ensure the beneficiary doesn't already have a vesting schedule
        require(schedule.totalAmount == 0, "Beneficiary already has a vesting schedule");
        
        schedule.totalAmount = _amount;
        schedule.releasedAmount = 0;
        schedule.startTime = block.timestamp;
        schedule.duration = _duration;
        schedule.cliffDuration = _cliffDuration;
        
        emit TokensVested(_beneficiary, _amount);
    }
}