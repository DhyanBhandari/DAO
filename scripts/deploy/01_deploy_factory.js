// Script to deploy the ErthaTokenFactory contract
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Starting ErthaTokenFactory deployment...");
  
  // Get network information
  const network = await ethers.provider.getNetwork();
  const networkName = network.name === "unknown" ? "localhost" : network.name;
  console.log(`Network: ${networkName} (${network.chainId})`);
  
  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer address: ${deployer.address}`);
  console.log(`Deployer balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
  
  // Deploy factory contract
  console.log("Deploying ErthaTokenFactory...");
  const ErthaTokenFactory = await ethers.getContractFactory("ErthaTokenFactory");
  const factory = await ErthaTokenFactory.deploy();
  await factory.waitForDeployment();
  
  const factoryAddress = await factory.getAddress();
  console.log(`ErthaTokenFactory deployed to: ${factoryAddress}`);
  
  // Save deployment information
  const deploymentDir = path.join(__dirname, "../../deployments", networkName);
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir, { recursive: true });
  }
  
  // Save factory address to deployment file
  const deploymentInfo = {
    network: networkName,
    chainId: network.chainId,
    factory: factoryAddress,
    deployer: deployer.address,
    deploymentDate: new Date().toISOString()
  };
  
  fs.writeFileSync(
    path.join(deploymentDir, "factory.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log(`Deployment information saved to ${path.join(deploymentDir, "factory.json")}`);
  console.log("ErthaTokenFactory deployment completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });