const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { 
  deployTokenSystem,
  createActionId,
  confirmAction,
  setupValidators,
  advanceTimeAndConfirm
} = require("../helpers/utils");
const {
  ONE_DAY,
  TIMELOCK_PERIOD
} = require("../helpers/constants");

describe("ErthaToken - Treasury Operations", function () {
  let token, proxyAddress, owner, teamWallet, stakingPool, treasuryWallet, user1, user2;
  
  before(async function () {
    // Deploy the token system
    const deployment = await deployTokenSystem();
    token = deployment.token;
    proxyAddress = deployment.proxyAddress;
    owner = deployment.owner;
    teamWallet = deployment.teamWallet;
    stakingPool = deployment.stakingPool;
    treasuryWallet = deployment.treasuryWallet;
    [user1, user2, ...others] = deployment.otherAccounts;
    
    // Add user1 as a validator
    const timestamp = await time.latest();
    const actionId = createActionId("addValidator", [user1.address], timestamp);
    await token.connect(owner).confirmAction(actionId);
    await token.connect(owner).addValidator(user1.address);
  });
  
  describe("Buyback and Burn", function () {
    it("Should only allow treasury wallet to initiate buyback and burn", async function () {
      // Non-treasury tries to buyback
      await expect(
        token.connect(user2).buybackAndBurn(ethers.utils.parseEther("1000"))
      ).to.be.revertedWith("Only treasury can perform buybacks");
    });
    
    it("Should require consensus for buyback and burn", async function () {
      const burnAmount = ethers.utils.parseEther("1000");
      
      // Get treasury balance and total supply before
      const treasuryBalanceBefore = await token.balanceOf(treasuryWallet.address);
      const totalSupplyBefore = await token.totalSupply();
      
      // Create action ID for consensus
      const timestamp = await time.latest();
      const actionId = createActionId("buybackAndBurn", [burnAmount], timestamp);
      
      // Treasury tries to burn without consensus
      await token.connect(treasuryWallet).buybackAndBurn(burnAmount);
      
      // Check that nothing was burned
      expect(await token.balanceOf(treasuryWallet.address)).to.equal(treasuryBalanceBefore);
      expect(await token.totalSupply()).to.equal(totalSupplyBefore);
      
      // Owner confirms action
      await token.connect(owner).confirmAction(actionId);
      
      // Validator 1 confirms action
      await token.connect(user1).confirmAction(actionId);
      
      // Treasury tries to burn again with consensus
      await token.connect(treasuryWallet).buybackAndBurn(burnAmount);
      
      // Check that tokens were burned
      expect(await token.balanceOf(treasuryWallet.address)).to.equal(treasuryBalanceBefore.sub(burnAmount));
      expect(await token.totalSupply()).to.equal(totalSupplyBefore.sub(burnAmount));
    });
  });
  
  describe("Emergency Pause", function () {
    it("Should allow pausing with consensus and timelock", async function () {
      // Create action ID for consensus
      const timestamp = await time.latest();
      const actionId = createActionId("pause", [], timestamp);
      
      // Try to pause - this should set the timelock
      await token.connect(owner).pause();
      
      // Check that the token is not paused yet
      expect(await token.paused()).to.be.false;
      
      // Try to pause immediately - should fail due to timelock
      await expect(
        token.connect(owner).pause()
      ).to.be.revertedWith("Timelock not expired");
      
      // Advance time past the timelock period
      await time.increase(TIMELOCK_PERIOD + 1);
      
      // Owner confirms
      await token.connect(owner).confirmAction(actionId);
      
      // Validator 1 confirms
      await token.connect(user1).confirmAction(actionId);
      
      // Try to pause again
      await token.connect(owner).pause();
      
      // Check that the token is now paused
      expect(await token.paused()).to.be.true;
    });
    
    it("Should prevent token transfers when paused", async function () {
      // Try to transfer while paused
      await expect(
        token.connect(user2).transfer(user1.address, ethers.utils.parseEther("10"))
      ).to.be.revertedWith("ERC20Pausable: token transfer while paused");
    });
    
    it("Should allow unpausing with consensus", async function () {
      // Create action ID for consensus
      const timestamp = await time.latest();
      const actionId = createActionId("unpause", [], timestamp);
      
      // Try to unpause without consensus
      await token.connect(owner).unpause();
      
      // Check that the token is still paused
      expect(await token.paused()).to.be.true;
      
      // Owner confirms
      await token.connect(owner).confirmAction(actionId);
      
      // Validator 1 confirms
      await token.connect(user1).confirmAction(actionId);
      
      // Try to unpause again
      await token.connect(owner).unpause();
      
      // Check that the token is now unpaused
      expect(await token.paused()).to.be.false;
    });
    
    it("Should allow transfers after unpausing", async function () {
      // Transfer some tokens to user2 for testing
      await token.connect(treasuryWallet).transfer(user2.address, ethers.utils.parseEther("100"));
      
      // Check balance before
      const balanceBefore = await token.balanceOf(user2.address);
      
      // Try to transfer after unpausing
      const transferAmount = ethers.utils.parseEther("10");
      await token.connect(user2).transfer(user1.address, transferAmount);
      
      // Check that the transfer went through (accounting for fees)
      expect(await token.balanceOf(user2.address)).to.be.lt(balanceBefore);
    });
  });
  
  describe("Treasury Management", function () {
    it("Should allow treasury to manage fund distribution", async function () {
      // Get initial balances
      const treasuryBalanceBefore = await token.balanceOf(treasuryWallet.address);
      const teamBalanceBefore = await token.balanceOf(teamWallet.address);
      
      // Treasury sends funds to team wallet
      const transferAmount = ethers.utils.parseEther("10000");
      await token.connect(treasuryWallet).transfer(teamWallet.address, transferAmount);
      
      // Check balances after
      const treasuryBalanceAfter = await token.balanceOf(treasuryWallet.address);
      const teamBalanceAfter = await token.balanceOf(teamWallet.address);
      
      // Treasury should have sent exactly transferAmount (treasury is fee exempt)
      expect(treasuryBalanceBefore.sub(treasuryBalanceAfter)).to.equal(transferAmount);
      
      // Team wallet should have received exactly transferAmount (no fees between exempt addresses)
      expect(teamBalanceAfter.sub(teamBalanceBefore)).to.equal(transferAmount);
    });
  });
});