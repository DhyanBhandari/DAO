const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("ErthaToken - Security Tests", function () {
  let erthaToken;
  let owner, teamWallet, stakingPool, treasuryWallet, user1, user2, attacker;
  let proxyAddress;
  
  before(async function () {
    // Get signers
    [owner, teamWallet, stakingPool, treasuryWallet, user1, user2, attacker] = await ethers.getSigners();
    
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
    
    // Transfer some tokens to users for testing
    await erthaToken.connect(treasuryWallet).transfer(user1.address, ethers.utils.parseEther("1000"));
    await erthaToken.connect(treasuryWallet).transfer(user2.address, ethers.utils.parseEther("1000"));
    await erthaToken.connect(treasuryWallet).transfer(attacker.address, ethers.utils.parseEther("100"));
  });
  
  describe("Reentrancy Protection", function () {
    it("Should protect against reentrancy in staking operations", async function () {
      // Deploy the reentrancy attacker contract
      const ReentrancyAttacker = await ethers.getContractFactory("ReentrancyAttacker");
      const attackerContract = await ReentrancyAttacker.connect(attacker).deploy(proxyAddress);
      
      // Exempt the attacker contract from fees for testing
      const timestamp = await time.latest();
      const actionId = ethers.utils.solidityKeccak256(
        ["string", "address", "bool", "uint256"],
        ["setFeeExemption", await attackerContract.getAddress(), true, timestamp]
      );
      
      await erthaToken.confirmAction(actionId);
      await erthaToken.setFeeExemption(await attackerContract.getAddress(), true);
      
      // Fund attacker contract with tokens
      await erthaToken.connect(attacker).transfer(
        await attackerContract.getAddress(),
        ethers.utils.parseEther("50")
      );
      
      // Try to perform attack
      await expect(attackerContract.connect(attacker).attack()).to.be.revertedWith(
        "ReentrancyGuard: reentrant call"
      );
    });
  });
  
  describe("Fee Mechanism Security", function () {
    it("Should correctly apply fees for non-exempt addresses", async function () {
      const transferAmount = ethers.utils.parseEther("100");
      
      // Get balances before transfer
      const user1BalanceBefore = await erthaToken.balanceOf(user1.address);
      const user2BalanceBefore = await erthaToken.balanceOf(user2.address);
      const teamWalletBalanceBefore = await erthaToken.balanceOf(teamWallet.address);
      const stakingPoolBalanceBefore = await erthaToken.balanceOf(stakingPool.address);
      
      // Perform transfer
      await erthaToken.connect(user1).transfer(user2.address, transferAmount);
      
      // Get balances after transfer
      const user1BalanceAfter = await erthaToken.balanceOf(user1.address);
      const user2BalanceAfter = await erthaToken.balanceOf(user2.address);
      const teamWalletBalanceAfter = await erthaToken.balanceOf(teamWallet.address);
      const stakingPoolBalanceAfter = await erthaToken.balanceOf(stakingPool.address);
      
      // Calculate expected fees (1% each)
      const expectedTeamFee = transferAmount.mul(100).div(10000);
      const expectedStakingFee = transferAmount.mul(100).div(10000);
      const expectedBurnFee = transferAmount.mul(100).div(10000);
      const expectedTransferAmount = transferAmount.sub(expectedTeamFee).sub(expectedStakingFee).sub(expectedBurnFee);
      
      // Verify balances
      expect(user1BalanceBefore.sub(user1BalanceAfter)).to.equal(transferAmount);
      expect(user2BalanceAfter.sub(user2BalanceBefore)).to.equal(expectedTransferAmount);
      expect(teamWalletBalanceAfter.sub(teamWalletBalanceBefore)).to.equal(expectedTeamFee);
      expect(stakingPoolBalanceAfter.sub(stakingPoolBalanceBefore)).to.equal(expectedStakingFee);
    });
    
    it("Should exempt addresses from fees if configured", async function () {
      // Set fee exemption for user1
      const timestamp = await time.latest();
      const actionId = ethers.utils.solidityKeccak256(
        ["string", "address", "bool", "uint256"],
        ["setFeeExemption", user1.address, true, timestamp]
      );
      
      await erthaToken.confirmAction(actionId);
      await erthaToken.setFeeExemption(user1.address, true);
      
      // Verify exemption status
      expect(await erthaToken.isExemptFromFee(user1.address)).to.be.true;
      
      const transferAmount = ethers.utils.parseEther("100");
      
      // Get balances before transfer
      const user1BalanceBefore = await erthaToken.balanceOf(user1.address);
      const user2BalanceBefore = await erthaToken.balanceOf(user2.address);
      
      // Perform transfer from exempt address
      await erthaToken.connect(user1).transfer(user2.address, transferAmount);
      
      // Get balances after transfer
      const user1BalanceAfter = await erthaToken.balanceOf(user1.address);
      const user2BalanceAfter = await erthaToken.balanceOf(user2.address);
      
      // Verify no fees were deducted
      expect(user1BalanceBefore.sub(user1BalanceAfter)).to.equal(transferAmount);
      expect(user2BalanceAfter.sub(user2BalanceBefore)).to.equal(transferAmount);
      
      // Reset fee exemption for user1
      const timestamp2 = await time.latest();
      const actionId2 = ethers.utils.solidityKeccak256(
        ["string", "address", "bool", "uint256"],
        ["setFeeExemption", user1.address, false, timestamp2]
      );
      
      await erthaToken.confirmAction(actionId2);
      await erthaToken.setFeeExemption(user1.address, false);
    });
  });
  
  describe("Access Control Security", function () {
    it("Should prevent unauthorized users from calling privileged functions", async function () {
      // Try to call setFeeRates as non-owner
      await expect(
        erthaToken.connect(attacker).setFeeRates(200, 200, 200)
      ).to.be.revertedWith("Ownable: caller is not the owner");
      
      // Try to add a validator as non-owner
      await expect(
        erthaToken.connect(attacker).addValidator(attacker.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
      
      // Try to pause the contract as non-owner
      await expect(
        erthaToken.connect(attacker).pause()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
    
    it("Should require consensus for critical operations", async function () {
      // Try to set fee rates without consensus
      const timestamp = await time.latest();
      const actionId = ethers.utils.solidityKeccak256(
        ["string", "uint256", "uint256", "uint256", "uint256"],
        ["setFeeRates", 150, 150, 150, timestamp]
      );
      
      // Call without consensus (only owner confirms)
      await erthaToken.setFeeRates(150, 150, 150);
      
      // Verify fee rates haven't changed
      expect(await erthaToken.teamFeeRate()).to.equal(100);
      expect(await erthaToken.stakingFeeRate()).to.equal(100);
      expect(await erthaToken.burnFeeRate()).to.equal(100);
      
      // Now confirm the action
      await erthaToken.confirmAction(actionId);
      
      // Add another validator for additional confirmation
      const addValidatorId = ethers.utils.solidityKeccak256(
        ["string", "address", "uint256"],
        ["addValidator", validator3.address, await time.latest()]
      );
      
      await erthaToken.confirmAction(addValidatorId);
      await erthaToken.addValidator(validator3.address);
      
      // Set required confirmations to 2
      const setRequiredId = ethers.utils.solidityKeccak256(
        ["string", "uint256", "uint256"],
        ["setRequiredConfirmations", 2, await time.latest()]
      );
      
      await erthaToken.confirmAction(setRequiredId);
      await erthaToken.connect(validator3).confirmAction(setRequiredId);
      await erthaToken.setRequiredConfirmations(2);
      
      // Get validator3 to confirm the fee change
      await erthaToken.connect(validator3).confirmAction(actionId);
      
      // Call again after sufficient confirmations
      await erthaToken.setFeeRates(150, 150, 150);
      
      // Verify fee rates have changed
      expect(await erthaToken.teamFeeRate()).to.equal(150);
      expect(await erthaToken.stakingFeeRate()).to.equal(150);
      expect(await erthaToken.burnFeeRate()).to.equal(150);
      
      // Restore original values
      const restoreId = ethers.utils.solidityKeccak256(
        ["string", "uint256", "uint256", "uint256", "uint256"],
        ["setFeeRates", 100, 100, 100, await time.latest()]
      );
      
      await erthaToken.confirmAction(restoreId);
      await erthaToken.connect(validator3).confirmAction(restoreId);
      await erthaToken.setFeeRates(100, 100, 100);
    });
  });
  
  describe("Upgradeability Security", function () {
    it("Should require timelock and consensus for upgrades", async function () {
      // Deploy new implementation contract
      const ErthaToken = await ethers.getContractFactory("ErthaToken");
      const newImplementation = await ErthaToken.deploy(
        teamWallet.address,
        stakingPool.address,
        treasuryWallet.address
      );
      
      // Get UUPS interface
      const UUPSInterface = new ethers.utils.Interface([
        "function upgradeTo(address newImplementation)"
      ]);
      
      // Try to upgrade without timelock - should create timelock
      const timestamp = await time.latest();
      const upgradeActionId = ethers.utils.solidityKeccak256(
        ["string", "address", "uint256"],
        ["upgrade", await newImplementation.getAddress(), timestamp]
      );
      
      // This call should set a timelock but not upgrade yet
      await expect(
        owner.sendTransaction({
          to: proxyAddress,
          data: UUPSInterface.encodeFunctionData("upgradeTo", [await newImplementation.getAddress()])
        })
      ).to.be.revertedWith("Timelock not expired");
      
      // Advance time past the timelock period (1 day)
      await time.increase(86401);
      
      // Now try to upgrade - should still fail due to missing confirmations
      await expect(
        owner.sendTransaction({
          to: proxyAddress,
          data: UUPSInterface.encodeFunctionData("upgradeTo", [await newImplementation.getAddress()])
        })
      ).to.be.revertedWith("Only validators can confirm actions");
    });
  });
});

// Contract used for reentrancy testing
const ReentrancyAttackerArtifact = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IErthaToken {
    function stake(uint256 amount) external;
    function withdraw(uint256 amount) external;
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract ReentrancyAttacker {
    IErthaToken public token;
    uint256 public attackAmount = 10 ether;
    bool public attacking = false;
    
    constructor(address _token) {
        token = IErthaToken(_token);
    }
    
    // Fallback to receive ETH
    receive() external payable {
        if (attacking) {
            token.withdraw(attackAmount);
        }
    }
    
    function attack() external {
        require(token.balanceOf(address(this)) >= attackAmount, "Insufficient token balance");
        
        // Stake tokens 
        token.stake(attackAmount);
        
        // Set attacking flag
        attacking = true;
        
        // Try to withdraw - should trigger reentrancy
        token.withdraw(attackAmount);
        
        // Reset flag
        attacking = false;
    }
    
    function getAddress() external view returns (address) {
        return address(this);
    }
}
`;

before(async function() {
  // Deploy the ReentrancyAttacker contract for testing
  const attackerFactory = await ethers.getContractFactory("ReentrancyAttacker");
  await attackerFactory.deploy(ethers.constants.AddressZero); // Deploy with dummy address
});