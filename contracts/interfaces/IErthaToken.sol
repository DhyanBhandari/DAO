// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IErthaToken
 * @dev Interface for the Erthaloka Token (ERTH)
 */
interface IErthaToken is IERC20 {
    // ============ Events ============
    event TokensVested(address indexed beneficiary, uint256 amount);
    event TokensReleased(address indexed beneficiary, uint256 amount, uint256 releaseTime);
    event StakeDeposited(address indexed user, uint256 amount);
    event StakeWithdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward, uint256 fee);
    event FeeCollected(address indexed from, address indexed to, uint256 amount, string feeType);
    event FeeRatesUpdated(uint256 teamFeeRate, uint256 stakingFeeRate, uint256 burnFeeRate);
    event PerformanceFeeUpdated(uint256 oldRate, uint256 newRate);
    event ValidatorAdded(address indexed validator);
    event ValidatorRemoved(address indexed validator);
    event ValidatorSlashed(address indexed validator, uint256 missedConfirmations);
    event ActionConfirmed(bytes32 indexed actionId, address indexed validator);
    event ActionPending(bytes32 indexed actionId, uint256 confirmationsCount, uint256 required);
    event ActionExecuted(bytes32 indexed actionId);
    event ActionTimelocked(bytes32 indexed actionId, uint256 executionTime);
    event TeamWalletUpdated(address indexed oldWallet, address indexed newWallet);
    event StakingPoolUpdated(address indexed oldPool, address indexed newPool);
    event TreasuryWalletUpdated(address indexed oldWallet, address indexed newWallet);
    event FeeExemptionUpdated(address indexed account, bool status);
    event RewardRateUpdated(uint256 oldRate, uint256 newRate);
    event ContractUpgraded(address indexed implementation);
    event TimelockPeriodUpdated(uint256 oldPeriod, uint256 newPeriod);
    event RequiredConfirmationsUpdated(uint256 oldRequired, uint256 newRequired);
    
    // ============ Functions ============
    
    // Fee Management
    function setFeeRates(uint256 _teamFeeRate, uint256 _stakingFeeRate, uint256 _burnFeeRate) external;
    function setPerformanceFeeRate(uint256 _performanceFeeRate) external;
    function setTreasuryWallet(address _newTreasuryWallet) external;
    function setFeeExemption(address _address, bool _isExempt) external;
    function setTeamWallet(address _newTeamWallet) external;
    function setStakingPool(address _newStakingPool) external;
    function setTimelockPeriod(uint256 _timelockPeriod) external;
    
    // Staking
    function setRewardRate(uint256 _rewardRate) external;
    function stake(uint256 _amount) external;
    function withdraw(uint256 _amount) external;
    function claimRewards() external;
    function getStakingInfo(address _staker) external view returns (
        uint256 amount,
        uint256 since,
        uint256 pendingRewards
    );
    
    // Vesting
    function releaseVestedTokens(address _beneficiary) external returns (uint256);
    function calculateVestedAmount(address _beneficiary) external view returns (uint256);
    function getVestingSchedule(address _beneficiary) external view returns (
        uint256 totalAmount,
        uint256 releasedAmount,
        uint256 startTime,
        uint256 duration,
        uint256 cliffDuration
    );
    
    // Validators
    function addValidator(address _validator) external;
    function removeValidator(address _validator) external;
    function slashValidator(address _validator) external;
    function setRequiredConfirmations(uint256 _required) external;
    function confirmAction(bytes32 _actionId) external returns (bool);
    function getConfirmationCount(bytes32 _actionId) external view returns (uint256);
    function getValidators() external view returns (address[] memory);
    function hasConfirmed(bytes32 _actionId, address _validator) external view returns (bool);
    
    // Treasury
    function buybackAndBurn(uint256 _amount) external;
    function pause() external;
    function unpause() external;
    
    // Governance
    function snapshot() external returns (uint256);
    function setProposalFee(uint256 _proposalFee) external;
    function setVotingFee(uint256 _votingFee) external;
    function createProposal() external returns (bool);
    function vote(uint256 _proposalId) external returns (bool);
}