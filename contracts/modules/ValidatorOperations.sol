// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IErthaToken.sol";
import "../libraries/Validators.sol";

/**
 * @title ValidatorOperations
 * @dev Validator management functions for the ErthaToken contract
 */
contract ValidatorOperations is IErthaToken {
    using Validators for address[];
    
    /**
     * @dev Add a new validator
     * @param _validator Address of the validator to add
     */
    function addValidator(address _validator) external onlyOwner validAddress(_validator) {
        // Create action identifier for consensus
        bytes32 actionId = keccak256(abi.encodePacked(
            "addValidator",
            _validator,
            block.timestamp
        ));
        
        // Check if this action has already been confirmed
        if (!_confirmAction(actionId)) {
            return; // Wait for more confirmations
        }
        
        // Check if the address is already a validator
        require(!validators.contains(_validator), "Address is already a validator");
        
        // Add the validator
        validators.push(_validator);
        isValidator[_validator] = true;
        
        emit ValidatorAdded(_validator);
        emit ActionExecuted(actionId);
    }
    
    /**
     * @dev Remove a validator
     * @param _validator Address of the validator to remove
     */
    function removeValidator(address _validator) external onlyOwner validAddress(_validator) {
        // Create action identifier for consensus
        bytes32 actionId = keccak256(abi.encodePacked(
            "removeValidator",
            _validator,
            block.timestamp
        ));
        
        // Check if this action has already been confirmed
        if (!_confirmAction(actionId)) {
            return; // Wait for more confirmations
        }
        
        // Check if the address is a validator
        require(isValidator[_validator], "Address is not a validator");
        
        // Ensure we maintain the minimum number of required validators
        require(validators.length > requiredConfirmations, "Cannot remove validator below required confirmations");
        
        // Remove the validator
        validators.remove(_validator);
        isValidator[_validator] = false;
        
        emit ValidatorRemoved(_validator);
        emit ActionExecuted(actionId);
    }
    
    /**
     * @dev Slash a validator who has missed too many confirmations
     * @param _validator Address of the validator to slash
     */
    function slashValidator(address _validator) external onlyOwner validAddress(_validator) {
        // Create action identifier for consensus
        bytes32 actionId = keccak256(abi.encodePacked(
            "slashValidator",
            _validator,
            block.timestamp
        ));
        
        // Check if this action has already been confirmed
        if (!_confirmAction(actionId)) {
            return; // Wait for more confirmations
        }
        
        // Check if the address is a validator
        require(isValidator[_validator], "Address is not a validator");
        
        // Check if the validator has missed enough confirmations to be slashed
        uint256 missed = validatorMissedConfirmations[_validator];
        require(missed >= maxMissedConfirmations, "Not enough missed confirmations for slashing");
        
        // Ensure we maintain the minimum number of required validators
        require(validators.length > requiredConfirmations, "Cannot remove validator below required confirmations");
        
        // Remove the validator
        validators.remove(_validator);
        isValidator[_validator] = false;
        
        emit ValidatorSlashed(_validator, missed);
        emit ActionExecuted(actionId);
    }
    
    /**
     * @dev Set the required number of confirmations for consensus
     * @param _required Number of required confirmations
     */
    function setRequiredConfirmations(uint256 _required) external onlyOwner {
        // Create action identifier for consensus
        bytes32 actionId = keccak256(abi.encodePacked(
            "setRequiredConfirmations",
            _required,
            block.timestamp
        ));
        
        // Check if this action has already been confirmed
        if (!_confirmAction(actionId)) {
            return; // Wait for more confirmations
        }
        
        // Ensure the new required confirmations is less than or equal to the number of validators
        require(_required > 0, "Required confirmations must be greater than 0");
        require(_required <= validators.length, "Required confirmations exceeds validator count");
        
        uint256 oldRequired = requiredConfirmations;
        requiredConfirmations = _required;
        
        emit RequiredConfirmationsUpdated(oldRequired, _required);
        emit ActionExecuted(actionId);
    }
    
    /**
     * @dev Confirm an action for consensus
     * @param _actionId Identifier of the action to confirm
     * @return Whether the action has reached the required confirmations
     */
    function confirmAction(bytes32 _actionId) external onlyValidator returns (bool) {
        // Ensure this validator hasn't already confirmed
        require(!confirmations[_actionId][msg.sender], "Already confirmed");
        
        // Record the confirmation
        confirmations[_actionId][msg.sender] = true;
        
        // Emit event
        emit ActionConfirmed(_actionId, msg.sender);
        
        // Check if we've reached the required number of confirmations
        uint256 count = getConfirmationCount(_actionId);
        
        if (count >= requiredConfirmations) {
            isActionConfirmed[_actionId] = true;
            emit ActionPending(_actionId, count, requiredConfirmations);
            return true;
        } else {
            emit ActionPending(_actionId, count, requiredConfirmations);
            return false;
        }
    }
    
    /**
     * @dev Record missed confirmations for validators
     * @param _actionId Identifier of the action that was missed
     */
    function recordMissedConfirmations(bytes32 _actionId) external onlyOwner {
        for (uint i = 0; i < validators.length; i++) {
            address validator = validators[i];
            if (!confirmations[_actionId][validator]) {
                validatorMissedConfirmations[validator]++;
            }
        }
    }
    
    /**
     * @dev Set the maximum number of missed confirmations before slashing
     * @param _maxMissed Maximum number of missed confirmations
     */
    function setMaxMissedConfirmations(uint256 _maxMissed) external onlyOwner {
        // Create action identifier for consensus
        bytes32 actionId = keccak256(abi.encodePacked(
            "setMaxMissedConfirmations",
            _maxMissed,
            block.timestamp
        ));
        
        // Check if this action has already been confirmed
        if (!_confirmAction(actionId)) {
            return; // Wait for more confirmations
        }
        
        maxMissedConfirmations = _maxMissed;
        emit ActionExecuted(actionId);
    }
    
    /**
     * @dev Get the number of confirmations for an action
     * @param _actionId Identifier of the action
     * @return Number of confirmations
     */
    function getConfirmationCount(bytes32 _actionId) public view returns (uint256) {
        uint256 count = 0;
        for (uint i = 0; i < validators.length; i++) {
            if (confirmations[_actionId][validators[i]]) {
                count++;
            }
        }
        return count;
    }
    
    /**
     * @dev Get the list of validators
     * @return Array of validator addresses
     */
    function getValidators() external view returns (address[] memory) {
        return validators;
    }
    
    /**
     * @dev Check if a validator has confirmed an action
     * @param _actionId Identifier of the action
     * @param _validator Address of the validator
     * @return Whether the validator has confirmed the action
     */
    function hasConfirmed(bytes32 _actionId, address _validator) external view returns (bool) {
        return confirmations[_actionId][_validator];
    }
    
    /**
     * @dev Internal function to check if an action has enough confirmations
     * @param _actionId Identifier of the action
     * @return Whether the action is confirmed
     */
    function _checkConfirmations(bytes32 _actionId) internal view returns (bool) {
        return isActionConfirmed[_actionId];
    }
    
    /**
     * @dev Internal function to confirm an action and check if it has enough confirmations
     * Used by other contract functions that require consensus
     * @param _actionId Identifier of the action
     * @return Whether the action is confirmed
     */
    function _confirmAction(bytes32 _actionId) internal returns (bool) {
        // If already confirmed, return true
        if (isActionConfirmed[_actionId]) {
            return true;
        }
        
        // If owner is a validator, record confirmation
        if (isValidator[msg.sender]) {
            // Check if this validator has already confirmed
            if (!confirmations[_actionId][msg.sender]) {
                confirmations[_actionId][msg.sender] = true;
                emit ActionConfirmed(_actionId, msg.sender);
            }
            
            // Check if we've reached the required confirmations
            uint256 count = getConfirmationCount(_actionId);
            if (count >= requiredConfirmations) {
                isActionConfirmed[_actionId] = true;
                emit ActionPending(_actionId, count, requiredConfirmations);
                return true;
            } else {
                emit ActionPending(_actionId, count, requiredConfirmations);
                return false;
            }
        } else {
            // Caller is not a validator
            revert("Only validators can confirm actions");
        }
    }
}