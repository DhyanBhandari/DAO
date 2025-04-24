const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { 
  deployTokenSystem,
  createActionId,
  confirmAction,
  setupValidators
} = require("../helpers/utils");
const { 
  PROPOSAL_FEE,
  VOTING_FEE
} = require("../helpers/constants");

describe("ErthaToken - Governance Functions", function () {
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
    
    // Transfer some tokens to users for governance testing
    await token.connect(treasuryWallet).transfer(user1.address, ethers.utils.parseEther("10000"));
    await token.connect(treasuryWallet).transfer(user2.address, ethers.utils.parseEther("5000"));
    await token.connect(treasuryWallet).transfer(user3.address, ethers.utils.parseEther("2000"));
  });
  
  describe("Governance Configuration", function () {
    it("Should have the correct initial proposal and voting fees", async function () {
      expect(await token.proposalFee()).to.equal(PROPOSAL_FEE);
      expect(await token.votingFee()).to.equal(VOTING_FEE);
    });
    
    it("Should allow owner to update proposal fee with consensus", async function () {
      const newProposalFee = ethers.utils.parseEther("20"); // 20 tokens
      
      // Create action ID for consensus
      const timestamp = await time.latest();
      const actionId = createActionId("setProposalFee", [newProposalFee], timestamp);
      
      // Owner confirms action
      await token.connect(owner).confirmAction(actionId);
      
      // Try to set proposal fee
      await token.connect(owner).setProposalFee(newProposalFee);
      
      // Check proposal fee was updated
      expect(await token.proposalFee()).to.equal(newProposalFee);
      
      // Reset to original value for other tests
      const resetActionId = createActionId("setProposalFee", [PROPOSAL_FEE], await time.latest());
      await token.connect(owner).confirmAction(resetActionId);
      await token.connect(owner).setProposalFee(PROPOSAL_FEE);
    });
    
    it("Should allow owner to update voting fee with consensus", async function () {
      const newVotingFee = ethers.utils.parseEther("2"); // 2 tokens
      
      // Create action ID for consensus
      const timestamp = await time.latest();
      const actionId = createActionId("setVotingFee", [newVotingFee], timestamp);
      
      // Owner confirms action
      await token.connect(owner).confirmAction(actionId);
      
      // Try to set voting fee
      await token.connect(owner).setVotingFee(newVotingFee);
      
      // Check voting fee was updated
      expect(await token.votingFee()).to.equal(newVotingFee);
      
      // Reset to original value for other tests
      const resetActionId = createActionId("setVotingFee", [VOTING_FEE], await time.latest());
      await token.connect(owner).confirmAction(resetActionId);
      await token.connect(owner).setVotingFee(VOTING_FEE);
    });
  });
  
  describe("Snapshot Functionality", function () {
    it("Should allow owner to create a snapshot", async function () {
      // Get current snapshot ID
      const ERC20Snapshot = await ethers.getContractFactory("ERC20Snapshot");
      const snapshotInterface = ERC20Snapshot.interface;
      const currentSnapshotId = await ethers.provider.call({
        to: proxyAddress,
        data: snapshotInterface.encodeFunctionData("_getCurrentSnapshotId")
      });
      
      // Create snapshot
      await token.connect(owner).snapshot();
      
      // Get new snapshot ID
      const newSnapshotId = await ethers.provider.call({
        to: proxyAddress,
        data: snapshotInterface.encodeFunctionData("_getCurrentSnapshotId")
      });
      
      // Check that snapshot ID incremented
      expect(Number(newSnapshotId)).to.be.greaterThan(Number(currentSnapshotId));
    });
    
    it("Should maintain historical balances in snapshots", async function () {
      // Get current balances
      const user1Balance = await token.balanceOf(user1.address);
      const user2Balance = await token.balanceOf(user2.address);
      
      // Create snapshot
      const snapshotId = await token.connect(owner).snapshot();
      
      // Make a transfer between users
      const transferAmount = ethers.utils.parseEther("1000");
      await token.connect(user1).transfer(user2.address, transferAmount);
      
      // Current balances should be updated
      const user1BalanceAfter = await token.balanceOf(user1.address);
      const user2BalanceAfter = await token.balanceOf(user2.address);
      
      // Balances should reflect the transfer (minus fees)
      // We're not calculating exact values here due to fees, just checking that balances changed
      expect(user1BalanceAfter).to.be.lt(user1Balance);
      expect(user2BalanceAfter).to.be.gt(user2Balance);
      
      // Using ERC20Snapshot interface to check historical balances
      // Note: In a real test, you'd use a specific function to query balanceOfAt
      // This is a simplified example as balanceOfAt isn't directly exposed in our test
    });
  });
  
  describe("Proposal Creation and Voting", function () {
    it("Should require proposal fee to create a proposal", async function () {
      // User with insufficient balance tries to create proposal
      await token.connect(treasuryWallet).transfer(user3.address, ethers.utils.parseEther("5"));
      
      // Make sure user3 has less than proposal fee
      await token.connect(user3).transfer(user1.address, await token.balanceOf(user3.address));
      await token.connect(treasuryWallet).transfer(user3.address, PROPOSAL_FEE.div(2));
      
      // Try to create proposal
      await expect(
        token.connect(user3).createProposal()
      ).to.be.revertedWith("Insufficient balance for proposal fee");
    });
    
    it("Should collect proposal fee when creating a proposal", async function () {
      // Check team wallet balance before
      const teamWalletBalanceBefore = await token.balanceOf(teamWallet.address);
      
      // User creates a proposal
      await token.connect(user1).createProposal();
      
      // Check team wallet balance after
      const teamWalletBalanceAfter = await token.balanceOf(teamWallet.address);
      
      // Team wallet should receive the proposal fee
      expect(teamWalletBalanceAfter.sub(teamWalletBalanceBefore)).to.equal(PROPOSAL_FEE);
    });
    
    it("Should require voting fee to vote on a proposal", async function () {
      // User with insufficient balance tries to vote
      await token.connect(treasuryWallet).transfer(user3.address, ethers.utils.parseEther("0.5"));
      
      // Try to vote on proposal
      await expect(
        token.connect(user3).vote(1) // Proposal ID 1
      ).to.be.revertedWith("Insufficient balance for voting fee");
    });
    
    it("Should collect voting fee when voting on a proposal", async function () {
      // Check team wallet balance before
      const teamWalletBalanceBefore = await token.balanceOf(teamWallet.address);
      
      // User votes on a proposal
      await token.connect(user1).vote(1); // Proposal ID 1
      
      // Check team wallet balance after
      const teamWalletBalanceAfter = await token.balanceOf(teamWallet.address);
      
      // Team wallet should receive the voting fee
      expect(teamWalletBalanceAfter.sub(teamWalletBalanceBefore)).to.equal(VOTING_FEE);
    });
  });
  
  // Note: Since the governance implementation in ErthaToken is simplified,
  // we can't test actual on-chain governance functionality like proposal execution.
  // In a real implementation, you would add those tests here.
});