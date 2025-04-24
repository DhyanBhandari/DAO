// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "./ErthaToken.sol";

/**
 * @title ErthaTokenFactory
 * @dev Factory contract to deploy ErthaToken with UUPS proxy pattern
 */
contract ErthaTokenFactory {
    // Event emitted when a new ErthaToken is deployed
    event ErthaTokenDeployed(address indexed proxyAddress, address indexed implementationAddress);
    
    /**
     * @dev Deploy a new ErthaToken with UUPS proxy pattern
     * @param _teamWallet Address of the team wallet for fee collection
     * @param _stakingPool Address of the staking pool for fee distribution
     * @param _treasuryWallet Address of the treasury wallet
     * @param _owner Address of the owner of the token
     * @return proxyAddress Address of the deployed proxy
     */
    function deployErthaToken(
        address _teamWallet,
        address _stakingPool,
        address _treasuryWallet,
        address _owner
    ) external returns (address proxyAddress) {
        // Deploy implementation
        ErthaToken implementation = new ErthaToken(_teamWallet, _stakingPool, _treasuryWallet);
        
        // Encode initialization data
        bytes memory initData = abi.encodeWithSelector(
            ErthaToken.initialize.selector,
            _teamWallet,
            _stakingPool,
            _treasuryWallet,
            _owner
        );
        
        // Deploy proxy
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            initData
        );
        
        proxyAddress = address(proxy);
        
        emit ErthaTokenDeployed(proxyAddress, address(implementation));
        
        return proxyAddress;
    }
}