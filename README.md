# Erthaloka Token (ERTH)

Erthaloka Token (ERTH) is an advanced ERC-20 token implementation with enhanced security features, staking mechanism, vesting schedules, and multi-validator governance.

## Features

- **Transaction Fees**: 3% fee on transfers (1% team, 1% staking pool, 1% burned)
- **Staking Rewards**: Stake tokens to earn daily rewards
- **Vesting**: Linear release mechanism for team tokens with configurable cliff period
- **Governance**: Snapshot-based voting system with multi-validator consensus
- **Security**: Enhanced protection against common vulnerabilities:
  - Reentrancy protection
  - Multi-validator consensus for critical operations
  - Timelock mechanism for sensitive functions
  - Validator accountability with slashing
- **Gas Optimization**: Batch operations and storage packing
- **Upgradeable**: UUPS proxy pattern for future upgrades
- **Pausable**: Emergency pause mechanism with timelock

## Project Structure

```
erthaloka-token/
├── contracts/                     # Smart contracts
│   ├── ErthaToken.sol             # Main token contract
│   ├── ErthaTokenFactory.sol      # Factory for proxy deployment
│   │
│   ├── interfaces/                # Interface definitions
│   │   └── IErthaToken.sol        # Main contract interface
│   │
│   ├── libraries/                 # Utility libraries
│   │   ├── ConsensusManager.sol   # Consensus utilities
│   │   ├── StakingMath.sol        # Staking calculations
│   │   └── Validators.sol         # Validator utilities
│   │
│   └── modules/                   # Modular components
│       ├── GovernanceOperations.sol
│       ├── StakingOperations.sol
│       ├── TreasuryOperations.sol
│       ├── ValidatorOperations.sol
│       └── VestingOperations.sol
│
├── scripts/                       # Deployment scripts
│   ├── deploy/                    # Deployment scripts
│   ├── upgrade/                   # Upgrade scripts
│   └── verify/                    # Verification scripts
│
├── test/                          # Test files
│   ├── unit/                      # Unit tests
│   ├── integration/               # Integration tests
│   └── helpers/                   # Test helpers
│
├── tasks/                         # Hardhat tasks
├── deployments/                   # Deployment artifacts
└── docs/                          # Documentation
```

## Getting Started

### Prerequisites

- Node.js v16+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/erthaloka-token.git
cd erthaloka-token

# Install dependencies
npm install
```

### Configuration

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Edit the `.env` file with your wallet addresses and API keys.

### Compilation

```bash
npm run compile
```

### Testing

```bash
# Run all tests
npm test

# Run tests with gas reporting
npm run test:gas

# Run specific test file
npx hardhat test test/unit/staking.test.js
```

### Deployment

```bash
# Deploy to testnet (Sepolia)
npm run deploy:testnet

# Deploy to mainnet
npm run deploy:mainnet
```

The deployment process is split into two steps:

1. Deploy the factory: `scripts/deploy/01_deploy_factory.js`
2. Deploy the token through the factory: `scripts/deploy/02_deploy_token.js`

### Contract Verification

```bash
# Verify on testnet
npm run verify:testnet

# Verify on mainnet
npm run verify:mainnet
```

## Usage

### Hardhat Tasks

#### Token Information

```bash
npx hardhat token-info --network mainnet
```

#### Validator Management

```bash
# Get validator information
npx hardhat validators --network mainnet

# Add a new validator
npx hardhat add-validator --contract <CONTRACT_ADDRESS> --validator <VALIDATOR_ADDRESS> --network mainnet

# Remove a validator
npx hardhat remove-validator --contract <CONTRACT_ADDRESS> --validator <VALIDATOR_ADDRESS> --network mainnet
```

#### Account Management

```bash
# List accounts
npx hardhat accounts --network mainnet

# Check balance
npx hardhat balance --account <ADDRESS> --token <TOKEN_ADDRESS> --network mainnet

# Send ETH
npx hardhat send --to <ADDRESS> --amount <AMOUNT> --network mainnet
```

## Security Features

### Multi-Validator Consensus

Critical operations require confirmation from multiple validators:

1. Fee rate changes
2. Contract pausing/unpausing
3. Contract upgrades
4. Validator management
5. Parameter updates

### Timelock Mechanism

Security-critical operations require a waiting period:

1. Contract upgrades
2. Emergency pause

### Validator Accountability

Validators are monitored for participation:

1. Missed confirmations are tracked
2. Validators with too many missed confirmations can be slashed
3. Minimum validator count is enforced

### Reentrancy Protection

All state-changing operations are protected against reentrancy attacks.

## Contract Architecture

The contract follows a modular design pattern:

- **ErthaToken**: Main contract that inherits all functionality
- **Module Contracts**: Separate concerns into manageable pieces
- **Utility Libraries**: Reusable code for specific functions

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- [OpenZeppelin](https://openzeppelin.com/) for security-focused contract implementations
- [Hardhat](https://hardhat.org/) for the development environment