// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title RetentionPolicy
/// @notice On-chain registry of data retention rules per tenant.
///         Each tenant can set a retention period (in days) per decision type.
///         These policies are authoritative and enforceable by off-chain processes.
contract RetentionPolicy {
    // ─── Structs ───────────────────────────────────────────────────────────────

    /// @notice A retention rule for a specific tenant and decision type
    struct Policy {
        /// @dev Retention duration in days (0 = keep forever)
        uint32 retentionDays;
        /// @dev Unix timestamp when this policy was last updated
        uint256 updatedAt;
        /// @dev Address that set this policy
        address setter;
        /// @dev Whether this policy has been set (vs. default)
        bool exists;
    }

    // ─── State ─────────────────────────────────────────────────────────────────

    /// @notice policies[tenantId][decisionType] → Policy
    /// @dev Use empty string "" for decisionType to set a catch-all tenant policy
    mapping(bytes32 => mapping(string => Policy)) public policies;

    /// @notice Address authorized to set policies on behalf of tenants
    address public immutable OWNER;

    // ─── Events ────────────────────────────────────────────────────────────────

    /// @notice Emitted when a retention policy is created or updated
    /// @param tenantId The tenant identifier (hashed)
    /// @param decisionType The decision type this policy applies to ("" = all)
    /// @param retentionDays Number of days to retain records
    /// @param setter Address that set the policy
    event PolicySet(
        bytes32 indexed tenantId,
        string decisionType,
        uint32 retentionDays,
        address indexed setter
    );

    // ─── Errors ────────────────────────────────────────────────────────────────

    error RetentionPolicy__Unauthorized();
    error RetentionPolicy__InvalidTenantId();

    // ─── Constructor ───────────────────────────────────────────────────────────

    /// @param _owner Address authorized to manage policies
    constructor(address _owner) {
        OWNER = _owner;
    }

    // ─── Modifiers ─────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    function _onlyOwner() internal view {
        if (msg.sender != OWNER) revert RetentionPolicy__Unauthorized();
    }

    // ─── Functions ─────────────────────────────────────────────────────────────

    /// @notice Sets or updates a retention policy for a tenant and decision type
    /// @param tenantId UUID of the tenant (as bytes32, e.g. abi.encodePacked(uuid))
    /// @param decisionType Decision type this policy applies to (empty = all types)
    /// @param retentionDays Number of days to retain records (0 = forever)
    function setPolicy(
        bytes32 tenantId,
        string calldata decisionType,
        uint32 retentionDays
    ) external onlyOwner {
        if (tenantId == bytes32(0)) revert RetentionPolicy__InvalidTenantId();

        policies[tenantId][decisionType] = Policy({
            retentionDays: retentionDays,
            updatedAt: block.timestamp,
            setter: msg.sender,
            exists: true
        });

        emit PolicySet(tenantId, decisionType, retentionDays, msg.sender);
    }

    /// @notice Returns the effective retention policy for a tenant and decision type.
    ///         Falls back to the catch-all policy ("") if no specific type policy exists.
    /// @param tenantId UUID of the tenant (as bytes32)
    /// @param decisionType The decision type to check
    /// @return retentionDays The effective retention period in days (0 = forever)
    /// @return exists Whether any policy was found (false = use system default)
    function getEffectivePolicy(bytes32 tenantId, string calldata decisionType)
        external
        view
        returns (uint32 retentionDays, bool exists)
    {
        Policy memory specific = policies[tenantId][decisionType];
        if (specific.exists) {
            return (specific.retentionDays, true);
        }

        Policy memory catchAll = policies[tenantId][""];
        if (catchAll.exists) {
            return (catchAll.retentionDays, true);
        }

        return (0, false);
    }
}
