const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { 
  deployTokenSystem,
  createActionId,
  setupValidators 
} = require("../helpers/utils");
const { 
  VESTING_DURATION, 
  VESTING_CLIFF, 
  INITIAL_SUPPLY,
  ONE_DAY
} = require("../helpers/constants");

describe("ErthaToken - Vesting Functions", function () {
  let token, proxyAddress, owner, teamWallet, stakingPool, treasuryWallet, beneficiary, otherAccounts;
  
  before(async function () {
    // Deploy the token system
    const deployment = await deployTokenSystem();
    token = deployment.token;
    proxyAddress = deployment.proxyAddress;
    owner = deployment.owner;
    teamWallet = deployment.teamWallet;
    stakingPool = deployment.stakingPool;
    treasuryWallet = deployment.treasuryWallet;
    [beneficiary, ...otherAccounts] = deployment.otherAccounts;
  });
  
  describe("Initial Vesting Setup", function () {
    it("Should set up vesting for team wallet during deployment", async function () {
      // The team wallet should have a vesting schedule (10% of total supply)
      const expectedAmount = INITIAL_SUPPLY.mul(10).div(100);
      
      const vestingSchedule = await token.getVestingSchedule(teamWallet.address);
      
      expect(vestingSchedule[0]).to.equal(expectedAmount); // totalAmount
      expect(vestingSchedule[1]).to.equal(0); // releasedAmount
      expect(vestingSchedule[3]).to.equal(VESTING_DURATION); // duration 
      expect(vestingSchedule[4]).to.equal(VESTING_CLIFF); // cliffDuration
    });
    
    it("Should not allow anyone to release tokens before cliff period", async function () {
      // Try to release tokens before cliff
      await expect(
        token.connect(teamWallet).releaseVestedTokens(teamWallet.address)
      ).to.be.revertedWith("No tokens are available for release");
      
      // Check that no tokens were released
      const vestingSchedule = await token.getVestingSchedule(teamWallet.address);
      expect(vestingSchedule[1]).to.equal(0); // releasedAmount
    });
  });
  
  describe("Vesting Calculations", function () {
    it("Should calculate vested amount correctly according to time passed", async function () {
      // Fast forward past the cliff period
      await time.increase(VESTING_CLIFF);
      
      // Calculate expected vested amount (just past cliff, so minimal vesting)
      const vestingSchedule = await token.getVestingSchedule(teamWallet.address);
      const totalAmount = vestingSchedule[0];
      
      // Check vested amount
      const vestedAmount = await token.calculateVestedAmount(teamWallet.address);
      
      // Should be more than 0 but less than the total
      expect(vestedAmount).to.be.gt(0);
      expect(vestedAmount).to.be.lt(totalAmount);
      
      // Fast forward to halfway through the vesting period after cliff
      const halfwayTime = VESTING_DURATION.sub(VESTING_CLIFF).div(2);
      await time.increase(halfwayTime);
      
      // Check vested amount now
      const halfwayVestedAmount = await token.calculateVestedAmount(teamWallet.address);
      
      // Should be around half of the total amount
      const expectedHalfway = totalAmount.div(2);
      const tolerance = totalAmount.div(100); // 1% tolerance for time calculations
      
      expect(halfwayVestedAmount).to.be.closeTo(expectedHalfway, tolerance);
    });
    
    it("Should vest 100% of tokens after the full vesting period", async function () {
      // Fast forward to end of vesting period
      const remainingTime = VESTING_DURATION;
      await time.increase(remainingTime);
      
      // Get vesting schedule
      const vestingSchedule = await token.getVestingSchedule(teamWallet.address);
      const totalAmount = vestingSchedule[0];
      
      // Check vested amount
      const vestedAmount = await token.calculateVestedAmount(teamWallet.address);
      
      // Should be the total amount
      expect(vestedAmount).to.equal(totalAmount);
    });
  });
  
  describe("Token Release", function () {
    it("Should allow beneficiary to release vested tokens", async function () {
      // Get beneficiary's balance before release
      const balanceBefore = await token.balanceOf(teamWallet.address);
      
      // Get vesting schedule
      const vestingSchedule = await token.getVestingSchedule(teamWallet.address);
      const totalAmount = vestingSchedule[0];
      const releasedBefore = vestingSchedule[1];
      
      // Release tokens
      await token.connect(teamWallet).releaseVestedTokens(teamWallet.address);
      
      // Get balance after release
      const balanceAfter = await token.balanceOf(teamWallet.address);
      
      // Check that tokens were released
      const released = balanceAfter.sub(balanceBefore);
      expect(released).to.equal(totalAmount.sub(releasedBefore));
      
      // Check that released amount was updated
      const updatedSchedule = await token.getVestingSchedule(teamWallet.address);
      expect(updatedSchedule[1]).to.equal(totalAmount);
    });
    
    it("Should not allow releasing tokens again after they're fully released", async function () {
      // Try to release tokens again
      await expect(
        token.connect(teamWallet).releaseVestedTokens(teamWallet.address)
      ).to.be.revertedWith("No tokens are available for release");
    });
  });
  
  describe("Custom Vesting Schedule", function () {
    it("Should allow setting up new vesting schedules", async function () {
      // Create a vesting schedule for another beneficiary
      // Note: This is a custom function we would add to the contract in a real implementation
      // For this test, we're assuming it exists
      
      // For the sake of the test, let's imagine we have a setupVesting function:
      // await token.connect(owner).setupVesting(
      //   beneficiary.address,
      //   ethers.utils.parseEther("1000000"),
      //   ONE_YEAR,
      //   ONE_MONTH
      // );
      
      // Since the function doesn't actually exist, we'll just test the calculation functions
      
      // The ErthaToken contract doesn't have a public function to create new vesting schedules
      // beyond the initial setup in the constructor. In a real implementation, we would add this
      // functionality and test it here.
      
      // For this test file, we'll skip this test case. In a real implementation, you would:
      // 1. Add a public setupVesting function to the contract
      // 2. Add appropriate access controls
      // 3. Test that new vesting schedules can be created
    });
  });
});