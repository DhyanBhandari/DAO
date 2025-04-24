# Erthaloka Token - Deployment Guide

This guide provides step-by-step instructions for deploying the Erthaloka Token (ERTH) to various networks.

## Prerequisites

Before deploying, ensure you have:

1. **Wallet with ETH**: For transaction fees
2. **Team Wallet**: Address that will receive team fees
3. **Staking Pool**: Address that will hold staking rewards
4. **Treasury Wallet**: Address that will manage treasury operations
5. **Private Key**: For deploying contracts
6. **API Keys**: For network providers and block explorers

## Environment Setup

1. Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

2. Edit the `.env` file with your specific values:

```
# Deployment private key
PRIVATE_KEY=0x123...

# Contract addresses
TEAM_WALLET=0x456...
STAKING_POOL=0x789...
TREASURY_WALLET=0xabc...

# API Keys
ETHERSCAN_API_KEY=ABC123...
INFURA_API_KEY=xyz...
ALCHEMY_API_KEY=123...
```

## Deployment Process

The deployment process consists of two steps:

1. Deploy the ErthaTokenFactory contract
2. Deploy the ErthaToken through the factory

### Local Deployment (Development)

To deploy to a local Hardhat network:

```bash
# Start a local node
npx hardhat node

# Deploy the contracts
npx hardhat run scripts/deploy/01_deploy_factory.js --network localhost
npx hardhat run scripts/deploy/02_deploy_token.js --network localhost
```

### Testnet Deployment

To deploy to Sepolia testnet:

```bash
npm run deploy:testnet
```

This runs both deployment scripts in sequence with the correct network configuration.

### Mainnet Deployment

To deploy to Ethereum mainnet:

```bash
npm run deploy:mainnet
```

Ensure your wallet has sufficient ETH for gas fees before deploying to mainnet.

## Contract Verification

After deployment, verify the contracts on the block explorer:

```bash
# Verify on testnet
npm run verify:testnet

# Verify on mainnet
npm run verify:mainnet
```

The verification script will:

1. Verify the factory contract
2. Verify the implementation contract
3. Provide information about the proxy contract

## Post-Deployment Setup

After deploying the contracts, perform these steps:

### 1. Add Validators

Add additional validators to ensure decentralized management:

```bash
npx hardhat add-validator --contract <TOKEN_ADDRESS> --validator <VALIDATOR_ADDRESS> --network <NETWORK>
```

Repeat this for each validator you want to add.

### 2. Set Required Confirmations

Set the number of confirmations required for consensus:

```bash
# Create actionId
npx hardhat run scripts/management/set-required-confirmations.js --network <NETWORK>
```

### 3. Configure Fee Exemptions

Add fee exemptions for key addresses if needed:

```bash
npx hardhat run scripts/management/set-fee-exemption.js --address <ADDRESS> --exempt true --network <NETWORK>
```

### 4. Verify Contract Operation

Verify the contract is operating correctly:

```bash
npx hardhat token-info --network <NETWORK>
```

## Proxy Upgradeability

The UUPS proxy pattern enables future upgrades:

### Preparing an Upgrade

1. Deploy a new implementation contract
2. Set a timelock for the upgrade
3. Get validator confirmations for the action
4. After the timelock period, execute the upgrade

### Deployment Commands

```bash
# Deploy new implementation and initiate upgrade
npx hardhat run scripts/upgrade/upgrade_implementation.js --network <NETWORK>

# After timelock and confirmations, execute upgrade
npx hardhat run scripts/upgrade/finalize_upgrade.js --network <NETWORK>
```

## Deployment Addresses

Store deployment addresses in organized files:

1. **Factory**: `deployments/<network>/factory.json`
2. **Token**: `deployments/<network>/token.json`
3. **Upgrades**: `deployments/<network>/upgrade.json`

## Common Issues and Solutions

### Transaction Reverted

If a deployment transaction reverts, check:

1. **Gas Limit**: Increase gas limit for complex contracts
2. **Constructor Arguments**: Verify all arguments are correct
3. **Nonce Issues**: Reset nonce if out of sync

### Verification Failed

If contract verification fails:

1. **Compiler Version**: Ensure correct Solidity version
2. **Optimization Settings**: Match compiler optimization settings
3. **Constructor Arguments**: Verify arguments format
4. **Flattening**: Try with flattened contract if needed

### Proxy Issues

If proxy deployment or upgrading fails:

1. **Implementation**: Verify implementation is compatible
2. **Initialization**: Check initialization function is called properly
3. **Storage Layout**: Ensure storage layout is preserved in upgrades

## Network Specifics

### Ethereum Mainnet

- Gas prices fluctuate significantly
- Consider using gas price oracles
- Timelock should be at least 24 hours

### Polygon

- Lower gas fees but higher transaction volume
- Consider higher gas limit
- Shorter timelock periods may be acceptable

### BSC

- Very low gas fees
- Higher risk of front-running
- Consider additional security measures

## Multi-Chain Deployment

For deploying to multiple chains:

1. Use the same deployment scripts but different networks
2. Maintain separate deployment files per chain
3. Consider chain-specific optimizations