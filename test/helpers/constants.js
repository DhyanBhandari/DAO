const { ethers } = require("hardhat");

// Token constants
const TOKEN_NAME = "Erthaloka Token";
const TOKEN_SYMBOL = "ERTH";
const INITIAL_SUPPLY = ethers.utils.parseEther("3000000000"); // 3 billion tokens
const BASIS_POINTS = 10000; // 100% = 10000

// Fee constants
const TEAM_FEE_RATE = 100; // 1%
const STAKING_FEE_RATE = 100; // 1%
const BURN_FEE_RATE = 100; // 1%
const TRANSACTION_FEE_RATE = 300; // 3%
const PERFORMANCE_FEE_RATE = 1000; // 10%

// Staking constants
const REWARD_RATE = ethers.utils.parseEther("100"); // 100 tokens per day

// Time constants
const ONE_DAY = 86400;
const ONE_WEEK = ONE_DAY * 7;
const ONE_MONTH = ONE_DAY * 30;
const ONE_YEAR = ONE_DAY * 365;

// Governance constants
const PROPOSAL_FEE = ethers.utils.parseEther("10"); // 10 ERTH
const VOTING_FEE = ethers.utils.parseEther("1"); // 1 ERTH

// Validator constants
const REQUIRED_CONFIRMATIONS = 3;
const MAX_MISSED_CONFIRMATIONS = 10;

// Timelock constants
const TIMELOCK_PERIOD = ONE_DAY; // 1 day

// Vesting constants
const VESTING_DURATION = ONE_DAY * 730; // 2 years
const VESTING_CLIFF = ONE_DAY * 180; // 6 months

// Test specific constants
const LARGE_APPROVAL = ethers.utils.parseEther("100000000");
const ZERO_ADDRESS = ethers.constants.AddressZero;

module.exports = {
  TOKEN_NAME,
  TOKEN_SYMBOL,
  INITIAL_SUPPLY,
  BASIS_POINTS,
  TEAM_FEE_RATE,
  STAKING_FEE_RATE,
  BURN_FEE_RATE,
  TRANSACTION_FEE_RATE,
  PERFORMANCE_FEE_RATE,
  REWARD_RATE,
  ONE_DAY,
  ONE_WEEK,
  ONE_MONTH,
  ONE_YEAR,
  PROPOSAL_FEE,
  VOTING_FEE,
  REQUIRED_CONFIRMATIONS,
  MAX_MISSED_CONFIRMATIONS,
  TIMELOCK_PERIOD,
  VESTING_DURATION,
  VESTING_CLIFF,
  LARGE_APPROVAL,
  ZERO_ADDRESS
};