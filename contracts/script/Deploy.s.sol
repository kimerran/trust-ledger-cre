// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {AuditAnchor} from "../src/AuditAnchor.sol";
import {RetentionPolicy} from "../src/RetentionPolicy.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy AuditAnchor — no constructor args needed
        AuditAnchor auditAnchor = new AuditAnchor();
        console.log("AuditAnchor deployed at:", address(auditAnchor));

        // Deploy RetentionPolicy — owner is the deployer
        RetentionPolicy retentionPolicy = new RetentionPolicy(deployer);
        console.log("RetentionPolicy deployed at:", address(retentionPolicy));

        vm.stopBroadcast();

        // Print .env snippet for easy copy-paste
        console.log("\n--- Update your .env ---");
        console.log(
            string(abi.encodePacked("AUDIT_ANCHOR_CONTRACT=", vm.toString(address(auditAnchor))))
        );
        console.log(
            string(
                abi.encodePacked(
                    "RETENTION_POLICY_CONTRACT=",
                    vm.toString(address(retentionPolicy))
                )
            )
        );
    }
}
