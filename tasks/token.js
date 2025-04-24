const fs = require("fs");
const path = require("path");

task("token-info", "Displays information about the deployed token")
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
    
    console.log(`Getting information for token at ${contractAddress}...`);
    
    // Connect to the contract
    const token = await hre.ethers.getContractAt("ErthaToken", contractAddress);
    
    // Get basic token information
    const name = await token.name();
    const symbol = await token.symbol();
    const totalSupply = await token.totalSupply();
    const decimals = await token.decimals();
    
    console.log("======= Token Information =======");
    console.log(`Name: ${name}`);
    console.log(`Symbol: ${symbol}`);
    console.log(`Decimals: ${decimals}`);
    console.log(`Total Supply: ${hre.ethers.formatEther(totalSupply)} ${symbol}`);
    
    // Get fee information
    const teamFeeRate = await token.teamFeeRate();
    const stakingFeeRate = await token.stakingFeeRate();
    const burnFeeRate = await token.burnFeeRate();
    const performanceFeeRate = await token.performanceFeeRate();
    
    console.log("\n======= Fee Information =======");
    console.log(`Team Fee: ${teamFeeRate / 100}%`);
    console.log(`Staking Fee: ${stakingFeeRate / 100}%`);
    console.log(`Burn Fee: ${burnFeeRate / 100}%`);
    console.log(`Performance Fee: ${performanceFeeRate / 100}%`);
    
    // Get wallet addresses
    const teamWallet = await token.teamWallet();
    const stakingPool = await token.stakingPool();
    const treasuryWallet = await token.treasuryWallet();
    
    console.log("\n======= Wallet Information =======");
    console.log(`Team Wallet: ${teamWallet}`);
    console.log(`Staking Pool: ${stakingPool}`);
    console.log(`Treasury Wallet: ${treasuryWallet}`);
    
    // Get staking information
    const totalStaked = await token.totalStaked();
    const rewardRate = await token.rewardRate();
    
    console.log("\n======= Staking Information =======");
    console.log(`Total Staked: ${hre.ethers.formatEther(totalStaked)} ${symbol}`);
    console.log(`Reward Rate: ${hre.ethers.formatEther(rewardRate)} ${symbol}/day`);
    
    // Get validator information
    const validators = await token.getValidators();
    const requiredConfirmations = await token.requiredConfirmations();
    
    console.log("\n======= Validator Information =======");
    console.log(`Validators: ${validators.length}`);
    console.log(`Required Confirmations: ${requiredConfirmations}`);
    for (let i = 0; i < validators.length; i++) {
      console.log(`Validator ${i+1}: ${validators[i]}`);
    }
    
    // Check if the contract is paused
    const isPaused = await token.paused();
    console.log("\n======= Contract Status =======");
    console.log(`Paused: ${isPaused}`);
    
    // Save information to a file
    const info = {
      address: contractAddress,
      network: hre.network.name,
      chainId: (await hre.ethers.provider.getNetwork()).chainId,
      name,
      symbol,
      decimals: decimals.toString(),
      totalSupply: totalSupply.toString(),
      teamFeeRate: teamFeeRate.toString(),
      stakingFeeRate: stakingFeeRate.toString(),
      burnFeeRate: burnFeeRate.toString(),
      performanceFeeRate: performanceFeeRate.toString(),
      teamWallet,
      stakingPool,
      treasuryWallet,
      totalStaked: totalStaked.toString(),
      rewardRate: rewardRate.toString(),
      validators,
      requiredConfirmations: requiredConfirmations.toString(),
      isPaused,
      timestamp: new Date().toISOString()
    };
    
    const infoDir = path.join(__dirname, "../info");
    if (!fs.existsSync(infoDir)) {
      fs.mkdirSync(infoDir, { recursive: true });
    }
    
    const filename = path.join(infoDir, `token-info-${hre.network.name}.json`);
    fs.writeFileSync(filename, JSON.stringify(info, null, 2));
    
    console.log(`\nInformation saved to ${filename}`);
  });

task("token-transfer", "Transfers tokens to a recipient")
  .addParam("contract", "The address of the token contract")
  .addParam("to", "The recipient address")
  .addParam("amount", "The amount of tokens to transfer")
  .setAction(async (taskArgs, hre) => {
    const { contract, to, amount } = taskArgs;
    
    console.log(`Transferring ${amount} tokens to ${to}...`);
    
    // Connect to the contract
    const [signer] = await hre.ethers.getSigners();
    const token = await hre.ethers.getContractAt("ErthaToken", contract);
    
    // Check balances
    const balance = await token.balanceOf(signer.address);
    console.log(`Your balance: ${hre.ethers.formatEther(balance)} tokens`);
    
    const parsedAmount = hre.ethers.parseEther(amount);
    if (balance < parsedAmount) {
      throw new Error(`Insufficient balance. You have ${hre.ethers.formatEther(balance)} tokens, but trying to send ${amount}`);
    }
    
    // Transfer tokens
    const tx = await token.transfer(to, parsedAmount);
    console.log(`Transaction hash: ${tx.hash}`);
    await tx.wait();
    
    // Check new balances
    const newBalance = await token.balanceOf(signer.address);
    const recipientBalance = await token.balanceOf(to);
    
    console.log(`\nTransfer complete!`);
    console.log(`Your new balance: ${hre.ethers.formatEther(newBalance)} tokens`);
    console.log(`Recipient balance: ${hre.ethers.formatEther(recipientBalance)} tokens`);
  });

module.exports = {};