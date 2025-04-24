const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { parseEther } = ethers.utils;

describe("ErthaToken - Staking Functions", function () {
  let erthaToken;
  let owner, teamWallet, stakingPool, treasuryWallet, user1, user2;
  let proxyAddress;
  
  const ONE_DAY = 86400;
  const REWARD_RATE = parseEther("100"); // 100 tokens per day
  
  before(async function () {
    // Get signers
    [owner, teamWallet, stakingPool, treasuryWallet, user1, user2] = await ethers.getSigners();
    
    // Deploy implementation
    const ErthaToken = await ethers.getContractFactory("ErthaToken");
    const implementation = await ErthaToken.deploy(
      teamWallet.address,
      stakingPool.address,
      treasuryWallet.address
    );
    
    // Deploy factory
    const ErthaTokenFactory = await ethers.getContractFactory("ErthaTokenFactory");
    const factory = await ErthaTokenFactory.deploy();
    
    // Deploy token through factory
    const tx = await factory.deployErthaToken(
      teamWallet.address,
      stakingPool.address,
      treasuryWallet.address,
      owner.address
    );
    
    const receipt = await tx.wait();
    
    // Get proxy address from event
    const event = receipt.events
      .filter(e => e.event === 'ErthaTokenDeployed')
      .map(e => e.args)[0];
    
    proxyAddress = event.proxyAddress;
    
    // Connect to the proxy as ErthaToken
    erthaToken = ErthaToken.attach(proxyAddress);
  });
  
  describe("Staking Configuration", function () {
    it("Should have the correct initial reward rate", async function () {
      expect(await erthaToken.rewardRate()).to.equal(REWARD_RATE);
    });
    
    it("Should allow owner to update reward rate", async function () {
      const newRate = parseEther("150"); // 150 tokens per day
      
      // Get action hash for consensus
      const actionId = ethers.utils.solidityKeccak256(
        ["string", "uint256", "uint256"],
        ["setRewardRate", newRate, await time.latest()]
      );
      
      // Owner confirms action
      await erthaToken.confirmAction(actionId);
      
      // Update reward rate
      await erthaToken.setRewardRate(newRate);
      
      expect(await erthaToken.rewardRate()).to.equal(newRate);
      
      // Restore original rate for other tests
      const resetActionId = ethers.utils.solidityKeccak256(
        ["string", "uint256", "uint256"],
        ["setRewardRate", REWARD_RATE, await time.latest()]
      );
      
      await erthaToken.confirmAction(resetActionId);
      await erthaToken.setRewardRate(REWARD_RATE);
    });
  });
  
  describe("Staking Operations", function () {
    const stakeAmount = parseEther("1000");
    
    before(async function () {
      // Transfer tokens to user1 for staking
      await erthaToken.connect(treasuryWallet).transfer(
        user1.address,
        stakeAmount.mul(2)
      );
      
      // Set fee exemption for testing
      const actionId = ethers.utils.solidityKeccak256(
        ["string", "address", "bool", "uint256"],
        ["setFeeExemption", user1.address, true, await time.latest()]
      );
      
      await erthaToken.confirmAction(actionId);
      await erthaToken.setFeeExemption(user1.address, true);
    });
    
    it("Should allow users to stake tokens", async function () {
      // Approve tokens for staking
      await erthaToken.connect(user1).approve(
        proxyAddress,
        stakeAmount
      );
      
      // Stake tokens
      await erthaToken.connect(user1).stake(stakeAmount);
      
      // Check staking info
      const stakingInfo = await erthaToken.getStakingInfo(user1.address);
      expect(stakingInfo[0]).to.equal(stakeAmount); // amount
      expect(stakingInfo[1]).to.be.closeTo(await time.latest(), 5); // since (timestamp)
      expect(stakingInfo[2]).to.equal(0); // pendingRewards
      
      // Check total staked
      expect(await erthaToken.totalStaked()).to.equal(stakeAmount);
    });
    
    it("Should accumulate rewards over time", async function () {
      // Advance time by 1 day
      await time.increase(ONE_DAY);
      
      // Check pending rewards
      const stakingInfo = await erthaToken.getStakingInfo(user1.address);
      const pendingRewards = stakingInfo[2];
      
      // Since user1 is the only staker, they should get the full daily reward
      const expectedReward = REWARD_RATE;
      expect(pendingRewards).to.be.closeTo(expectedReward, parseEther("0.1"));
    });
    
    it("Should allow users to claim rewards", async function () {
      // Get balance before claiming
      const balanceBefore = await erthaToken.balanceOf(user1.address);
      
      // Claim rewards
      await erthaToken.connect(user1).claimRewards();
      
      // Get balance after claiming
      const balanceAfter = await erthaToken.balanceOf(user1.address);
      
      // Performance fee is 10%
      const expectedReward = REWARD_RATE.mul(90).div(100);
      
      expect(balanceAfter.sub(balanceBefore)).to.be.closeTo(expectedReward, parseEther("0.1"));
      
      // Check pending rewards are reset
      const stakingInfo = await erthaToken.getStakingInfo(user1.address);
      expect(stakingInfo[2]).to.equal(0);
    });
    
    it("Should allow users to withdraw staked tokens", async function () {
      // Get balance before withdrawal
      const balanceBefore = await erthaToken.balanceOf(user1.address);
      
      // Withdraw half of staked tokens
      const withdrawAmount = stakeAmount.div(2);
      await erthaToken.connect(user1).withdraw(withdrawAmount);
      
      // Get balance after withdrawal
      const balanceAfter = await erthaToken.balanceOf(user1.address);
      
      // Check balance increased by withdrawn amount
      expect(balanceAfter.sub(balanceBefore)).to.equal(withdrawAmount);
      
      // Check staking info updated
      const stakingInfo = await erthaToken.getStakingInfo(user1.address);
      expect(stakingInfo[0]).to.equal(stakeAmount.sub(withdrawAmount));
      
      // Check total staked updated
      expect(await erthaToken.totalStaked()).to.equal(stakeAmount.sub(withdrawAmount));
    });
    
    it("Should distribute rewards proportionally when multiple users stake", async function () {
      // Transfer tokens to user2
      await erthaToken.connect(treasuryWallet).transfer(
        user2.address,
        stakeAmount
      );
      
      // Set fee exemption for user2
      const actionId = ethers.utils.solidityKeccak256(
        ["string", "address", "bool", "uint256"],
        ["setFeeExemption", user2.address, true, await time.latest()]
      );
      
      await erthaToken.confirmAction(actionId);
      await erthaToken.setFeeExemption(user2.address, true);
      
      // User2 stakes tokens
      await erthaToken.connect(user2).approve(proxyAddress, stakeAmount);
      await erthaToken.connect(user2).stake(stakeAmount);
      
      // Now user1 has stakeAmount/2 and user2 has stakeAmount staked (1:2 ratio)
      const user1StakingInfo = await erthaToken.getStakingInfo(user1.address);
      const user2StakingInfo = await erthaToken.getStakingInfo(user2.address);
      
      expect(user1StakingInfo[0]).to.equal(stakeAmount.div(2));
      expect(user2StakingInfo[0]).to.equal(stakeAmount);
      
      // Advance time by 1 day
      await time.increase(ONE_DAY);
      
      // Check pending rewards
      const user1Rewards = (await erthaToken.getStakingInfo(user1.address))[2];
      const user2Rewards = (await erthaToken.getStakingInfo(user2.address))[2];
      
      // User1 should get 1/3 of the rewards, User2 should get 2/3
      const expectedUser1Reward = REWARD_RATE.mul(1).div(3);
      const expectedUser2Reward = REWARD_RATE.mul(2).div(3);
      
      expect(user1Rewards).to.be.closeTo(expectedUser1Reward, parseEther("0.01"));
      expect(user2Rewards).to.be.closeTo(expectedUser2Reward, parseEther("0.01"));
    });
  });
});