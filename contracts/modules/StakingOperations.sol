// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IErthaToken.sol";
import "../libraries/StakingMath.sol";

/**
 * @title StakingOperations
 * @dev Staking functions for the ErthaToken contract
 */
contract StakingOperations is IErthaToken {
    using StakingMath for uint256;
    
    /**
     * @dev Set the reward rate for staking
     * @param _rewardRate New reward rate (tokens per day)
     */
    function setRewardRate(uint256 _rewardRate) external onlyOwner {
        // Create action identifier for consensus
        bytes32 actionId = keccak256(abi.encodePacked(
            "setRewardRate",
            _rewardRate,
            block.timestamp
        ));
        
        // Check if this action has already been confirmed
        if (!_confirmAction(actionId)) {
            return; // Wait for more confirmations
        }
        
        uint256 oldRate = rewardRate;
        _updateReward(address(0));
        rewardRate = _rewardRate;
        
        emit RewardRateUpdated(oldRate, _rewardRate);
        emit ActionExecuted(actionId);
    }
    
    /**
     * @dev Update staking rewards for an account
     * @param _account The account to update rewards for
     */
    function _updateReward(address _account) internal {
        uint256 currentRewardPerToken = rewardPerToken();
        rewardPerTokenStored = currentRewardPerToken;
        lastUpdateTime = block.timestamp;
        
        if (_account != address(0)) {
            StakingInfo storage info = stakingInfo[_account];
            info.rewardDebt = earned(_account);
            info.userRewardPerTokenPaid = currentRewardPerToken;
        }
    }
    
    /**
     * @dev Calculate the current reward per staked token
     * @return The reward per token
     */
    function rewardPerToken() public view returns (uint256) {
        if (totalStaked == 0) {
            return rewardPerTokenStored;
        }
        
        uint256 timeElapsed = block.timestamp - lastUpdateTime;
        uint256 dailyReward = (rewardRate * timeElapsed) / 1 days;
        return rewardPerTokenStored + (dailyReward * 1e18 / totalStaked);
    }
    
    /**
     * @dev Calculate the earned rewards for an account
     * @param _account The account to calculate rewards for
     * @return The earned rewards
     */
    function earned(address _account) public view returns (uint256) {
        StakingInfo storage info = stakingInfo[_account];
        uint256 currentRewardPerToken = rewardPerToken();
        uint256 newRewards = (info.amount * (currentRewardPerToken - info.userRewardPerTokenPaid)) / 1e18;
        return info.rewardDebt + newRewards;
    }
    
    /**
     * @dev Stake tokens to earn rewards
     * @param _amount Amount of tokens to stake
     */
    function stake(uint256 _amount) external nonReentrant {
        require(_amount > 0, "Cannot stake 0 tokens");
        require(balanceOf(msg.sender) >= _amount, "Insufficient balance to stake");
        
        _updateReward(msg.sender);
        
        // Transfer tokens to this contract
        super._update(msg.sender, address(this), _amount);
        
        StakingInfo storage info = stakingInfo[msg.sender];
        if (info.amount == 0) {
            info.since = block.timestamp;
        }
        
        info.amount += _amount;
        totalStaked += _amount;
        
        emit StakeDeposited(msg.sender, _amount);
    }
    
    /**
     * @dev Withdraw staked tokens
     * @param _amount Amount of tokens to withdraw
     */
    function withdraw(uint256 _amount) external nonReentrant {
        require(_amount > 0, "Cannot withdraw 0 tokens");
        StakingInfo storage info = stakingInfo[msg.sender];
        require(info.amount >= _amount, "Not enough staked tokens");
        
        _updateReward(msg.sender);
        
        // Update state before external call to prevent reentrancy
        info.amount -= _amount;
        totalStaked -= _amount;
        
        // Transfer tokens back to user
        super._update(address(this), msg.sender, _amount);
        
        emit StakeWithdrawn(msg.sender, _amount);
    }
    
    /**
     * @dev Claim staking rewards
     * Performance fee is taken by the team wallet
     */
    function claimRewards() external nonReentrant {
        _updateReward(msg.sender);
        
        StakingInfo storage info = stakingInfo[msg.sender];
        uint256 reward = info.rewardDebt;
        
        if (reward > 0) {
            // Update state before external calls to prevent reentrancy
            info.rewardDebt = 0;
            
            // Take performance fee - goes to team wallet
            uint256 performanceFee = (reward * performanceFeeRate + BASIS_POINTS / 2) / BASIS_POINTS;
            uint256 netReward = reward - performanceFee;
            
            // Check if staking pool has sufficient balance
            require(balanceOf(stakingPool) >= reward, "Staking pool has insufficient balance");
            
            // Transfer rewards to user
            super._update(stakingPool, msg.sender, netReward);
            
            // Transfer performance fee to team wallet
            if (performanceFee > 0) {
                super._update(stakingPool, teamWallet, performanceFee);
                emit FeeCollected(msg.sender, teamWallet, performanceFee, "PERFORMANCE_FEE");
            }
            
            emit RewardPaid(msg.sender, netReward, performanceFee);
        }
    }
    
    /**
     * @dev Get staking info for an address
     * @param _staker Address to check staking info for
     * @return amount Amount of tokens staked
     * @return since Timestamp when staking started
     * @return pendingRewards Pending rewards for the staker
     */
    function getStakingInfo(address _staker) external view returns (
        uint256 amount,
        uint256 since,
        uint256 pendingRewards
    ) {
        StakingInfo storage info = stakingInfo[_staker];
        return (
            info.amount,
            info.since,
            earned(_staker)
        );
    }
}