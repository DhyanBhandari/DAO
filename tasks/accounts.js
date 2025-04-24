task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
    const accounts = await hre.ethers.getSigners();
    
    console.log("Accounts:");
    for (const account of accounts) {
      console.log(`${account.address}`);
      
      // Get balance
      const balance = await hre.ethers.provider.getBalance(account.address);
      console.log(`Balance: ${hre.ethers.formatEther(balance)} ETH`);
      console.log("---");
    }
  });
  
  task("balance", "Prints an account's balance")
    .addParam("account", "The account's address")
    .addOptionalParam("token", "The token contract address", "")
    .setAction(async (taskArgs, hre) => {
      const account = taskArgs.account;
      const tokenAddress = taskArgs.token;
      
      // Get ETH balance
      const ethBalance = await hre.ethers.provider.getBalance(account);
      console.log(`ETH Balance: ${hre.ethers.formatEther(ethBalance)} ETH`);
      
      // If token address provided, get token balance
      if (tokenAddress && tokenAddress !== "") {
        try {
          const tokenContract = await hre.ethers.getContractAt("ERC20", tokenAddress);
          const tokenBalance = await tokenContract.balanceOf(account);
          const symbol = await tokenContract.symbol();
          const decimals = await tokenContract.decimals();
          
          console.log(`${symbol} Balance: ${hre.ethers.formatUnits(tokenBalance, decimals)} ${symbol}`);
        } catch (error) {
          console.error(`Error getting token balance: ${error.message}`);
        }
      }
    });
  
  task("send", "Send ETH to an address")
    .addParam("to", "The recipient address")
    .addParam("amount", "Amount of ETH to send")
    .setAction(async (taskArgs, hre) => {
      const [sender] = await hre.ethers.getSigners();
      const recipientAddress = taskArgs.to;
      const amountEth = parseFloat(taskArgs.amount);
      
      console.log(`Sending ${amountEth} ETH from ${sender.address} to ${recipientAddress}`);
      
      const senderBalanceBefore = await hre.ethers.provider.getBalance(sender.address);
      const recipientBalanceBefore = await hre.ethers.provider.getBalance(recipientAddress);
      
      console.log(`Sender balance before: ${hre.ethers.formatEther(senderBalanceBefore)} ETH`);
      console.log(`Recipient balance before: ${hre.ethers.formatEther(recipientBalanceBefore)} ETH`);
      
      // Send transaction
      const tx = await sender.sendTransaction({
        to: recipientAddress,
        value: hre.ethers.parseEther(amountEth.toString())
      });
      
      console.log(`Transaction hash: ${tx.hash}`);
      console.log("Waiting for confirmation...");
      
      await tx.wait();
      
      const senderBalanceAfter = await hre.ethers.provider.getBalance(sender.address);
      const recipientBalanceAfter = await hre.ethers.provider.getBalance(recipientAddress);
      
      console.log(`Sender balance after: ${hre.ethers.formatEther(senderBalanceAfter)} ETH`);
      console.log(`Recipient balance after: ${hre.ethers.formatEther(recipientBalanceAfter)} ETH`);
      
      const senderDiff = senderBalanceBefore - senderBalanceAfter;
      const recipientDiff = recipientBalanceAfter - recipientBalanceBefore;
      
      console.log(`Sender spent: ${hre.ethers.formatEther(senderDiff)} ETH (includes gas)`);
      console.log(`Recipient received: ${hre.ethers.formatEther(recipientDiff)} ETH`);
    });
  
  task("import-account", "Import a private key as a signer")
    .addParam("privateKey", "The private key to import")
    .setAction(async (taskArgs, hre) => {
      try {
        const privateKey = taskArgs.privateKey;
        
        if (!privateKey.startsWith("0x")) {
          throw new Error("Private key must be a hexadecimal string starting with 0x");
        }
        
        // Create wallet from private key
        const wallet = new hre.ethers.Wallet(privateKey, hre.ethers.provider);
        
        console.log(`Account imported: ${wallet.address}`);
        
        // Get balance
        const ethBalance = await hre.ethers.provider.getBalance(wallet.address);
        console.log(`ETH Balance: ${hre.ethers.formatEther(ethBalance)} ETH`);
        
        // Save to .env file
        console.log("\nTo use this account in your .env file, add the following line:");
        console.log(`PRIVATE_KEY=${privateKey}`);
      } catch (error) {
        console.error(`Error importing private key: ${error.message}`);
      }
    });
  
  module.exports = {};