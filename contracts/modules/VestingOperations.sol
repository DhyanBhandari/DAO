// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ValidatorOperations
 * @dev Validator management functions
 */
contract ValidatorOperations is Ownable {
    
    // State variables to track validators
    mapping(address => bool) public validators;
    
    // Events
    event ValidatorAdded(address indexed validator);
    event ValidatorRemoved(address indexed validator);
    
    // Modifier to check if address is valid
    modifier validAddress(address _address) {
        require(_address != address(0), "Invalid address: zero address not allowed");
        _;
    }
    
    /**
     * @dev Add a new validator
     * @param _validator Address of the validator to add
     */
    function addValidator(address _validator) external onlyOwner validAddress(_validator) {
        require(!validators[_validator], "Validator already exists");
        validators[_validator] = true;
        emit ValidatorAdded(_validator);
    }
    
    /**
     * @dev Remove a validator
     * @param _validator Address of the validator to remove
     */
    function removeValidator(address _validator) external onlyOwner validAddress(_validator) {
        require(validators[_validator], "Validator does not exist");
        validators[_validator] = false;
        emit ValidatorRemoved(_validator);
    }
    
    /**
     * @dev Check if an address is a validator
     * @param _address Address to check
     * @return Boolean indicating whether the address is a validator
     */
    function isValidator(address _address) public view returns (bool) {
        return validators[_address];
    }
}