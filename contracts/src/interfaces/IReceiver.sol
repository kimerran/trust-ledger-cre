// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IReceiver
/// @notice Interface that contracts must implement to receive CRE DON reports.
/// @dev See https://docs.chain.link/cre/guides/workflow/using-evm-client/onchain-write
interface IReceiver {
    /// @notice Called by the CRE DON to deliver a signed report.
    /// @param metadata CRE-internal metadata (unused by consumers).
    /// @param rawReport ABI-encoded payload produced by the workflow.
    function onReport(bytes calldata metadata, bytes calldata rawReport) external;

    /// @notice ERC-165 interface detection.
    function supportsInterface(bytes4 interfaceId) external pure returns (bool);
}
