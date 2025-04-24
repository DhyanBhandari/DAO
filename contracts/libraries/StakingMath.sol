// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title StakingMath
 * @dev Library for staking reward calculations
 */
library StakingMath {
    /**
     * @dev Calculate the daily reward based on reward rate and time elapsed
     * @param rewardRate Reward rate in tokens per day
     * @param timeElapsed Time elapsed in seconds
     * @return Daily reward amount
     */
    function calculateDailyReward(uint256 rewardRate, uint256 timeElapsed) internal pure returns (uint256) {
        return (rewardRate * timeElapsed) / 1 days;
    }
    
    /**
     * @dev Calculate the reward per token ratio
     * @param rewardPerTokenStored Current reward per token ratio
     * @param dailyReward Daily reward amount
     * @param totalStaked Total staked tokens
     * @return New reward per token ratio
     */
    function calculateRewardPerToken(
        uint256 rewardPerTokenStored,
        uint256 dailyReward,
        uint256 totalStaked
    ) internal pure returns (uint256) {
        if (totalStaked == 0) {
            return rewardPerTokenStored;
        }
        
        return rewardPerTokenStored + (dailyReward * 1e18 / totalStaked);
    }
    
    /**
     * @dev Calculate the earned rewards for an account
     * @param amount Staked amount
     * @param rewardPerToken Current reward per token ratio
     * @param userRewardPerTokenPaid User's last reward per token ratio
     * @param rewardDebt User's reward debt
     * @return Earned rewards
     */
    function calculateEarned(
        uint256 amount,
        uint256 rewardPerToken,
        uint256 userRewardPerTokenPaid,
        uint256 rewardDebt
    ) internal pure returns (uint256) {
        uint256 newRewards = (amount * (rewardPerToken - userRewardPerTokenPaid)) / 1e18;
        return rewardDebt + newRewards;
    }
    
    /**
     * @dev Calculate the performance fee
     * @param reward Total reward amount
     * @param feeRate Fee rate in basis points
     * @param basisPoints Basis points denominator (usually 10000)
     * @return Fee amount
     */
    function calculatePerformanceFee(
        uint256 reward,
        uint256 feeRate,
        uint256 basisPoints
    ) internal pure returns (uint256) {
        return (reward * feeRate + basisPoints / 2) / basisPoints;
    }
}