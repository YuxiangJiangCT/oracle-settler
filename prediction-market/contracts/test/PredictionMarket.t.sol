// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {PredictionMarket} from "../src/PredictionMarket.sol";
import {IWorldID} from "../src/interfaces/IWorldID.sol";

contract PredictionMarketTest is Test {
    PredictionMarket public market;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address charlie = makeAddr("charlie");

    function setUp() public {
        // World ID disabled (address(0)) for base tests
        market = new PredictionMarket(address(this), IWorldID(address(0)), "", "");
        market.setForwarderAddress(address(this));

        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
        vm.deal(charlie, 10 ether);
    }

    // ================================================================
    //  HELPERS
    // ================================================================

    function _createDefaultMarket() internal returns (uint256) {
        return market.createMarket("Will BTC be above $50,000?", "bitcoin", 50000e6);
    }

    function _createMarketWithDeadline(uint48 deadline) internal returns (uint256) {
        return market.createMarketWithDeadline("Will BTC be above $50,000?", "bitcoin", 50000e6, deadline);
    }

    function _buildSettlementReport(
        uint256 marketId,
        uint8 outcome,
        uint16 confidence,
        uint256 settledPrice
    ) internal pure returns (bytes memory) {
        return abi.encodePacked(
            bytes1(0x01),
            abi.encode(marketId, outcome, confidence, settledPrice)
        );
    }

    function _settleViaReport(uint256 marketId, uint8 outcome, uint16 confidence, uint256 settledPrice) internal {
        bytes memory report = _buildSettlementReport(marketId, outcome, confidence, settledPrice);
        market.onReport("", report);
    }

    // ================================================================
    //  MARKET CREATION (5 tests)
    // ================================================================

    function test_createMarket_succeeds() public {
        uint256 id = _createDefaultMarket();
        assertEq(id, 0);

        PredictionMarket.Market memory m = market.getMarket(0);
        assertEq(m.creator, address(this));
        assertEq(m.question, "Will BTC be above $50,000?");
        assertEq(m.asset, "bitcoin");
        assertEq(m.targetPrice, 50000e6);
        assertFalse(m.settled);
        assertEq(m.totalYesPool, 0);
        assertEq(m.totalNoPool, 0);
        assertEq(m.deadline, uint48(block.timestamp) + 7 days);
    }

    function test_createMarket_incrementsId() public {
        uint256 id0 = market.createMarket("Q1", "bitcoin", 50000e6);
        uint256 id1 = market.createMarket("Q2", "ethereum", 10000e6);

        assertEq(id0, 0);
        assertEq(id1, 1);
        assertEq(market.getNextMarketId(), 2);
    }

    function test_createMarket_emitsEvent() public {
        uint48 expectedDeadline = uint48(block.timestamp) + 7 days;
        vm.expectEmit(true, false, false, true);
        emit PredictionMarket.MarketCreated(0, "Will BTC moon?", "bitcoin", 100000e6, expectedDeadline, address(this));

        market.createMarket("Will BTC moon?", "bitcoin", 100000e6);
    }

    function test_createMarket_viaCRE() public {
        bytes memory report = abi.encode("Will SOL hit $200?", "solana", uint256(200e6));
        market.onReport("", report);

        PredictionMarket.Market memory m = market.getMarket(0);
        assertEq(m.question, "Will SOL hit $200?");
        assertEq(m.asset, "solana");
        assertEq(m.targetPrice, 200e6);
    }

    function test_createMarketWithDeadline() public {
        uint48 customDeadline = uint48(block.timestamp) + 30 days;
        uint256 id = market.createMarketWithDeadline("Custom?", "bitcoin", 50000e6, customDeadline);

        PredictionMarket.Market memory m = market.getMarket(id);
        assertEq(m.deadline, customDeadline);
    }

    // ================================================================
    //  PREDICTIONS (8 tests)
    // ================================================================

    function test_predict_yes() public {
        _createDefaultMarket();

        vm.prank(alice);
        market.predict{value: 1 ether}(0, PredictionMarket.Prediction.Yes);

        PredictionMarket.Market memory m = market.getMarket(0);
        assertEq(m.totalYesPool, 1 ether);
        assertEq(m.totalNoPool, 0);

        PredictionMarket.UserPrediction memory up = market.getPrediction(0, alice);
        assertEq(up.amount, 1 ether);
        assertEq(uint8(up.prediction), uint8(PredictionMarket.Prediction.Yes));
    }

    function test_predict_no() public {
        _createDefaultMarket();

        vm.prank(bob);
        market.predict{value: 2 ether}(0, PredictionMarket.Prediction.No);

        PredictionMarket.Market memory m = market.getMarket(0);
        assertEq(m.totalYesPool, 0);
        assertEq(m.totalNoPool, 2 ether);
    }

    function test_predict_revertsIfMarketNotExist() public {
        vm.prank(alice);
        vm.expectRevert(PredictionMarket.MarketDoesNotExist.selector);
        market.predict{value: 1 ether}(999, PredictionMarket.Prediction.Yes);
    }

    function test_predict_revertsIfSettled() public {
        _createDefaultMarket();

        vm.prank(alice);
        market.predict{value: 1 ether}(0, PredictionMarket.Prediction.Yes);

        _settleViaReport(0, 0, 100, 65000e6);

        vm.prank(bob);
        vm.expectRevert(PredictionMarket.MarketAlreadySettled.selector);
        market.predict{value: 1 ether}(0, PredictionMarket.Prediction.No);
    }

    function test_predict_revertsIfZeroValue() public {
        _createDefaultMarket();

        vm.prank(alice);
        vm.expectRevert(PredictionMarket.InvalidAmount.selector);
        market.predict{value: 0}(0, PredictionMarket.Prediction.Yes);
    }

    function test_predict_revertsIfAlreadyPredicted() public {
        _createDefaultMarket();

        vm.prank(alice);
        market.predict{value: 1 ether}(0, PredictionMarket.Prediction.Yes);

        vm.prank(alice);
        vm.expectRevert(PredictionMarket.AlreadyPredicted.selector);
        market.predict{value: 1 ether}(0, PredictionMarket.Prediction.No);
    }

    function test_predict_revertsAfterDeadline() public {
        uint48 deadline = uint48(block.timestamp) + 1 days;
        _createMarketWithDeadline(deadline);

        vm.warp(deadline + 1);

        vm.prank(alice);
        vm.expectRevert(PredictionMarket.MarketExpired.selector);
        market.predict{value: 1 ether}(0, PredictionMarket.Prediction.Yes);
    }

    function test_predict_succeedsBeforeDeadline() public {
        uint48 deadline = uint48(block.timestamp) + 1 days;
        _createMarketWithDeadline(deadline);

        vm.warp(deadline - 1);

        vm.prank(alice);
        market.predict{value: 1 ether}(0, PredictionMarket.Prediction.Yes);

        PredictionMarket.Market memory m = market.getMarket(0);
        assertEq(m.totalYesPool, 1 ether);
    }

    // ================================================================
    //  SETTLEMENT (4 tests)
    // ================================================================

    function test_requestSettlement_emitsEvent() public {
        _createDefaultMarket();

        vm.expectEmit(true, false, false, true);
        emit PredictionMarket.SettlementRequested(0, "Will BTC be above $50,000?");

        market.requestSettlement(0);
    }

    function test_settleMarket_viaCRE() public {
        _createDefaultMarket();

        _settleViaReport(0, 0, 95, 65000e6);

        PredictionMarket.Market memory m = market.getMarket(0);
        assertTrue(m.settled);
        assertEq(m.confidence, 95);
        assertEq(uint8(m.outcome), 0);
        assertEq(m.settledPrice, 65000e6);
        assertGt(m.settledAt, 0);
    }

    function test_settle_revertsIfAlreadySettled() public {
        _createDefaultMarket();
        _settleViaReport(0, 0, 100, 65000e6);

        bytes memory report = _buildSettlementReport(0, 1, 100, 40000e6);
        vm.expectRevert(PredictionMarket.MarketAlreadySettled.selector);
        market.onReport("", report);
    }

    function test_settle_revertsIfNotExist() public {
        bytes memory report = _buildSettlementReport(999, 0, 100, 65000e6);
        vm.expectRevert(PredictionMarket.MarketDoesNotExist.selector);
        market.onReport("", report);
    }

    // ================================================================
    //  CLAIMS (6 tests)
    // ================================================================

    function test_claim_winnerGetsFullPool() public {
        _createDefaultMarket();

        vm.prank(alice);
        market.predict{value: 1 ether}(0, PredictionMarket.Prediction.Yes);
        vm.prank(bob);
        market.predict{value: 2 ether}(0, PredictionMarket.Prediction.No);

        _settleViaReport(0, 0, 100, 65000e6);

        uint256 balBefore = alice.balance;
        vm.prank(alice);
        market.claim(0);
        assertEq(alice.balance - balBefore, 3 ether);
    }

    function test_claim_proportionalPayout() public {
        _createDefaultMarket();

        vm.prank(alice);
        market.predict{value: 1 ether}(0, PredictionMarket.Prediction.Yes);
        vm.prank(charlie);
        market.predict{value: 2 ether}(0, PredictionMarket.Prediction.Yes);
        vm.prank(bob);
        market.predict{value: 3 ether}(0, PredictionMarket.Prediction.No);

        _settleViaReport(0, 0, 100, 65000e6);

        uint256 aliceBefore = alice.balance;
        vm.prank(alice);
        market.claim(0);
        assertEq(alice.balance - aliceBefore, 2 ether);

        uint256 charlieBefore = charlie.balance;
        vm.prank(charlie);
        market.claim(0);
        assertEq(charlie.balance - charlieBefore, 4 ether);
    }

    function test_claim_revertsIfNotSettled() public {
        _createDefaultMarket();

        vm.prank(alice);
        market.predict{value: 1 ether}(0, PredictionMarket.Prediction.Yes);

        vm.prank(alice);
        vm.expectRevert(PredictionMarket.MarketNotSettled.selector);
        market.claim(0);
    }

    function test_claim_revertsIfAlreadyClaimed() public {
        _createDefaultMarket();

        vm.prank(alice);
        market.predict{value: 1 ether}(0, PredictionMarket.Prediction.Yes);

        _settleViaReport(0, 0, 100, 65000e6);

        vm.prank(alice);
        market.claim(0);

        vm.prank(alice);
        vm.expectRevert(PredictionMarket.AlreadyClaimed.selector);
        market.claim(0);
    }

    function test_claim_revertsIfLoser() public {
        _createDefaultMarket();

        vm.prank(alice);
        market.predict{value: 1 ether}(0, PredictionMarket.Prediction.Yes);
        vm.prank(bob);
        market.predict{value: 1 ether}(0, PredictionMarket.Prediction.No);

        _settleViaReport(0, 1, 100, 40000e6);

        vm.prank(alice);
        vm.expectRevert(PredictionMarket.NothingToClaim.selector);
        market.claim(0);
    }

    function test_claim_revertsOnCancelledMarket() public {
        _createDefaultMarket();

        vm.prank(alice);
        market.predict{value: 1 ether}(0, PredictionMarket.Prediction.Yes);

        market.cancelMarket(0);

        vm.prank(alice);
        vm.expectRevert(PredictionMarket.MarketNotCancelled.selector);
        market.claim(0);
    }

    // ================================================================
    //  CANCEL + REFUND (4 tests)
    // ================================================================

    function test_cancelMarket_succeeds() public {
        _createDefaultMarket();

        vm.prank(alice);
        market.predict{value: 1 ether}(0, PredictionMarket.Prediction.Yes);

        market.cancelMarket(0);

        PredictionMarket.Market memory m = market.getMarket(0);
        assertTrue(m.settled);
        assertEq(m.confidence, 0);
    }

    function test_cancelMarket_revertsIfNotCreator() public {
        _createDefaultMarket();

        vm.prank(alice);
        vm.expectRevert(PredictionMarket.Unauthorized.selector);
        market.cancelMarket(0);
    }

    function test_cancelMarket_revertsIfSettled() public {
        _createDefaultMarket();
        _settleViaReport(0, 0, 100, 65000e6);

        vm.expectRevert(PredictionMarket.MarketAlreadySettled.selector);
        market.cancelMarket(0);
    }

    function test_refund_afterCancel() public {
        _createDefaultMarket();

        vm.prank(alice);
        market.predict{value: 1 ether}(0, PredictionMarket.Prediction.Yes);
        vm.prank(bob);
        market.predict{value: 2 ether}(0, PredictionMarket.Prediction.No);

        market.cancelMarket(0);

        uint256 aliceBefore = alice.balance;
        vm.prank(alice);
        market.refund(0);
        assertEq(alice.balance - aliceBefore, 1 ether);

        uint256 bobBefore = bob.balance;
        vm.prank(bob);
        market.refund(0);
        assertEq(bob.balance - bobBefore, 2 ether);
    }

    // ================================================================
    //  EDGE CASES (4 tests)
    // ================================================================

    function test_settle_setsAllFields() public {
        _createDefaultMarket();
        _settleViaReport(0, 1, 87, 48500e6);

        PredictionMarket.Market memory m = market.getMarket(0);
        assertTrue(m.settled);
        assertEq(m.confidence, 87);
        assertEq(uint8(m.outcome), 1);
        assertEq(m.settledPrice, 48500e6);
        assertEq(m.settledAt, block.timestamp);
    }

    function test_onReport_rejectsUnauthorizedCaller() public {
        market.setForwarderAddress(address(0xBEEF));

        bytes memory report = abi.encode("Q?", "bitcoin", uint256(50000e6));

        vm.prank(alice);
        vm.expectRevert();
        market.onReport("", report);
    }

    function test_requestSettlement_revertsIfNotExist() public {
        vm.expectRevert(PredictionMarket.MarketDoesNotExist.selector);
        market.requestSettlement(999);
    }

    function test_multipleMarkets_isolation() public {
        uint256 id0 = market.createMarket("Q1", "bitcoin", 50000e6);
        uint256 id1 = market.createMarket("Q2", "ethereum", 10000e6);

        vm.prank(alice);
        market.predict{value: 1 ether}(id0, PredictionMarket.Prediction.Yes);
        vm.prank(bob);
        market.predict{value: 2 ether}(id1, PredictionMarket.Prediction.No);

        _settleViaReport(id0, 0, 100, 65000e6);

        PredictionMarket.Market memory m0 = market.getMarket(id0);
        PredictionMarket.Market memory m1 = market.getMarket(id1);

        assertTrue(m0.settled);
        assertFalse(m1.settled);
        assertEq(m0.totalYesPool, 1 ether);
        assertEq(m1.totalNoPool, 2 ether);
    }

    // ================================================================
    //  FUZZ TESTS (1 test)
    // ================================================================

    function testFuzz_claim_proportionalPayout(uint96 aliceBet, uint96 bobBet) public {
        vm.assume(aliceBet > 0.001 ether && aliceBet < 100 ether);
        vm.assume(bobBet > 0.001 ether && bobBet < 100 ether);

        vm.deal(alice, uint256(aliceBet) + 1 ether);
        vm.deal(bob, uint256(bobBet) + 1 ether);

        _createDefaultMarket();

        vm.prank(alice);
        market.predict{value: aliceBet}(0, PredictionMarket.Prediction.Yes);
        vm.prank(bob);
        market.predict{value: bobBet}(0, PredictionMarket.Prediction.No);

        _settleViaReport(0, 0, 100, 65000e6);

        uint256 totalPool = uint256(aliceBet) + uint256(bobBet);

        uint256 balBefore = alice.balance;
        vm.prank(alice);
        market.claim(0);
        // Alice is only YES bettor so she gets the entire pool
        assertEq(alice.balance - balBefore, totalPool);
    }

    // ================================================================
    //  WORLD ID TESTS (3 tests)
    // ================================================================

    function test_createMarketVerified_worksWhenWorldIdDisabled() public {
        // worldId == address(0) in setUp, so verification is skipped
        uint256[8] memory emptyProof;
        uint256 id = market.createMarketVerified("Q?", "bitcoin", 50000e6, 0, 0, emptyProof);
        assertEq(id, 0);

        PredictionMarket.Market memory m = market.getMarket(0);
        assertEq(m.question, "Q?");
        assertEq(m.asset, "bitcoin");
    }

    function test_worldId_immutableIsZeroWhenDisabled() public view {
        assertEq(address(market.worldId()), address(0));
    }

    function test_createMarketVerified_withMockWorldId() public {
        // Deploy a mock World ID that always passes
        MockWorldID mockWid = new MockWorldID();
        PredictionMarket verifiedMarket = new PredictionMarket(
            address(this),
            IWorldID(address(mockWid)),
            "app_test123",
            "create-market"
        );

        uint256[8] memory fakeProof;
        uint256 id = verifiedMarket.createMarketVerified("BTC test", "bitcoin", 100000e6, 123, 456, fakeProof);
        assertEq(id, 0);

        // Same nullifier should revert (duplicate)
        vm.expectRevert(PredictionMarket.DuplicateNullifier.selector);
        verifiedMarket.createMarketVerified("ETH test", "ethereum", 5000e6, 123, 456, fakeProof);
    }
}

/// @dev Mock World ID that always accepts proofs (for testing only).
contract MockWorldID {
    function verifyProof(
        uint256, uint256, uint256, uint256, uint256, uint256[8] calldata
    ) external pure {
        // Always passes — mock for testing
    }
}
