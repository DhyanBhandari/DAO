// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ConsensusManager
 * @dev Library for managing consensus operations
 */
library ConsensusManager {
    /**
     * @dev Get hash for an action with provided parameters
     * @param prefix Action identifier prefix
     * @param param1 First parameter for the action
     * @param timestamp Timestamp to prevent replay attacks
     * @return Action identifier hash
     */
    function getActionId(
        string memory prefix,
        address param1,
        uint256 timestamp
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(prefix, param1, timestamp));
    }
    
    /**
     * @dev Get hash for an action with provided parameters
     * @param prefix Action identifier prefix
     * @param param1 First parameter for the action
     * @param param2 Second parameter for the action
     * @param timestamp Timestamp to prevent replay attacks
     * @return Action identifier hash
     */
    function getActionId(
        string memory prefix,
        uint256 param1,
        uint256 param2,
        uint256 timestamp
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(prefix, param1, param2, timestamp));
    }
    
    /**
     * @dev Get hash for an action with provided parameters
     * @param prefix Action identifier prefix
     * @param param1 First parameter for the action
     * @param param2 Second parameter for the action
     * @param param3 Third parameter for the action
     * @param timestamp Timestamp to prevent replay attacks
     * @return Action identifier hash
     */
    function getActionId(
        string memory prefix,
        uint256 param1,
        uint256 param2,
        uint256 param3,
        uint256 timestamp
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(prefix, param1, param2, param3, timestamp));
    }
}