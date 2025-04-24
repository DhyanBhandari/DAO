const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("ErthaToken - Validator Functions", function () {
  let erthaToken;
  let owner, teamWallet, stakingPool, treasuryWallet, validator1, validator2, validator3;
  let proxyAddress;
  
  before(async function () {
    // Get signers
    [owner, teamWallet, stakingPool, treasuryWallet, validator1, validator2, validator3] = await ethers.getSigners();
    
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
  
  describe("Validator Management", function () {
    it("Should have the owner as the initial validator", async function () {
      // Check validator count
      expect((await erthaToken.getValidators()).length).to.equal(1);
      
      // Check owner is a validator
      expect(await erthaToken.isValidator(owner.address)).to.be.true;
    });
    
    it("Should allow owner to add new validators", async function () {
      // Create action hash for consensus
      const timestamp = await time.latest();
      const actionId = ethers.utils.solidityKeccak256(
        ["string", "address", "uint256"],
        ["addValidator", validator1.address, timestamp]
      );
      
      // Owner confirms action
      await erthaToken.confirmAction(actionId);
      
      // Add validator1
      await erthaToken.addValidator(validator1.address);
      
      // Check validator was added
      expect(await erthaToken.isValidator(validator1.address)).to.be.true;
      expect((await erthaToken.getValidators()).length).to.equal(2);
    });
    
    it("Should require consensus to add another validator", async function () {
      // Add validator2 - this will require consensus
      const timestamp = await time.latest();
      const actionId = ethers.utils.solidityKeccak256(
        ["string", "address", "uint256"],
        ["addValidator", validator2.address, timestamp]
      );
      
      // Owner confirms
      await erthaToken.confirmAction(actionId);
      
      // Validator1 confirms
      await erthaToken.connect(validator1).confirmAction(actionId);
      
      // Now add validator2
      await erthaToken.addValidator(validator2.address);
      
      // Check validator was added
      expect(await erthaToken.isValidator(validator2.address)).to.be.true;
      expect((await erthaToken.getValidators()).length).to.equal(3);
    });
    
    it("Should allow removing a validator with consensus", async function () {
      // Remove validator1
      const timestamp = await time.latest();
      const actionId = ethers.utils.solidityKeccak256(
        ["string", "address", "uint256"],
        ["removeValidator", validator1.address, timestamp]
      );
      
      // Owner confirms
      await erthaToken.confirmAction(actionId);
      
      // Validator2 confirms
      await erthaToken.connect(validator2).confirmAction(actionId);
      
      // Now remove validator1
      await erthaToken.removeValidator(validator1.address);
      
      // Check validator was removed
      expect(await erthaToken.isValidator(validator1.address)).to.be.false;
      expect((await erthaToken.getValidators()).length).to.equal(2);
    });
    
    it("Should prevent removing validators below required confirmations", async function () {
      // First set required confirmations to 2
      const timestamp = await time.latest();
      const actionId1 = ethers.utils.solidityKeccak256(
        ["string", "uint256", "uint256"],
        ["setRequiredConfirmations", 2, timestamp]
      );
      
      // Owner confirms
      await erthaToken.confirmAction(actionId1);
      
      // Validator2 confirms
      await erthaToken.connect(validator2).confirmAction(actionId1);
      
      // Set required confirmations to 2
      await erthaToken.setRequiredConfirmations(2);
      
      // Now try to remove validator2
      const actionId2 = ethers.utils.solidityKeccak256(
        ["string", "address", "uint256"],
        ["removeValidator", validator2.address, await time.latest()]
      );
      
      // Owner confirms
      await erthaToken.confirmAction(actionId2);
      
      // Try to remove validator2 - should revert
      await expect(
        erthaToken.removeValidator(validator2.address)
      ).to.be.revertedWith("Cannot remove validator below required confirmations");
      
      // Reset required confirmations to 1
      const actionId3 = ethers.utils.solidityKeccak256(
        ["string", "uint256", "uint256"],
        ["setRequiredConfirmations", 1, await time.latest()]
      );
      
      await erthaToken.confirmAction(actionId3);
      await erthaToken.connect(validator2).confirmAction(actionId3);
      await erthaToken.setRequiredConfirmations(1);
    });
    
    it("Should track validator missed confirmations", async function () {
      // Add validator1 back
      const timestamp = await time.latest();
      const actionId = ethers.utils.solidityKeccak256(
        ["string", "address", "uint256"],
        ["addValidator", validator1.address, timestamp]
      );
      
      // Owner confirms
      await erthaToken.confirmAction(actionId);
      
      // Add validator1
      await erthaToken.addValidator(validator1.address);
      
      // Create an action that validator1 doesn't confirm
      const timestamp2 = await time.latest();
      const actionId2 = ethers.utils.solidityKeccak256(
        ["string", "uint256", "uint256"],
        ["setRequiredConfirmations", 1, timestamp2]
      );
      
      // Only owner confirms
      await erthaToken.confirmAction(actionId2);
      await erthaToken.setRequiredConfirmations(1);
      
      // Record missed confirmations
      await erthaToken.recordMissedConfirmations(actionId2);
      
      // Check validator1 has a missed confirmation
      expect(await erthaToken.validatorMissedConfirmations(validator1.address)).to.equal(1);
      
      // Check validator2 also has a missed confirmation
      expect(await erthaToken.validatorMissedConfirmations(validator2.address)).to.equal(1);
      
      // Owner should have 0 missed confirmations since they confirmed
      expect(await erthaToken.validatorMissedConfirmations(owner.address)).to.equal(0);
    });
    
    it("Should allow slashing a validator after too many missed confirmations", async function () {
      // Set max missed confirmations to 5
      const timestamp = await time.latest();
      const actionId1 = ethers.utils.solidityKeccak256(
        ["string", "uint256", "uint256"],
        ["setMaxMissedConfirmations", 5, timestamp]
      );
      
      await erthaToken.confirmAction(actionId1);
      await erthaToken.setMaxMissedConfirmations(5);
      
      // Artificially increase missed confirmations for validator1
      for (let i = 0; i < 4; i++) {
        const timestamp = await time.latest() + i;
        const actionId = ethers.utils.solidityKeccak256(
          ["string", "uint256", "uint256"],
          ["setRequiredConfirmations", 1, timestamp]
        );
        
        await erthaToken.confirmAction(actionId);
        await erthaToken.setRequiredConfirmations(1);
        await erthaToken.recordMissedConfirmations(actionId);
      }
      
      // Now validator1 should have 5 missed confirmations
      expect(await erthaToken.validatorMissedConfirmations(validator1.address)).to.equal(5);
      
      // Slash validator1
      const actionId2 = ethers.utils.solidityKeccak256(
        ["string", "address", "uint256"],
        ["slashValidator", validator1.address, await time.latest()]
      );
      
      await erthaToken.confirmAction(actionId2);
      await erthaToken.slashValidator(validator1.address);
      
      // Check validator was removed
      expect(await erthaToken.isValidator(validator1.address)).to.be.false;
    });
  });
  
  describe("Consensus Mechanism", function () {
    it("Should track confirmation counts correctly", async function () {
      // Add validator1 back
      const timestamp = await time.latest();
      const actionId1 = ethers.utils.solidityKeccak256(
        ["string", "address", "uint256"],
        ["addValidator", validator1.address, timestamp]
      );
      
      await erthaToken.confirmAction(actionId1);
      await erthaToken.addValidator(validator1.address);
      
      // Create a test action ID
      const timestamp2 = await time.latest();
      const actionId = ethers.utils.solidityKeccak256(
        ["string", "uint256", "uint256", "uint256", "uint256"],
        ["setFeeRates", 150, 150, 150, timestamp2]
      );
      
      // Initially zero confirmations
      expect(await erthaToken.getConfirmationCount(actionId)).to.equal(0);
      
      // Owner confirms
      await erthaToken.confirmAction(actionId);
      expect(await erthaToken.getConfirmationCount(actionId)).to.equal(1);
      
      // Validator1 confirms
      await erthaToken.connect(validator1).confirmAction(actionId);
      expect(await erthaToken.getConfirmationCount(actionId)).to.equal(2);
      
      // Validator2 confirms
      await erthaToken.connect(validator2).confirmAction(actionId);
      expect(await erthaToken.getConfirmationCount(actionId)).to.equal(3);
    });
    
    it("Should require timelock for critical operations", async function () {
      // Try to pause contract - should create timelock first
      const timestamp = await time.latest();
      const actionId = ethers.utils.solidityKeccak256(
        ["string", "uint256"],
        ["pause", timestamp]
      );
      
      // Owner confirms and creates timelock
      await erthaToken.pause();
      
      // Try to pause immediately - should fail
      await expect(erthaToken.pause()).to.be.revertedWith("Timelock not expired");
      
      // Advance time past the timelock period (1 day)
      await time.increase(86401);
      
      // Now pause should work
      await erthaToken.confirmAction(actionId);
      await erthaToken.connect(validator1).confirmAction(actionId);
      await erthaToken.connect(validator2).confirmAction(actionId);
      await erthaToken.pause();
      expect(await erthaToken.paused()).to.be.true;
      
      // Unpause for other tests
      const actionId2 = ethers.utils.solidityKeccak256(
        ["string", "uint256"],
        ["unpause", await time.latest()]
      );
      
      await erthaToken.confirmAction(actionId2);
      await erthaToken.connect(validator1).confirmAction(actionId2);
      await erthaToken.connect(validator2).confirmAction(actionId2);
      await erthaToken.unpause();
    });
  });
});