// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Snapshot.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IErthaToken.sol";
import "./libraries/ConsensusManager.sol";
import "./libraries/Validators.sol";
import "./libraries/StakingMath.sol";
import "./modules/ValidatorOperations.sol";
import "./modules/StakingOperations.sol";
import "./modules/VestingOperations.sol";
import "./modules/GovernanceOperations.sol";
import "./modules/TreasuryOperations.sol";

/**
 * @title Erthaloka Token
 * @dev Implementation of the Erthaloka Token (ERTH) with enhanced security features
 */
contract ErthaToken is 
    ERC20, 
    ERC20Burnable, 
    ERC20Pausable,
    ERC20Snapshot,
    ERC20Permit,
    Ownable, 
    ReentrancyGuard,
    UUPSUpgradeable,
    ValidatorOperations,
    StakingOperations,
    VestingOperations,
    GovernanceOperations,
    TreasuryOperations {
    using ECDSA for bytes32;
    using ConsensusManager for bytes32;
    using Validators for address[];
    using StakingMath for uint256;
    
    // ============ Constants ============
    uint256 public constant INITIAL_SUPPLY = 3_000_000_000 * 10**18; // 3 billion tokens
    uint256 public constant BASIS_POINTS = 10000; // 100% = 10000
    uint256 public constant MAX_FEE_RATE = 500; // 5% maximum fee
    uint256 public constant MAX_PERFORMANCE_FEE = 2000; // 20% maximum performance fee
    
    // ============ Consensus Security ============
    uint256 public requiredConfirmations = 3; // Number of validators required for consensus
    address[] public validators;
    mapping(address => bool) public isValidator;
    mapping(bytes32 => mapping(address => bool)) public confirmations;
    mapping(bytes32 => bool) public isActionConfirmed;
    
    // Timelock for security-critical operations
    uint256 public timelockPeriod = 1 days;
    mapping(bytes32 => uint256) public timelockExpirations;
    
    // ============ Fee structure ============
    uint256 public transactionFeeRate = 300; // 3% (300 basis points)
    uint256 public teamFeeRate = 100; // 1% (100 basis points) - goes to team wallet
    uint256 public stakingFeeRate = 100; // 1% (100 basis points) - goes to staking pool
    uint256 public burnFeeRate = 100; // 1% (100 basis points) - tokens are burned
    uint256 public performanceFeeRate = 1000; // 10% (1000 basis points) - performance fee on staking rewards
    
    // ============ Addresses ============
    address public teamWallet;
    address public stakingPool;
    address public treasuryWallet;
    
    // ============ Exemptions ============
    mapping(address => bool) public isExemptFromFee;
    
    // ============ Vesting ============
    struct VestingSchedule {
        uint256 totalAmount;
        uint256 releasedAmount;
        uint256 startTime;
        uint256 duration;
        uint256 cliffDuration;
    }
    
    mapping(address => VestingSchedule) public vestingSchedules;
    
    // ============ Staking ============
    struct StakingInfo {
        uint256 amount;
        uint256 since;
        uint256 rewardDebt;
        uint256 userRewardPerTokenPaid; // Track the reward per token for each user
    }
    
    mapping(address => StakingInfo) public stakingInfo;
    uint256 public totalStaked;
    uint256 public rewardRate = 100 * 10**18; // 100 ERTH per day
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    
    // ============ Governance ============
    uint256 public proposalFee = 10 * 10**18; // 10 ERTH
    uint256 public votingFee = 1 * 10**18; // 1 ERTH
    
    // ============ Validator Stats & Slashing ============
    mapping(address => uint256) public validatorMissedConfirmations;
    uint256 public maxMissedConfirmations = 10; // After this many misses, a validator can be slashed
    
    // For UUPS upgradeable pattern with initialization
    bool private _initialized;
    
    // Common checks as modifiers
    modifier validAddress(address _address) {
        require(_address != address(0), "Cannot be zero address");
        _;
    }
    
    modifier onlyTeamOrTreasury() {
        require(msg.sender == teamWallet || msg.sender == treasuryWallet, "Only team or treasury");
        _;
    }
    
    modifier onlyValidator() {
        require(isValidator[msg.sender], "Only validators can perform this action");
        _;
    }
    
    modifier timelockExpired(bytes32 _actionId) {
        require(timelockExpirations[_actionId] > 0, "Action not timelocked");
        require(block.timestamp >= timelockExpirations[_actionId], "Timelock not expired");
        _;
    }
    
    // For UUPS upgradeable pattern with enhanced security
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {
        // Create action identifier for consensus and timelock
        bytes32 actionId = keccak256(abi.encodePacked(
            "upgrade",
            newImplementation,
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
        
        // Check if this action has already been confirmed by enough validators
        if (!_checkConfirmations(actionId)) {
            return; // Wait for more confirmations
        }
        
        // If we reach here, action is confirmed by enough validators and timelock expired
        emit ContractUpgraded(newImplementation);
    }
    
    /**
     * @dev Constructor for implementation contract
     * @param _teamWallet Address of the team wallet for fee collection
     * @param _stakingPool Address of the staking pool for fee distribution
     * @param _treasuryWallet Address of the treasury wallet
     */
    constructor(
        address _teamWallet,
        address _stakingPool,
        address _treasuryWallet
    ) ERC20("Erthaloka Token", "ERTH") 
      ERC20Permit("Erthaloka Token")
      Ownable(msg.sender) {
        // Implementation contract should not be initialized here
        // Initialization will be done in the initialize function called by the proxy
    }
    
    /**
     * @dev Initialize function to be called by the proxy contract
     * @param _teamWallet Address of the team wallet for fee collection
     * @param _stakingPool Address of the staking pool for fee distribution
     * @param _treasuryWallet Address of the treasury wallet
     * @param _owner Address of the contract owner
     */
    function initialize(
        address _teamWallet,
        address _stakingPool,
        address _treasuryWallet,
        address _owner
    ) external {
        require(!_initialized, "Contract already initialized");
        require(_teamWallet != address(0), "Team wallet cannot be zero address");
        require(_stakingPool != address(0), "Staking pool cannot be zero address");
        require(_treasuryWallet != address(0), "Treasury wallet cannot be zero address");
        require(_owner != address(0), "Owner cannot be zero address");
        
        _initialized = true;
        
        // Transfer ownership
        _transferOwnership(_owner);
        
        teamWallet = _teamWallet;
        stakingPool = _stakingPool;
        treasuryWallet = _treasuryWallet;
        
        // Setup fee exemptions for critical contracts
        isExemptFromFee[_teamWallet] = true;
        isExemptFromFee[_stakingPool] = true;
        isExemptFromFee[_treasuryWallet] = true;
        isExemptFromFee[address(this)] = true;
        
        // Add the contract deployer as the first validator
        validators.push(_owner);
        isValidator[_owner] = true;
        emit ValidatorAdded(_owner);
        
        // Initial token distribution
        // Public Sale (40%)
        _mint(treasuryWallet, INITIAL_SUPPLY * 40 / 100);
        
        // Staking Rewards (20%)
        _mint(stakingPool, INITIAL_SUPPLY * 20 / 100);
        
        // Treasury (15%)
        _mint(treasuryWallet, INITIAL_SUPPLY * 15 / 100);
        
        // Team & Advisors (10%) - Vested over 24 months
        _setupVesting(_teamWallet, INITIAL_SUPPLY * 10 / 100, 730 days, 180 days);
        
        // Ecosystem Growth (10%)
        _mint(treasuryWallet, INITIAL_SUPPLY * 10 / 100);
        
        // Reserve (5%)
        _mint(treasuryWallet, INITIAL_SUPPLY * 5 / 100);
        
        // Initialize staking parameters
        lastUpdateTime = block.timestamp;
    }
    
    /**
     * @dev Override _update to implement fee mechanism and pausable functionality
     * Gas optimized by batching operations and minimizing storage reads
     */
    function _update(address from, address to, uint256 amount) internal override(ERC20, ERC20Pausable, ERC20Snapshot) {
        if (amount == 0) {
            super._update(from, to, 0);
            return;
        }
        
        // Skip fee logic for exempted addresses, minting, and burning operations
        // Gas optimization: Cache fee exemption status to avoid multiple storage reads
        bool isExempt = isExemptFromFee[from] || isExemptFromFee[to] || from == address(0) || to == address(0);
        
        if (isExempt) {
            super._update(from, to, amount);
            return;
        }
        
        // Calculate fees - Gas optimization: Cache fee rates to reduce storage reads
        uint256 _teamFeeRate = teamFeeRate;
        uint256 _stakingFeeRate = stakingFeeRate;
        uint256 _burnFeeRate = burnFeeRate;
        
        // Improved fee calculation with rounding to prevent truncation errors
        uint256 teamFee = (amount * _teamFeeRate + BASIS_POINTS / 2) / BASIS_POINTS;
        uint256 stakingFee = (amount * _stakingFeeRate + BASIS_POINTS / 2) / BASIS_POINTS;
        uint256 burnFee = (amount * _burnFeeRate + BASIS_POINTS / 2) / BASIS_POINTS;
        uint256 totalFee = teamFee + stakingFee + burnFee;
        uint256 transferAmount = amount - totalFee;
        
        // Transfer to recipient
        super._update(from, to, transferAmount);
        
        // Handle fees - Gas optimization: Cache wallet addresses
        address _teamWallet = teamWallet;
        address _stakingPool = stakingPool;
        
        // Gas optimization: Batch transfers when possible
        if (teamFee > 0) {
            super._update(from, _teamWallet, teamFee);
            emit FeeCollected(from, _teamWallet, teamFee, "TEAM_FEE");
        }
        
        if (stakingFee > 0) {
            super._update(from, _stakingPool, stakingFee);
            emit FeeCollected(from, _stakingPool, stakingFee, "STAKING_FEE");
        }
        
        if (burnFee > 0) {
            super._update(from, address(0), burnFee); // Burn by sending to zero address
            emit FeeCollected(from, address(0), burnFee, "BURN_FEE");
        }
    }
}