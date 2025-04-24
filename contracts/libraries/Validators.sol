// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Validators
 * @dev Library for managing validator operations
 */
library Validators {
    /**
     * @dev Check if a validator exists in the validators array
     * @param validators Array of validator addresses
     * @param validator Address to check
     * @return Whether the address is a validator
     */
    function contains(address[] storage validators, address validator) internal view returns (bool) {
        for (uint i = 0; i < validators.length; i++) {
            if (validators[i] == validator) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * @dev Get the index of a validator in the validators array
     * @param validators Array of validator addresses
     * @param validator Address to find
     * @return Index of the validator, or validators.length if not found
     */
    function getIndex(address[] storage validators, address validator) internal view returns (uint) {
        for (uint i = 0; i < validators.length; i++) {
            if (validators[i] == validator) {
                return i;
            }
        }
        return validators.length;
    }
    
    /**
     * @dev Remove a validator from the validators array
     * @param validators Array of validator addresses
     * @param validator Address to remove
     * @return Whether the validator was removed
     */
    function remove(address[] storage validators, address validator) internal returns (bool) {
        uint index = getIndex(validators, validator);
        
        if (index == validators.length) {
            return false;
        }
        
        // Replace with the last element and pop
        validators[index] = validators[validators.length - 1];
        validators.pop();
        
        return true;
    }
}