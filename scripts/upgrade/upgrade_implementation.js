// Script to upgrade the ErthaToken implementation
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Starting ErthaToken implementation upgrade...");
  
  // Get network information
  const network = await ethers.provider.getNetwork();
  const networkName = network.name === "unknown" ? "localhost" : network.name;
  console.log(`Network: ${networkName} (${network.chainId})`);
  
  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer address: ${deployer.address}`);
  
  // Get token deployment information
  const deploymentDir = path.join(__dirname, "../../deployments", networkName);
  const tokenFile = path.join(deploymentDir, "token.json");
  
  if (!fs.existsSync(tokenFile)) {
    throw new Error(`Token deployment file not found: ${tokenFile}`);
  }
  
  const tokenDeployment = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
  const proxyAddress = tokenDeployment.proxy;
  const oldImplementation = tokenDeployment.implementation;
  const teamWallet = tokenDeployment.teamWallet;
  const stakingPool = tokenDeployment.stakingPool;
  const treasuryWallet = tokenDeployment.treasuryWallet;
  
  console.log(`Proxy address: ${proxyAddress}`);
  console.log(`Old implementation: ${oldImplementation}`);
  console.log(`Using parameters:`);
  console.log(`- Team Wallet: ${teamWallet}`);
  console.log(`- Staking Pool: ${stakingPool}`);
  console.log(`- Treasury Wallet: ${treasuryWallet}`);
  
  // Connect to proxy as ErthaToken
  const token = await ethers.getContractAt("ErthaToken", proxyAddress);
  
  // Check if deployer is a validator
  const validators = await token.getValidators();
  if (!validators.includes(deployer.address)) {
    throw new Error(`Deployer ${deployer.address} is not a validator and cannot upgrade the contract`);
  }
  
  // Deploy new implementation
  console.log("Deploying new implementation contract...");
  const ErthaToken = await ethers.getContractFactory("ErthaToken");
  const newImplementation = await ErthaToken.deploy(
    teamWallet,
    stakingPool,
    treasuryWallet
  );
  await newImplementation.waitForDeployment();
  
  const newImplementationAddress = await newImplementation.getAddress();
  console.log(`New implementation deployed to: ${newImplementationAddress}`);
  
  // Create action ID for consensus
  const timestamp = Math.floor(Date.now() / 1000);
  const actionId = ethers.solidityPackedKeccak256(
    ["string", "address", "uint256"],
    ["upgrade", newImplementationAddress, timestamp]
  );
  
  console.log(`Action ID: ${actionId}`);
  
  // Confirm action as validator
  console.log("Confirming action as validator...");
  const confirmTx = await token.confirmAction(actionId);
  await confirmTx.wait();
  console.log(`Confirmation transaction: ${confirmTx.hash}`);
  
  // Need to wait for timelock period and other validators to confirm
  console.log("\nIMPORTANT: The upgrade is now pending.");
  console.log("1. Wait for the timelock period to expire");
  console.log("2. Ensure enough validators confirm the action");
  console.log("3. Run the final upgrade transaction after confirmations and timelock");
  
  console.log(`\nTo complete the upgrade, run the following command after timelock expires:`);
  console.log(`npx hardhat run scripts/upgrade/finalize_upgrade.js --network ${networkName}`);
  
  // Save upgrade information
  const upgradeInfo = {
    network: networkName,
    chainId: network.chainId,
    proxy: proxyAddress,
    oldImplementation: oldImplementation,
    newImplementation: newImplementationAddress,
    actionId: actionId,
    timestamp: timestamp,
    initiator: deployer.address,
    status: 'pending',
    upgradeDate: new Date().toISOString()
  };
  
  fs.writeFileSync(
    path.join(deploymentDir, "upgrade.json"),
    JSON.stringify(upgradeInfo, null, 2)
  );
  
  console.log(`Upgrade information saved to ${path.join(deploymentDir, "upgrade.json")}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });