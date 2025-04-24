// Script to deploy the ErthaToken through the factory
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Starting ErthaToken deployment...");
  
  // Get environment variables or use defaults
  const teamWallet = process.env.TEAM_WALLET;
  const stakingPool = process.env.STAKING_POOL;
  const treasuryWallet = process.env.TREASURY_WALLET;
  
  if (!teamWallet || !stakingPool || !treasuryWallet) {
    throw new Error("Missing required environment variables. Check .env file.");
  }
  
  console.log(`Team Wallet: ${teamWallet}`);
  console.log(`Staking Pool: ${stakingPool}`);
  console.log(`Treasury Wallet: ${treasuryWallet}`);
  
  // Get network information
  const network = await ethers.provider.getNetwork();
  const networkName = network.name === "unknown" ? "localhost" : network.name;
  console.log(`Network: ${networkName} (${network.chainId})`);
  
  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer address: ${deployer.address}`);
  
  // Get factory deployment information
  const deploymentDir = path.join(__dirname, "../../deployments", networkName);
  const factoryFile = path.join(deploymentDir, "factory.json");
  
  if (!fs.existsSync(factoryFile)) {
    throw new Error(`Factory deployment file not found: ${factoryFile}`);
  }
  
  const factoryDeployment = JSON.parse(fs.readFileSync(factoryFile, 'utf8'));
  const factoryAddress = factoryDeployment.factory;
  
  console.log(`Using factory at: ${factoryAddress}`);
  
  // Connect to factory contract
  const factoryContract = await ethers.getContractAt("ErthaTokenFactory", factoryAddress);
  
  // Deploy token through factory
  console.log("Deploying ErthaToken through factory...");
  const tx = await factoryContract.deployErthaToken(
    teamWallet,
    stakingPool,
    treasuryWallet,
    deployer.address // Owner
  );
  
  console.log(`Transaction hash: ${tx.hash}`);
  console.log("Waiting for transaction confirmation...");
  
  const receipt = await tx.wait();
  
  // Get event from transaction receipt
  const deployEvent = receipt.logs
    .filter(log => {
      try {
        const decoded = factoryContract.interface.parseLog(log);
        return decoded && decoded.name === 'ErthaTokenDeployed';
      } catch (e) {
        return false;
      }
    })
    .map(log => factoryContract.interface.parseLog(log))[0];
  
  if (!deployEvent) {
    throw new Error("Failed to find ErthaTokenDeployed event in transaction receipt");
  }
  
  const proxyAddress = deployEvent.args.proxyAddress;
  const implementationAddress = deployEvent.args.implementationAddress;
  
  console.log(`ErthaToken proxy deployed to: ${proxyAddress}`);
  console.log(`ErthaToken implementation deployed to: ${implementationAddress}`);
  
  // Save token deployment information
  const tokenDeployment = {
    network: networkName,
    chainId: network.chainId,
    factory: factoryAddress,
    proxy: proxyAddress,
    implementation: implementationAddress,
    deployer: deployer.address,
    teamWallet,
    stakingPool,
    treasuryWallet,
    deploymentDate: new Date().toISOString()
  };
  
  fs.writeFileSync(
    path.join(deploymentDir, "token.json"),
    JSON.stringify(tokenDeployment, null, 2)
  );
  
  console.log(`Token deployment information saved to ${path.join(deploymentDir, "token.json")}`);
  console.log("ErthaToken deployment completed!");
  
  // Perform token verification
  console.log("\nToken contract details:");
  const tokenContract = await ethers.getContractAt("ErthaToken", proxyAddress);
  
  const name = await tokenContract.name();
  const symbol = await tokenContract.symbol();
  const totalSupply = await tokenContract.totalSupply();
  
  console.log(`Name: ${name}`);
  console.log(`Symbol: ${symbol}`);
  console.log(`Total Supply: ${ethers.formatEther(totalSupply)} ${symbol}`);
  console.log(`Team Wallet: ${await tokenContract.teamWallet()}`);
  console.log(`Staking Pool: ${await tokenContract.stakingPool()}`);
  console.log(`Treasury Wallet: ${await tokenContract.treasuryWallet()}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });