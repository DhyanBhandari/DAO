// Script for verifying contracts on Etherscan and other explorers
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const networkName = hre.network.name;
  console.log(`Verifying contracts on ${networkName}...`);
  
  // Load deployment information
  const deploymentDir = path.join(__dirname, "../../deployments", networkName);
  const factoryFile = path.join(deploymentDir, "factory.json");
  const tokenFile = path.join(deploymentDir, "token.json");
  
  if (!fs.existsSync(factoryFile) || !fs.existsSync(tokenFile)) {
    throw new Error(`Deployment files not found in ${deploymentDir}`);
  }
  
  const factoryDeployment = JSON.parse(fs.readFileSync(factoryFile, 'utf8'));
  const tokenDeployment = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
  
  // Verify factory contract
  console.log(`\nVerifying factory contract at ${factoryDeployment.factory}...`);
  try {
    await hre.run("verify:verify", {
      address: factoryDeployment.factory,
      constructorArguments: []
    });
    console.log("Factory contract verified successfully");
  } catch (error) {
    console.log(`Error verifying factory contract: ${error.message}`);
  }
  
  // Verify implementation contract
  console.log(`\nVerifying implementation contract at ${tokenDeployment.implementation}...`);
  try {
    await hre.run("verify:verify", {
      address: tokenDeployment.implementation,
      constructorArguments: [
        tokenDeployment.teamWallet,
        tokenDeployment.stakingPool,
        tokenDeployment.treasuryWallet
      ]
    });
    console.log("Implementation contract verified successfully");
  } catch (error) {
    console.log(`Error verifying implementation contract: ${error.message}`);
  }
  
  // Note about proxy contract
  console.log(`\nProxy contract is at ${tokenDeployment.proxy}`);
  console.log("Note: Proxy contracts cannot be directly verified as they use the implementation's bytecode.");
  console.log("Some block explorers support proxy verification through their UI.");
  
  console.log("\nVerification process completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });