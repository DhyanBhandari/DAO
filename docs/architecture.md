# Erthaloka Token - Architecture

This document outlines the architectural design of the Erthaloka Token (ERTH) smart contract system.

## Overview

The Erthaloka Token is designed with a focus on:

1. **Security**: Implementing multiple layers of protection against common vulnerabilities
2. **Modularity**: Separating concerns into manageable, auditable components
3. **Upgradeability**: Allowing for future improvements while preserving state
4. **Gas Efficiency**: Optimizing operations to minimize transaction costs
5. **Governance**: Enabling decentralized management through multi-validator consensus

## Contract Structure

The contract follows a modular architecture with clearly separated concerns:

### Main Contracts

- **ErthaToken**: The main contract that inherits functionality from modules and OpenZeppelin contracts
- **ErthaTokenFactory**: Factory for deploying tokens through the UUPS proxy pattern

### Modules

- **ValidatorOperations**: Manages validator consensus and access control
- **StakingOperations**: Handles token staking and reward distribution
- **VestingOperations**: Implements vesting schedules for token distribution
- **GovernanceOperations**: Handles governance functionality including proposals and voting
- **TreasuryOperations**: Manages treasury functions and emergency operations

### Libraries

- **ConsensusManager**: Utility functions for consensus operations
- **Validators**: Helper functions for validator management
- **StakingMath**: Math functions for staking calculations

### Interfaces

- **IErthaToken**: Main interface defining all external functions

## Inheritance Structure

The ErthaToken contract inherits from:

```
ErthaToken
├── ERC20 (OpenZeppelin)
├── ERC20Burnable (OpenZeppelin)
├── ERC20Pausable (OpenZeppelin)
├── ERC20Snapshot (OpenZeppelin)
├── ERC20Permit (OpenZeppelin)
├── Ownable (OpenZeppelin)
├── ReentrancyGuard (OpenZeppelin)
├── UUPSUpgradeable (OpenZeppelin)
├── ValidatorOperations
├── StakingOperations
├── VestingOperations
├── GovernanceOperations
└── TreasuryOperations
```

## Deployment Model

The contract uses the UUPS (Universal Upgradeable Proxy Standard) pattern for upgradeability:

1. The **implementation contract** contains the logic
2. The **proxy contract** stores the state and delegates calls to the implementation
3. The **factory contract** automates the deployment process

This approach allows for future upgrades without losing the contract state or requiring users to migrate tokens.

## Security Features

### Multi-Validator Consensus

Critical operations require confirmation from multiple validators before execution:

1. **Confirmation Tracking**: Each validator confirms actions using a unique action ID
2. **Threshold Enforcement**: A minimum number of confirmations must be reached
3. **Validator Slashing**: Validators who fail to participate can be removed

### Timelock Mechanism

Security-sensitive operations require a waiting period:

1. **Timelocked Functions**: Contract upgrades and pausing have mandatory waiting periods
2. **Two-Phase Execution**: First initiate the action, then execute after timelock expiry

### Reentrancy Protection

All state-changing functions are protected against reentrancy attacks:

1. **State Changes First**: State variables are updated before external calls
2. **ReentrancyGuard**: OpenZeppelin's ReentrancyGuard modifier on state-changing functions

### Fee Mechanism

The token implements a 3% transaction fee with configurable rates:

1. **Team Fee**: 1% goes to the team wallet for development
2. **Staking Fee**: 1% goes to the staking pool for rewards
3. **Burn Fee**: 1% is burned, creating deflationary pressure

### Exemptions

Addresses can be exempted from fees to facilitate specific use cases:

1. **Critical Contracts**: Contract itself, treasury, team wallet, and staking pool are exempt
2. **Configurable Exemptions**: Owner can add/remove exemptions with validator consensus

## Staking System

The token implements a staking mechanism for holders to earn rewards:

1. **Daily Rewards**: A configurable reward rate distributed daily
2. **Per-Token Tracking**: Rewards calculated based on the proportion of total staked tokens
3. **Performance Fee**: 10% of staking rewards go to the team wallet

## Vesting Mechanism

Team tokens are distributed through a vesting schedule:

1. **Linear Vesting**: Tokens are released gradually over the vesting period
2. **Cliff Period**: No tokens are released until the cliff period ends
3. **Daily Precision**: Vesting calculations use daily precision for accuracy

## Governance

The token includes a basic governance system:

1. **Proposals**: Token holders can create governance proposals
2. **Voting**: Token holders can vote on proposals
3. **Snapshot**: Point-in-time balances are used for voting weight
4. **Fees**: Small fees for creating proposals and voting to prevent spam

## Proxy Upgradeability

The UUPS (Universal Upgradeable Proxy Standard) pattern provides:

1. **Logic/Storage Separation**: Logic in implementation, state in proxy
2. **Atomic Upgrades**: Implementation can be switched in a single transaction
3. **Security Controls**: Upgrades require validator consensus and timelock
4. **Transparent Interface**: Users interact with a single contract address

## Data Flow

### Transaction Fees

```
User Transfer
  ↓
Check Exemption Status
  ↓
Calculate Fees
  ↓
Transfer to Recipient (Amount - Fees)
  ↓
Send Team Fee to Team Wallet
  ↓
Send Staking Fee to Staking Pool
  ↓
Burn Burn Fee
```

### Staking System

```
User Stakes Tokens
  ↓
Tokens Transferred to Contract
  ↓
Update User Staking Info
  ↓
Time Passes
  ↓
User Claims Rewards
  ↓
Calculate Rewards Based on Time and Stake
  ↓
Apply Performance Fee
  ↓
Transfer Rewards to User
  ↓
Send Performance Fee to Team Wallet
```

### Validator Consensus

```
Critical Operation Requested
  ↓
Generate Action ID
  ↓
Validator 1 Confirms
  ↓
Validator 2 Confirms
  ↓
...
  ↓
Required Confirmations Reached
  ↓
Function Execution Allowed
```

## Gas Optimization Techniques

The contract implements several gas optimization techniques:

1. **Storage Packing**: Related variables are packed into the same storage slot
2. **Cached Variables**: Frequently used storage variables are cached in memory
3. **Batched Operations**: Multiple transfers are batched where possible
4. **Reduced Storage Reads**: Storage reads are minimized in critical functions
5. **Early Returns**: Functions exit early for special cases to save gas