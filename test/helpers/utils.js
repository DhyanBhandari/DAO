const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

// Deploy the complete token system for testing
async function deployTokenSystem() {
  const [owner, teamWallet, stakingPool, treasuryWallet, ...otherAccounts] = await ethers.getSigners();
  
  // Deploy implementation
  const ErthaToken = await ethers.getContractFactory("ErthaToken");
  const implementation = await ErthaToken.deploy(
    teamWallet.address,
    stakingPool.address,
    treasuryWallet.address
  );
  
  // Deploy factory
  const ErthaTokenFactory = await ethers.getContractFactory("ErthaTokenFactory");
  const factory = await ErthaTokenFactory.deploy();
  
  // Deploy token through factory
  const tx = await factory.deployErthaToken(
    teamWallet.address,
    stakingPool.address,
    treasuryWallet.address,
    owner.address
  );
  
  const receipt = await tx.wait();
  
  // Get proxy address from event
  const event = receipt.events
    .filter(e => e.event === 'ErthaTokenDeployed')
    .map(e => e.args)[0];
  
  const proxyAddress = event.proxyAddress;
  
  // Connect to the proxy as ErthaToken
  const token = ErthaToken.attach(proxyAddress);
  
  return {
    token,
    factory,
    implementation,
    proxyAddress,
    owner,
    teamWallet,
    stakingPool,
    treasuryWallet,
    otherAccounts
  };
}

// Create an action ID for consensus
function createActionId(functionName, params = [], timestamp = null) {
  if (!timestamp) {
    timestamp = Math.floor(Date.now() / 1000);
  }
  
  const encodedParams = [functionName, ...params, timestamp];
  const types = ["string"];
  
  // Determine parameter types
  params.forEach(param => {
    if (ethers.utils.isAddress(param)) {
      types.push("address");
    } else if (typeof param === "number" || typeof param === "bigint" || 
               ethers.BigNumber.isBigNumber(param)) {
      types.push("uint256");
    } else if (typeof param === "boolean") {
      types.push("bool");
    } else {
      types.push("string");
    }
  });
  
  types.push("uint256"); // for timestamp
  
  return ethers.utils.solidityKeccak256(types, encodedParams);
}

// Confirm an action by multiple validators
async function confirmAction(token, actionId, validators) {
  for (const validator of validators) {
    await token.connect(validator).confirmAction(actionId);
  }
  
  return true;
}

// Advance time and confirm an action that requires timelock
async function advanceTimeAndConfirm(token, actionId, validators, timeToAdvance) {
  // Advance time
  await time.increase(timeToAdvance);
  
  // Confirm action
  await confirmAction(token, actionId, validators);
  
  return true;
}

// Set up multiple validators
async function setupValidators(token, owner, validators) {
  for (const validator of validators) {
    const timestamp = await time.latest();
    const actionId = createActionId("addValidator", [validator.address], timestamp);
    
    await token.connect(owner).confirmAction(actionId);
    await token.connect(owner).addValidator(validator.address);
  }
  
  return true;
}

// Set up fee exemptions for testing
async function setupFeeExemptions(token, owner, addresses) {
  for (const address of addresses) {
    const timestamp = await time.latest();
    const actionId = createActionId("setFeeExemption", [address, true], timestamp);
    
    await token.connect(owner).confirmAction(actionId);
    await token.connect(owner).setFeeExemption(address, true);
  }
  
  return true;
}

// Calculate expected fees
function calculateFees(amount, teamFeeRate, stakingFeeRate, burnFeeRate, basisPoints = 10000) {
  const teamFee = amount.mul(teamFeeRate).add(basisPoints / 2).div(basisPoints);
  const stakingFee = amount.mul(stakingFeeRate).add(basisPoints / 2).div(basisPoints);
  const burnFee = amount.mul(burnFeeRate).add(basisPoints / 2).div(basisPoints);
  const totalFee = teamFee.add(stakingFee).add(burnFee);
  const transferAmount = amount.sub(totalFee);
  
  return {
    teamFee,
    stakingFee,
    burnFee,
    totalFee,
    transferAmount
  };
}

module.exports = {
  deployTokenSystem,
  createActionId,
  confirmAction,
  advanceTimeAndConfirm,
  setupValidators,
  setupFeeExemptions,
  calculateFees
};