// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {AuditAnchor} from "../src/AuditAnchor.sol";

contract AuditAnchorTest is Test {
    AuditAnchor public anchor;

    // Mirror the event so we can emit it in vm.expectEmit checks
    event DecisionAnchored(
        string indexed decisionId,
        bytes32 indexed hash,
        uint256 timestamp
    );

    // Test fixtures
    string constant DECISION_ID = "01HQTEST123456789ABCDEFGHI";
    bytes32 constant HASH = keccak256(abi.encodePacked("sha256:abc123def456"));
    string constant SIGNATURE = "base64SignatureHere==";
    string constant RISK_JSON = '{"riskLevel":"HIGH","summary":"High risk loan application"}';

    address constant ANCHORER = address(0xBEEF);

    function setUp() public {
        anchor = new AuditAnchor();
    }

    // ─── anchorDecision ────────────────────────────────────────────────────────

    function test_AnchorDecision_Success() public {
        vm.prank(ANCHORER);
        anchor.anchorDecision(DECISION_ID, HASH, SIGNATURE, RISK_JSON);

        AuditAnchor.Anchor memory a = anchor.getAnchor(DECISION_ID);

        assertEq(a.hash, HASH);
        assertEq(a.signature, SIGNATURE);
        assertEq(a.riskJson, RISK_JSON);
        assertEq(a.anchorer, ANCHORER);
        assertGt(a.timestamp, 0);
    }

    function test_AnchorDecision_EmitsEvent() public {
        vm.expectEmit(false, true, false, true);
        emit DecisionAnchored(DECISION_ID, HASH, block.timestamp);

        anchor.anchorDecision(DECISION_ID, HASH, SIGNATURE, RISK_JSON);
    }

    function test_AnchorDecision_IncrementsTotalAnchored() public {
        assertEq(anchor.getTotalAnchored(), 0);

        anchor.anchorDecision(DECISION_ID, HASH, SIGNATURE, RISK_JSON);
        assertEq(anchor.getTotalAnchored(), 1);

        anchor.anchorDecision("01HQTEST_SECOND", HASH, SIGNATURE, RISK_JSON);
        assertEq(anchor.getTotalAnchored(), 2);
    }

    function test_AnchorDecision_SetsIsAnchored() public {
        assertFalse(anchor.isAnchored(DECISION_ID));

        anchor.anchorDecision(DECISION_ID, HASH, SIGNATURE, RISK_JSON);

        assertTrue(anchor.isAnchored(DECISION_ID));
    }

    function test_AnchorDecision_SetsTimestamp() public {
        uint256 ts = 1_700_000_000;
        vm.warp(ts);

        anchor.anchorDecision(DECISION_ID, HASH, SIGNATURE, RISK_JSON);

        AuditAnchor.Anchor memory a = anchor.getAnchor(DECISION_ID);
        assertEq(a.timestamp, ts);
    }

    function test_AnchorDecision_RecordsAnchorer() public {
        vm.prank(ANCHORER);
        anchor.anchorDecision(DECISION_ID, HASH, SIGNATURE, RISK_JSON);

        AuditAnchor.Anchor memory a = anchor.getAnchor(DECISION_ID);
        assertEq(a.anchorer, ANCHORER);
    }

    function test_AnchorDecision_AcceptsEmptyRiskJson() public {
        anchor.anchorDecision(DECISION_ID, HASH, SIGNATURE, "");

        AuditAnchor.Anchor memory a = anchor.getAnchor(DECISION_ID);
        assertEq(a.riskJson, "");
    }

    // ─── Duplicate rejection ───────────────────────────────────────────────────

    function test_AnchorDecision_RevertsOnDuplicate() public {
        anchor.anchorDecision(DECISION_ID, HASH, SIGNATURE, RISK_JSON);

        vm.expectRevert(
            abi.encodeWithSelector(AuditAnchor.AuditAnchor__AlreadyAnchored.selector, DECISION_ID)
        );
        anchor.anchorDecision(DECISION_ID, HASH, SIGNATURE, RISK_JSON);
    }

    function test_AnchorDecision_RevertsOnDuplicate_DifferentCaller() public {
        anchor.anchorDecision(DECISION_ID, HASH, SIGNATURE, RISK_JSON);

        vm.prank(address(0xDEAD));
        vm.expectRevert(
            abi.encodeWithSelector(AuditAnchor.AuditAnchor__AlreadyAnchored.selector, DECISION_ID)
        );
        anchor.anchorDecision(DECISION_ID, HASH, SIGNATURE, RISK_JSON);
    }

    // ─── Input validation ─────────────────────────────────────────────────────

    function test_AnchorDecision_RevertsOnEmptyDecisionId() public {
        vm.expectRevert(AuditAnchor.AuditAnchor__EmptyDecisionId.selector);
        anchor.anchorDecision("", HASH, SIGNATURE, RISK_JSON);
    }

    function test_AnchorDecision_RevertsOnZeroHash() public {
        vm.expectRevert(AuditAnchor.AuditAnchor__EmptyHash.selector);
        anchor.anchorDecision(DECISION_ID, bytes32(0), SIGNATURE, RISK_JSON);
    }

    function test_AnchorDecision_RevertsOnEmptySignature() public {
        vm.expectRevert(AuditAnchor.AuditAnchor__EmptySignature.selector);
        anchor.anchorDecision(DECISION_ID, HASH, "", RISK_JSON);
    }

    // ─── getAnchor ────────────────────────────────────────────────────────────

    function test_GetAnchor_ReturnsZeroValuesForNonExistent() public view {
        AuditAnchor.Anchor memory a = anchor.getAnchor("nonexistent-id");

        assertEq(a.hash, bytes32(0));
        assertEq(a.timestamp, 0);
        assertEq(a.anchorer, address(0));
    }

    function test_GetAnchor_ReturnsCorrectRecord() public {
        anchor.anchorDecision(DECISION_ID, HASH, SIGNATURE, RISK_JSON);

        AuditAnchor.Anchor memory a = anchor.getAnchor(DECISION_ID);
        assertEq(a.hash, HASH);
        assertEq(a.signature, SIGNATURE);
        assertEq(a.riskJson, RISK_JSON);
    }

    // ─── isAnchored ───────────────────────────────────────────────────────────

    function test_IsAnchored_ReturnsFalseBeforeAnchor() public view {
        assertFalse(anchor.isAnchored(DECISION_ID));
    }

    function test_IsAnchored_ReturnsTrueAfterAnchor() public {
        anchor.anchorDecision(DECISION_ID, HASH, SIGNATURE, RISK_JSON);
        assertTrue(anchor.isAnchored(DECISION_ID));
    }

    // ─── getTotalAnchored ─────────────────────────────────────────────────────

    function test_GetTotalAnchored_StartsAtZero() public view {
        assertEq(anchor.getTotalAnchored(), 0);
    }

    function test_GetTotalAnchored_IncrementsCorrectly() public {
        for (uint256 i = 0; i < 10; i++) {
            anchor.anchorDecision(
                string(abi.encodePacked("decision-", vm.toString(i))),
                keccak256(abi.encodePacked(i)),
                SIGNATURE,
                ""
            );
        }
        assertEq(anchor.getTotalAnchored(), 10);
    }

    // ─── Fuzz tests ───────────────────────────────────────────────────────────

    function testFuzz_AnchorDecision_UniqueIds(string calldata id1, string calldata id2) public {
        vm.assume(bytes(id1).length > 0 && bytes(id2).length > 0);
        vm.assume(keccak256(bytes(id1)) != keccak256(bytes(id2)));

        bytes32 h1 = keccak256(abi.encodePacked("hash1"));
        bytes32 h2 = keccak256(abi.encodePacked("hash2"));

        anchor.anchorDecision(id1, h1, SIGNATURE, "");
        anchor.anchorDecision(id2, h2, SIGNATURE, "");

        assertEq(anchor.getTotalAnchored(), 2);
        assertTrue(anchor.isAnchored(id1));
        assertTrue(anchor.isAnchored(id2));
    }

    function testFuzz_AnchorDecision_PreservesHash(bytes32 hash) public {
        vm.assume(hash != bytes32(0));

        anchor.anchorDecision(DECISION_ID, hash, SIGNATURE, "");

        AuditAnchor.Anchor memory a = anchor.getAnchor(DECISION_ID);
        assertEq(a.hash, hash);
    }
}
