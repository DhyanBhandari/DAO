const fs = require("fs");
const path = require("path");

task("validators", "Display validators for the Erthaloka Token")
  .addOptionalParam("contract", "The address of the token contract")
  .setAction(async (taskArgs, hre) => {
    let contractAddress = taskArgs.contract;
    
    if (!contractAddress) {
      // Try to load from deployment file
      const networkName = hre.network.name;
      const deploymentDir = path.join(__dirname, "../deployments", networkName);
      const tokenFile = path.join(deploymentDir, "token.json");
      
      if (fs.existsSync(tokenFile)) {
        const tokenDeployment = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
        contractAddress = tokenDeployment.proxy;
      } else {
        throw new Error("Contract address not provided and deployment file not found");
      }
    }
    
    console.log(`Getting validators for token at ${contractAddress}...`);
    
    // Connect to the contract
    const token = await hre.ethers.getContractAt("ErthaToken", contractAddress);
    
    // Get validator information
    const validators = await token.getValidators();
    const requiredConfirmations = await token.requiredConfirmations();
    
    console.log("\n======= Validator Information =======");
    console.log(`Number of validators: ${validators.length}`);
    console.log(`Required confirmations: ${requiredConfirmations}`);
    
    console.log("\nValidator addresses:");
    for (let i = 0; i < validators.length; i++) {
      const missedConfirmations = await token.validatorMissedConfirmations(validators[i]);
      console.log(`[${i+1}] ${validators[i]} (Missed confirmations: ${missedConfirmations})`);
    }
  });

task("add-validator", "Add a new validator to the token contract")
  .addParam("contract", "The address of the token contract")
  .addParam("validator", "The address of the new validator")
  .setAction(async (taskArgs, hre) => {
    const { contract, validator } = taskArgs;
    
    console.log(`Adding validator ${validator} to contract ${contract}...`);
    
    // Connect to the contract
    const [signer] = await hre.ethers.getSigners();
    const token = await hre.ethers.getContractAt("ErthaToken", contract);
    
    // Check if the address is already a validator
    const isValidator = await token.isValidator(validator);
    if (isValidator) {
      console.log(`${validator} is already a validator`);
      return;
    }
    
    // Create action ID for consensus
    const timestamp = Math.floor(Date.now() / 1000);
    const actionId = hre.ethers.solidityPackedKeccak256(
      ["string", "address", "uint256"],
      ["addValidator", validator, timestamp]
    );
    
    console.log(`Action ID: ${actionId}`);
    
    // Confirm action
    console.log("Confirming action...");
    const confirmTx = await token.confirmAction(actionId);
    await confirmTx.wait();
    
    // Try to add validator
    console.log("Attempting to add validator...");
    const addTx = await token.addValidator(validator);
    const receipt = await addTx.wait();
    
    if (receipt.status === 1) {
      console.log(`Successfully initiated validator addition with hash: ${addTx.hash}`);
      console.log("Note: This action requires consensus from other validators");
      
      // Check if validator was added or if more confirmations are needed
      const isValidatorNow = await token.isValidator(validator);
      if (isValidatorNow) {
        console.log(`Validator ${validator} was successfully added!`);
      } else {
        console.log("Validator not added yet. More confirmations are needed.");
        
        const validators = await token.getValidators();
        const required = await token.requiredConfirmations();
        console.log(`Confirmations required: ${required} of ${validators.length} validators`);
      }
    } else {
      console.log("Transaction failed");
    }
  });

task("remove-validator", "Remove a validator from the token contract")
  .addParam("contract", "The address of the token contract")
  .addParam("validator", "The address of the validator to remove")
  .setAction(async (taskArgs, hre) => {
    const { contract, validator } = taskArgs;
    
    console.log(`Removing validator ${validator} from contract ${contract}...`);
    
    // Connect to the contract
    const [signer] = await hre.ethers.getSigners();
    const token = await hre.ethers.getContractAt("ErthaToken", contract);
    
    // Check if the address is a validator
    const isValidator = await token.isValidator(validator);
    if (!isValidator) {
      console.log(`${validator} is not a validator`);
      return;
    }
    
    // Create action ID for consensus
    const timestamp = Math.floor(Date.now() / 1000);
    const actionId = hre.ethers.solidityPackedKeccak256(
      ["string", "address", "uint256"],
      ["removeValidator", validator, timestamp]
    );
    
    console.log(`Action ID: ${actionId}`);
    
    // Confirm action
    console.log("Confirming action...");
    const confirmTx = await token.confirmAction(actionId);
    await confirmTx.wait();
    
    // Try to remove validator
    console.log("Attempting to remove validator...");
    const removeTx = await token.removeValidator(validator);
    const receipt = await removeTx.wait();
    
    if (receipt.status === 1) {
      console.log(`Successfully initiated validator removal with hash: ${removeTx.hash}`);
      console.log("Note: This action requires consensus from other validators");
      
      // Check if validator was removed or if more confirmations are needed
      const isValidatorNow = await token.isValidator(validator);
      if (!isValidatorNow) {
        console.log(`Validator ${validator} was successfully removed!`);
      } else {
        console.log("Validator not removed yet. More confirmations are needed.");
        
        const validators = await token.getValidators();
        const required = await token.requiredConfirmations();
        console.log(`Confirmations required: ${required} of ${validators.length} validators`);
      }
    } else {
      console.log("Transaction failed");
    }
  });

module.exports = {};