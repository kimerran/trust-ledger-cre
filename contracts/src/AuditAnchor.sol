// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IReceiver} from "./interfaces/IReceiver.sol";

/// @title AuditAnchor
/// @notice Immutable on-chain storage for AI decision audit records.
///         Each decision is anchored exactly once — no overwrites allowed.
/// @dev Keyed by the off-chain ULID decision ID string. The anchored hash
///      must match the SHA-256 of the canonical (RFC 8785) decision payload.
///      Implements IReceiver so Chainlink CRE DON nodes can write directly.
contract AuditAnchor is IReceiver {
    // ─── Structs ───────────────────────────────────────────────────────────────

    /// @notice An anchored audit record for a single AI decision
    struct Anchor {
        /// @dev SHA-256 hash of the canonical decision payload (as bytes32)
        bytes32 hash;
        /// @dev Base64-encoded KMS ECDSA signature over the hash string
        string signature;
        /// @dev JSON string containing the LLM risk assessment
        string riskJson;
        /// @dev Unix timestamp when this anchor was committed
        uint256 timestamp;
        /// @dev Address that called anchorDecision
        address anchorer;
    }

    // ─── State ─────────────────────────────────────────────────────────────────

    /// @notice Mapping from decision ULID (off-chain ID) to its anchor record
    mapping(string => Anchor) public anchors;

    /// @notice Total number of decisions anchored to this contract
    uint256 private _totalAnchored;

    // ─── Events ────────────────────────────────────────────────────────────────

    /// @notice Emitted when a new decision is successfully anchored
    /// @param decisionId The ULID of the decision in TrustLedger's database
    /// @param hash The SHA-256 hash of the canonical decision payload
    /// @param timestamp The block timestamp at anchor time
    event DecisionAnchored(
        string indexed decisionId,
        bytes32 indexed hash,
        uint256 timestamp
    );

    // ─── Errors ────────────────────────────────────────────────────────────────

    error AuditAnchor__EmptyDecisionId();
    error AuditAnchor__AlreadyAnchored(string decisionId);
    error AuditAnchor__EmptyHash();
    error AuditAnchor__EmptySignature();

    // ─── Functions ─────────────────────────────────────────────────────────────

    /// @notice Anchors a signed AI decision hash to the blockchain
    /// @dev Reverts if the decisionId has been anchored before (immutable records).
    ///      The caller is recorded as the anchorer.
    /// @param decisionId The ULID of the decision in TrustLedger's database
    /// @param hash SHA-256 hash of the canonical decision payload as bytes32
    /// @param signature Base64-encoded KMS ECDSA signature over the hash string
    /// @param riskJson JSON string containing the LLM risk assessment result
    function anchorDecision(
        string calldata decisionId,
        bytes32 hash,
        string calldata signature,
        string calldata riskJson
    ) external {
        _anchorDecision(decisionId, hash, signature, riskJson);
    }

    /// @notice Returns the anchor record for a given decision ID
    /// @param decisionId The ULID of the decision to look up
    /// @return anchor The full Anchor struct (zero values if not found)
    function getAnchor(string calldata decisionId)
        external
        view
        returns (Anchor memory anchor)
    {
        return anchors[decisionId];
    }

    /// @notice Returns true if a decision has been anchored
    /// @param decisionId The ULID of the decision to check
    /// @return anchored True if an anchor record exists
    function isAnchored(string calldata decisionId) external view returns (bool anchored) {
        return anchors[decisionId].timestamp != 0;
    }

    /// @notice Returns the total number of decisions anchored to this contract
    /// @return total The count of anchored decisions
    function getTotalAnchored() external view returns (uint256 total) {
        return _totalAnchored;
    }

    // ─── IReceiver (CRE DON write) ──────────────────────────────────────────

    /// @notice Called by CRE DON nodes to anchor a decision via a signed report.
    /// @dev The `metadata` parameter is unused but required by the IReceiver interface.
    ///      `rawReport` contains ABI-encoded (decisionId, hash, signature, riskJson).
    function onReport(bytes calldata, bytes calldata rawReport) external {
        (
            string memory decisionId,
            bytes32 hash,
            string memory signature,
            string memory riskJson
        ) = abi.decode(rawReport, (string, bytes32, string, string));

        _anchorDecision(decisionId, hash, signature, riskJson);
    }

    /// @inheritdoc IReceiver
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IReceiver).interfaceId;
    }

    // ─── Internal ───────────────────────────────────────────────────────────

    function _anchorDecision(
        string memory decisionId,
        bytes32 hash,
        string memory signature,
        string memory riskJson
    ) internal {
        if (bytes(decisionId).length == 0) revert AuditAnchor__EmptyDecisionId();
        if (anchors[decisionId].timestamp != 0) revert AuditAnchor__AlreadyAnchored(decisionId);
        if (hash == bytes32(0)) revert AuditAnchor__EmptyHash();
        if (bytes(signature).length == 0) revert AuditAnchor__EmptySignature();

        anchors[decisionId] = Anchor({
            hash: hash,
            signature: signature,
            riskJson: riskJson,
            timestamp: block.timestamp,
            anchorer: msg.sender
        });

        unchecked {
            _totalAnchored++;
        }

        emit DecisionAnchored(decisionId, hash, block.timestamp);
    }
}
