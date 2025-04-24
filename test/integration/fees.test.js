const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { 
  deployTokenSystem,
  createActionId,
  confirmAction,
  setupValidators,
  calculateFees
} = require("../helpers/utils");
const {
  TEAM_FEE_RATE,
  STAKING_FEE_RATE,
  BURN_FEE_RATE,
  BASIS_POINTS
} = require("../helpers/constants");

describe("ErthaToken - Fee Mechanism", function () {
  let token, proxyAddress, owner, teamWallet, stakingPool, treasuryWallet, user1, user2, user3;
  
  before(async function () {
    // Deploy the token system
    const deployment = await deployTokenSystem();
    token = deployment.token;
    proxyAddress = deployment.proxyAddress;
    owner = deployment.owner;
    teamWallet = deployment.teamWallet;
    stakingPool = deployment.stakingPool;
    treasuryWallet = deployment.treasuryWallet;
    [user1, user2, user3, ...others] = deployment.otherAccounts;
    
    // Transfer tokens to users for testing
    await token.connect(treasuryWallet).transfer(user1.address, ethers.utils.parseEther("10000"));
    await token.connect(treasuryWallet).transfer(user2.address, ethers.utils.parseEther("10000"));
    await token.connect(treasuryWallet).transfer(user3.address, ethers.utils.parseEther("10000"));
  });
  
  describe("Transaction Fees", function () {
    it("Should apply correct fee percentages for regular transfers", async function () {
      const transferAmount = ethers.utils.parseEther("1000");
      
      // Get initial balances
      const user1BalanceBefore = await token.balanceOf(user1.address);
      const user2BalanceBefore = await token.balanceOf(user2.address);
      const teamWalletBalanceBefore = await token.balanceOf(teamWallet.address);
      const stakingPoolBalanceBefore = await token.balanceOf(stakingPool.address);
      const totalSupplyBefore = await token.totalSupply();
      
      // Calculate expected fees
      const {
        teamFee,
        stakingFee,
        burnFee,
        totalFee,
        transferAmount: expectedTransferAmount
      } = calculateFees(
        transferAmount,
        TEAM_FEE_RATE,
        STAKING_FEE_RATE,
        BURN_FEE_RATE,
        BASIS_POINTS
      );
      
      // User1 transfers to User2
      await token.connect(user1).transfer(user2.address, transferAmount);
      
      // Get balances after transfer
      const user1BalanceAfter = await token.balanceOf(user1.address);
      const user2BalanceAfter = await token.balanceOf(user2.address);
      const teamWalletBalanceAfter = await token.balanceOf(teamWallet.address);
      const stakingPoolBalanceAfter = await token.balanceOf(stakingPool.address);
      const totalSupplyAfter = await token.totalSupply();
      
      // Check balances with calculated fees
      expect(user1BalanceBefore.sub(user1BalanceAfter)).to.equal(transferAmount);
      expect(user2BalanceAfter.sub(user2BalanceBefore)).to.equal(expectedTransferAmount);
      expect(teamWalletBalanceAfter.sub(teamWalletBalanceBefore)).to.equal(teamFee);
      expect(stakingPoolBalanceAfter.sub(stakingPoolBalanceBefore)).to.equal(stakingFee);
      expect(totalSupplyBefore.sub(totalSupplyAfter)).to.equal(burnFee);
    });
    
    it("Should not apply fees for exempt addresses", async function () {
      const transferAmount = ethers.utils.parseEther("1000");
      
      // Set fee exemption for user3
      const timestamp = await time.latest();
      const actionId = createActionId("setFeeExemption", [user3.address, true], timestamp);
      await token.connect(owner).confirmAction(actionId);
      await token.connect(owner).setFeeExemption(user3.address, true);
      
      // Check that user3 is exempt
      expect(await token.isExemptFromFee(user3.address)).to.be.true;
      
      // Get initial balances
      const user3BalanceBefore = await token.balanceOf(user3.address);
      const user2BalanceBefore = await token.balanceOf(user2.address);
      const teamWalletBalanceBefore = await token.balanceOf(teamWallet.address);
      const stakingPoolBalanceBefore = await token.balanceOf(stakingPool.address);
      const totalSupplyBefore = await token.totalSupply();
      
      // User3 transfers to User2
      await token.connect(user3).transfer(user2.address, transferAmount);
      
      // Get balances after transfer
      const user3BalanceAfter = await token.balanceOf(user3.address);
      const user2BalanceAfter = await token.balanceOf(user2.address);
      const teamWalletBalanceAfter = await token.balanceOf(teamWallet.address);
      const stakingPoolBalanceAfter = await token.balanceOf(stakingPool.address);
      const totalSupplyAfter = await token.totalSupply();
      
      // Check balances - no fees should be applied
      expect(user3BalanceBefore.sub(user3BalanceAfter)).to.equal(transferAmount);
      expect(user2BalanceAfter.sub(user2BalanceBefore)).to.equal(transferAmount);
      expect(teamWalletBalanceAfter).to.equal(teamWalletBalanceBefore);
      expect(stakingPoolBalanceAfter).to.equal(stakingPoolBalanceBefore);
      expect(totalSupplyAfter).to.equal(totalSupplyBefore);
      
      // Reset fee exemption for user3
      const timestamp2 = await time.latest();
      const actionId2 = createActionId("setFeeExemption", [user3.address, false], timestamp2);
      await token.connect(owner).confirmAction(actionId2);
      await token.connect(owner).setFeeExemption(user3.address, false);
    });
    
    it("Should not apply fees for transfers to/from exempt addresses", async function () {
      const transferAmount = ethers.utils.parseEther("1000");
      
      // Get initial balances
      const treasuryBalanceBefore = await token.balanceOf(treasuryWallet.address);
      const user1BalanceBefore = await token.balanceOf(user1.address);
      
      // Treasury wallet (exempt) transfers to User1
      await token.connect(treasuryWallet).transfer(user1.address, transferAmount);
      
      // Get balances after transfer
      const treasuryBalanceAfter = await token.balanceOf(treasuryWallet.address);
      const user1BalanceAfter = await token.balanceOf(user1.address);
      
      // Check balances - no fees should be applied
      expect(treasuryBalanceBefore.sub(treasuryBalanceAfter)).to.equal(transferAmount);
      expect(user1BalanceAfter.sub(user1BalanceBefore)).to.equal(transferAmount);
      
      // User1 transfers to Treasury wallet (exempt)
      const user1BalanceBefore2 = await token.balanceOf(user1.address);
      const treasuryBalanceBefore2 = await token.balanceOf(treasuryWallet.address);
      
      await token.connect(user1).transfer(treasuryWallet.address, transferAmount);
      
      // Get balances after transfer
      const user1BalanceAfter2 = await token.balanceOf(user1.address);
      const treasuryBalanceAfter2 = await token.balanceOf(treasuryWallet.address);
      
      // Check balances - no fees should be applied when transferring to exempt address
      expect(user1BalanceBefore2.sub(user1BalanceAfter2)).to.equal(transferAmount);
      expect(treasuryBalanceAfter2.sub(treasuryBalanceBefore2)).to.equal(transferAmount);
    });
  });
  
  describe("Fee Rate Management", function () {
    it("Should allow owner to update fee rates with consensus", async function () {
      const newTeamFeeRate = 150; // 1.5%
      const newStakingFeeRate = 150; // 1.5%
      const newBurnFeeRate = 100; // 1%
      
      // Create action ID for consensus
      const timestamp = await time.latest();
      const actionId = createActionId(
        "setFeeRates", 
        [newTeamFeeRate, newStakingFeeRate, newBurnFeeRate], 
        timestamp
      );
      
      // Owner confirms action
      await token.connect(owner).confirmAction(actionId);
      
      // Try to set fee rates
      await token.connect(owner).setFeeRates(newTeamFeeRate, newStakingFeeRate, newBurnFeeRate);
      
      // Check that fee rates were updated
      expect(await token.teamFeeRate()).to.equal(newTeamFeeRate);
      expect(await token.stakingFeeRate()).to.equal(newStakingFeeRate);
      expect(await token.burnFeeRate()).to.equal(newBurnFeeRate);
      expect(await token.transactionFeeRate()).to.equal(newTeamFeeRate + newStakingFeeRate + newBurnFeeRate);
      
      // Test with the new fee rates
      const transferAmount = ethers.utils.parseEther("1000");
      
      // Get initial balances
      const user2BalanceBefore = await token.balanceOf(user2.address);
      const user3BalanceBefore = await token.balanceOf(user3.address);
      const teamWalletBalanceBefore = await token.balanceOf(teamWallet.address);
      const stakingPoolBalanceBefore = await token.balanceOf(stakingPool.address);
      const totalSupplyBefore = await token.totalSupply();
      
      // Calculate expected fees with new rates
      const {
        teamFee,
        stakingFee,
        burnFee,
        totalFee,
        transferAmount: expectedTransferAmount
      } = calculateFees(
        transferAmount,
        newTeamFeeRate,
        newStakingFeeRate,
        newBurnFeeRate,
        BASIS_POINTS
      );
      
      // User2 transfers to User3
      await token.connect(user2).transfer(user3.address, transferAmount);
      
      // Get balances after transfer
      const user2BalanceAfter = await token.balanceOf(user2.address);
      const user3BalanceAfter = await token.balanceOf(user3.address);
      const teamWalletBalanceAfter = await token.balanceOf(teamWallet.address);
      const stakingPoolBalanceAfter = await token.balanceOf(stakingPool.address);
      const totalSupplyAfter = await token.totalSupply();
      
      // Check balances with new fee rates
      expect(user2BalanceBefore.sub(user2BalanceAfter)).to.equal(transferAmount);
      expect(user3BalanceAfter.sub(user3BalanceBefore)).to.equal(expectedTransferAmount);
      expect(teamWalletBalanceAfter.sub(teamWalletBalanceBefore)).to.equal(teamFee);
      expect(stakingPoolBalanceAfter.sub(stakingPoolBalanceBefore)).to.equal(stakingFee);
      expect(totalSupplyBefore.sub(totalSupplyAfter)).to.equal(burnFee);
      
      // Reset fee rates for other tests
      const resetTimestamp = await time.latest();
      const resetActionId = createActionId(
        "setFeeRates", 
        [TEAM_FEE_RATE, STAKING_FEE_RATE, BURN_FEE_RATE], 
        resetTimestamp
      );
      
      await token.connect(owner).confirmAction(resetActionId);
      await token.connect(owner).setFeeRates(TEAM_FEE_RATE, STAKING_FEE_RATE, BURN_FEE_RATE);
    });
    
    it("Should prevent setting total fee above 5%", async function () {
      const excessiveTeamFeeRate = 200; // 2%
      const excessiveStakingFeeRate = 200; // 2%
      const excessiveBurnFeeRate = 200; // 2%
      
      // Try to set total fee to 6% (above the 5% limit)
      await expect(
        token.connect(owner).setFeeRates(excessiveTeamFeeRate, excessiveStakingFeeRate, excessiveBurnFeeRate)
      ).to.be.revertedWith("Total fee cannot exceed 5%");
    });
  });
  
  describe("Fee Collection Events", function () {
    it("Should emit FeeCollected events when fees are collected", async function () {
      const transferAmount = ethers.utils.parseEther("1000");
      
      // Calculate expected fees
      const {
        teamFee,
        stakingFee,
        burnFee
      } = calculateFees(
        transferAmount,
        TEAM_FEE_RATE,
        STAKING_FEE_RATE,
        BURN_FEE_RATE,
        BASIS_POINTS
      );
      
      // User1 transfers to User2
      const tx = await token.connect(user1).transfer(user2.address, transferAmount);
      const receipt = await tx.wait();
      
      // Filter for fee events
      const feeEvents = receipt.events?.filter(e => e.event === 'FeeCollected');
      
      // Check for team fee event
      const teamFeeEvent = feeEvents?.find(e => e.args.to === teamWallet.address);
      expect(teamFeeEvent).to.not.be.undefined;
      expect(teamFeeEvent.args.amount).to.equal(teamFee);
      expect(teamFeeEvent.args.feeType).to.equal("TEAM_FEE");
      
      // Check for staking fee event
      const stakingFeeEvent = feeEvents?.find(e => e.args.to === stakingPool.address);
      expect(stakingFeeEvent).to.not.be.undefined;
      expect(stakingFeeEvent.args.amount).to.equal(stakingFee);
      expect(stakingFeeEvent.args.feeType).to.equal("STAKING_FEE");
      
      // Check for burn fee event
      const burnFeeEvent = feeEvents?.find(e => e.args.to === ethers.constants.AddressZero);
      expect(burnFeeEvent).to.not.be.undefined;
      expect(burnFeeEvent.args.amount).to.equal(burnFee);
      expect(burnFeeEvent.args.feeType).to.equal("BURN_FEE");
    });
  });
});