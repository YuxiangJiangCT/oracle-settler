// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {PredictionMarket} from "../src/PredictionMarket.sol";

contract PredictionMarketTest is Test {
    PredictionMarket public market;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address charlie = makeAddr("charlie");

    // Deploy with address(this) as forwarder so we can call onReport directly
    function setUp() public {
        market = new PredictionMarket(address(this));

        // Set this test contract as the forwarder so onReport calls succeed
        market.setForwarderAddress(address(this));

        // Fund test users
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

    function _buildSettlementReport(
        uint256 marketId,
        uint8 outcome,
        uint16 confidence,
        uint256 settledPrice
    ) internal pure returns (bytes memory) {
        // Prefix 0x01 + abi.encode(marketId, outcome, confidence, settledPrice)
        return abi.encodePacked(
            bytes1(0x01),
            abi.encode(marketId, outcome, confidence, settledPrice)
        );
    }

    function _settleViaReport(uint256 marketId, uint8 outcome, uint16 confidence, uint256 settledPrice) internal {
        bytes memory report = _buildSettlementReport(marketId, outcome, confidence, settledPrice);
        bytes memory metadata = "";
        market.onReport(metadata, report);
    }

    // ================================================================
    //  MARKET CREATION (4 tests)
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
    }

    function test_createMarket_incrementsId() public {
        uint256 id0 = market.createMarket("Q1", "bitcoin", 50000e6);
        uint256 id1 = market.createMarket("Q2", "ethereum", 10000e6);

        assertEq(id0, 0);
        assertEq(id1, 1);
        assertEq(market.getNextMarketId(), 2);
    }

    function test_createMarket_emitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit PredictionMarket.MarketCreated(0, "Will BTC moon?", "bitcoin", 100000e6, address(this));

        market.createMarket("Will BTC moon?", "bitcoin", 100000e6);
    }

    function test_createMarket_viaCRE() public {
        // Create market via onReport with no prefix → routes to createMarket
        bytes memory report = abi.encode("Will SOL hit $200?", "solana", uint256(200e6));
        bytes memory metadata = "";
        market.onReport(metadata, report);

        PredictionMarket.Market memory m = market.getMarket(0);
        assertEq(m.question, "Will SOL hit $200?");
        assertEq(m.asset, "solana");
        assertEq(m.targetPrice, 200e6);
    }

    // ================================================================
    //  PREDICTIONS (6 tests)
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

        // Add a bet so the market has a pool
        vm.prank(alice);
        market.predict{value: 1 ether}(0, PredictionMarket.Prediction.Yes);

        // Settle it
        _settleViaReport(0, 0, 100, 65000e6); // Yes wins

        // Try to predict after settlement
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

        _settleViaReport(0, 0, 95, 65000e6); // outcome=Yes, confidence=95%

        PredictionMarket.Market memory m = market.getMarket(0);
        assertTrue(m.settled);
        assertEq(m.confidence, 95);
        assertEq(uint8(m.outcome), 0); // Yes
        assertEq(m.settledPrice, 65000e6);
        assertGt(m.settledAt, 0);
    }

    function test_settle_revertsIfAlreadySettled() public {
        _createDefaultMarket();
        _settleViaReport(0, 0, 100, 65000e6);

        // Try to settle again
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
    //  CLAIMS (5 tests)
    // ================================================================

    function test_claim_winnerGetsFullPool() public {
        _createDefaultMarket();

        // Alice bets YES 1 ETH, Bob bets NO 2 ETH
        vm.prank(alice);
        market.predict{value: 1 ether}(0, PredictionMarket.Prediction.Yes);
        vm.prank(bob);
        market.predict{value: 2 ether}(0, PredictionMarket.Prediction.No);

        // Settle: YES wins
        _settleViaReport(0, 0, 100, 65000e6);

        // Alice is the only YES bettor — she gets the entire pool (3 ETH)
        uint256 balBefore = alice.balance;
        vm.prank(alice);
        market.claim(0);
        uint256 balAfter = alice.balance;

        assertEq(balAfter - balBefore, 3 ether);
    }

    function test_claim_proportionalPayout() public {
        _createDefaultMarket();

        // Alice bets YES 1 ETH, Charlie bets YES 2 ETH, Bob bets NO 3 ETH
        vm.prank(alice);
        market.predict{value: 1 ether}(0, PredictionMarket.Prediction.Yes);
        vm.prank(charlie);
        market.predict{value: 2 ether}(0, PredictionMarket.Prediction.Yes);
        vm.prank(bob);
        market.predict{value: 3 ether}(0, PredictionMarket.Prediction.No);

        // Settle: YES wins, total pool = 6 ETH, YES pool = 3 ETH
        _settleViaReport(0, 0, 100, 65000e6);

        // Alice: 1/3 * 6 = 2 ETH
        uint256 aliceBefore = alice.balance;
        vm.prank(alice);
        market.claim(0);
        assertEq(alice.balance - aliceBefore, 2 ether);

        // Charlie: 2/3 * 6 = 4 ETH
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

        // Settle: NO wins
        _settleViaReport(0, 1, 100, 40000e6);

        // Alice bet YES but NO won
        vm.prank(alice);
        vm.expectRevert(PredictionMarket.NothingToClaim.selector);
        market.claim(0);
    }

    // ================================================================
    //  EDGE CASES (3 tests)
    // ================================================================

    function test_settle_setsAllFields() public {
        _createDefaultMarket();
        _settleViaReport(0, 1, 87, 48500e6); // No wins, 87% confidence, price=$48,500

        PredictionMarket.Market memory m = market.getMarket(0);
        assertTrue(m.settled);
        assertEq(m.confidence, 87);
        assertEq(uint8(m.outcome), 1); // No
        assertEq(m.settledPrice, 48500e6);
        assertEq(m.settledAt, block.timestamp);
    }

    function test_onReport_rejectsUnauthorizedCaller() public {
        // Set forwarder to a specific address (not alice)
        market.setForwarderAddress(address(0xBEEF));

        bytes memory report = abi.encode("Q?", "bitcoin", uint256(50000e6));

        // Alice tries to call onReport — should fail
        vm.prank(alice);
        vm.expectRevert();
        market.onReport("", report);
    }

    function test_requestSettlement_revertsIfNotExist() public {
        vm.expectRevert(PredictionMarket.MarketDoesNotExist.selector);
        market.requestSettlement(999);
    }
}
