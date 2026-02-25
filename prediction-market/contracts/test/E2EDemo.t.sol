// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {PredictionMarket} from "../src/PredictionMarket.sol";
import {IWorldID} from "../src/interfaces/IWorldID.sol";

/// @title E2E Demo Test — simulates the full hackathon demo flow
/// @dev Covers: price market, event market, dispute (confirm), dispute (overturn), World ID,
///      edge cases, and the exact sequence you'd show in a live demo.
contract E2EDemoTest is Test {
    PredictionMarket public pm;

    // Actors
    address deployer;        // Contract owner / CRE forwarder
    address alice;           // Bettor (YES side)
    address bob;             // Bettor (NO side)
    address charlie;         // Disputer
    address diana;           // Late bettor / edge cases

    function setUp() public {
        deployer = address(this);
        alice = makeAddr("alice");
        bob = makeAddr("bob");
        charlie = makeAddr("charlie");
        diana = makeAddr("diana");

        // Deploy with World ID disabled
        pm = new PredictionMarket(deployer, IWorldID(address(0)), "", "");
        pm.setForwarderAddress(deployer);

        // Fund actors
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(charlie, 100 ether);
        vm.deal(diana, 100 ether);
    }

    // ================================================================
    //  HELPERS
    // ================================================================

    function _settleReport(uint256 id, uint8 outcome, uint16 confidence, uint256 price) internal {
        bytes memory report = abi.encodePacked(bytes1(0x01), abi.encode(id, outcome, confidence, price));
        pm.onReport("", report);
    }

    function _disputeReport(uint256 id, uint8 outcome, uint16 confidence, uint256 price) internal {
        bytes memory report = abi.encodePacked(bytes1(0x02), abi.encode(id, outcome, confidence, price));
        pm.onReport("", report);
    }

    // ================================================================
    //  DEMO SCENARIO 1: Complete Price Market Lifecycle
    //  "Will Bitcoin exceed $100,000?"
    //  BTC goes to $105K -> YES wins -> alice gets payout
    // ================================================================

    function test_demo1_priceMarket_fullLifecycle() public {
        console.log("=== DEMO 1: Price Market Full Lifecycle ===");

        // Step 1: Create market
        uint256 marketId = pm.createMarket("Will Bitcoin exceed $100,000?", "bitcoin", 100_000e6);
        assertEq(marketId, 0);
        console.log("  [1] Market created: ID =", marketId);

        PredictionMarket.Market memory m = pm.getMarket(marketId);
        assertEq(m.question, "Will Bitcoin exceed $100,000?");
        assertEq(m.asset, "bitcoin");
        assertEq(m.targetPrice, 100_000e6);
        assertFalse(m.settled);
        assertGt(m.deadline, block.timestamp);
        console.log("  [1] Verified: question, asset, targetPrice, deadline all correct");

        // Step 2: Alice bets YES (1 ETH)
        vm.prank(alice);
        pm.predict{value: 1 ether}(marketId, PredictionMarket.Prediction.Yes);
        console.log("  [2] Alice bet 1 ETH on YES");

        // Step 3: Bob bets NO (2 ETH)
        vm.prank(bob);
        pm.predict{value: 2 ether}(marketId, PredictionMarket.Prediction.No);
        console.log("  [3] Bob bet 2 ETH on NO");

        // Verify pool state
        m = pm.getMarket(marketId);
        assertEq(m.totalYesPool, 1 ether);
        assertEq(m.totalNoPool, 2 ether);
        console.log("  [3] Pool: YES=1 ETH, NO=2 ETH, Total=3 ETH");

        // Step 4: Request settlement
        vm.expectEmit(true, false, false, true);
        emit PredictionMarket.SettlementRequested(marketId, "Will Bitcoin exceed $100,000?");
        pm.requestSettlement(marketId);
        console.log("  [4] SettlementRequested event emitted");

        // Step 5: CRE settles — BTC at $105,000 -> YES wins, 100% confidence
        _settleReport(marketId, 0, 10000, 105_000e6);

        m = pm.getMarket(marketId);
        assertTrue(m.settled);
        assertEq(uint8(m.outcome), 0); // YES
        assertEq(m.confidence, 10000);
        assertEq(m.settledPrice, 105_000e6);
        assertGt(m.settledAt, 0);
        console.log("  [5] CRE settled: YES @ $105K, 100% confidence");

        // Step 6: Can't claim during dispute window
        vm.prank(alice);
        vm.expectRevert(PredictionMarket.DisputeWindowActive.selector);
        pm.claim(marketId);
        console.log("  [6] Claim blocked during dispute window (correct)");

        // Step 7: Wait for dispute window to close
        vm.warp(block.timestamp + 1 hours + 1);
        console.log("  [7] Warped past dispute window (1h)");

        // Step 8: Alice claims winnings
        uint256 aliceBalBefore = alice.balance;
        vm.prank(alice);
        pm.claim(marketId);
        uint256 alicePayout = alice.balance - aliceBalBefore;
        assertEq(alicePayout, 3 ether); // alice's 1 ETH of 1 ETH YES pool -> 3 ETH total
        console.log("  [8] Alice claimed:", alicePayout / 1e18, "ETH (full 3 ETH pool)");

        // Step 9: Bob cannot claim (lost)
        vm.prank(bob);
        vm.expectRevert(PredictionMarket.NothingToClaim.selector);
        pm.claim(marketId);
        console.log("  [9] Bob correctly cannot claim (lost)");

        console.log("=== DEMO 1 PASSED ===");
    }

    // ================================================================
    //  DEMO SCENARIO 2: Event Market (Non-Price)
    //  "Will GPT-5 be released before July 2026?"
    //  AI determines NO with 65% confidence
    // ================================================================

    function test_demo2_eventMarket_aiSettlement() public {
        console.log("=== DEMO 2: Event Market (AI Settlement) ===");

        // Step 1: Create event market (targetPrice = 0 -> event market)
        uint256 marketId = pm.createMarket(
            "Will GPT-5 be released before July 2026?",
            "gpt5-release",
            0  // targetPrice = 0 signals event market
        );
        console.log("  [1] Event market created: ID =", marketId);

        PredictionMarket.Market memory m = pm.getMarket(marketId);
        assertEq(m.targetPrice, 0);
        assertEq(m.asset, "gpt5-release");
        console.log("  [1] Verified: targetPrice=0 (event market), asset=gpt5-release");

        // Step 2: Place predictions
        vm.prank(alice);
        pm.predict{value: 0.5 ether}(marketId, PredictionMarket.Prediction.Yes);
        vm.prank(bob);
        pm.predict{value: 0.5 ether}(marketId, PredictionMarket.Prediction.No);
        console.log("  [2] Alice: 0.5 ETH YES, Bob: 0.5 ETH NO");

        // Step 3: CRE settles via AI — NO with 65% confidence, settledPrice = 0
        _settleReport(marketId, 1, 6500, 0); // outcome=NO, confidence=65%, price=0

        m = pm.getMarket(marketId);
        assertTrue(m.settled);
        assertEq(uint8(m.outcome), 1); // NO
        assertEq(m.confidence, 6500);
        assertEq(m.settledPrice, 0); // event markets have no price
        console.log("  [3] AI settled: NO @ 65% confidence, settledPrice=0");

        // Step 4: Bob wins, claims after dispute window
        vm.warp(block.timestamp + 1 hours + 1);

        uint256 bobBefore = bob.balance;
        vm.prank(bob);
        pm.claim(marketId);
        uint256 bobPayout = bob.balance - bobBefore;
        assertEq(bobPayout, 1 ether); // 0.5 ETH of 0.5 ETH NO -> 1 ETH total
        console.log("  [4] Bob claimed:", bobPayout / 1e18, "ETH");

        console.log("=== DEMO 2 PASSED ===");
    }

    // ================================================================
    //  DEMO SCENARIO 3: Dispute -> Confirmed (anti-spam)
    //  Original settlement correct, disputer loses stake
    // ================================================================

    function test_demo3_dispute_confirmed() public {
        console.log("=== DEMO 3: Dispute -> Confirmed ===");

        // Setup: create, bet, settle
        uint256 marketId = pm.createMarket("Will ETH exceed $5,000?", "ethereum", 5000e6);
        vm.prank(alice);
        pm.predict{value: 1 ether}(marketId, PredictionMarket.Prediction.Yes);
        vm.prank(bob);
        pm.predict{value: 1 ether}(marketId, PredictionMarket.Prediction.No);
        _settleReport(marketId, 0, 10000, 5500e6); // YES @ $5.5K
        console.log("  [1] Market settled: YES @ $5,500, 100%");

        // Step 2: Charlie files dispute
        vm.prank(charlie);
        pm.disputeMarket{value: 0.001 ether}(marketId);

        PredictionMarket.Dispute memory d = pm.getDispute(marketId);
        assertEq(d.disputer, charlie);
        assertEq(d.stake, 0.001 ether);
        assertFalse(d.resolved);
        console.log("  [2] Charlie filed dispute (0.001 ETH stake)");

        // Step 3: Claims blocked during active dispute
        vm.warp(block.timestamp + 1 hours + 1); // past window but dispute active
        vm.prank(alice);
        vm.expectRevert(PredictionMarket.DisputeWindowActive.selector);
        pm.claim(marketId);
        console.log("  [3] Claims blocked during active dispute (correct)");

        // Step 4: CRE re-verifies -> confirms original (YES @ $5,500)
        uint256 charlieBalBeforeResolve = charlie.balance;
        _disputeReport(marketId, 0, 10000, 5500e6);

        d = pm.getDispute(marketId);
        assertTrue(d.resolved);
        assertFalse(d.overturned);
        console.log("  [4] Dispute resolved: CONFIRMED (original was correct)");

        // Step 5: Charlie's stake NOT refunded (anti-spam penalty)
        assertEq(charlie.balance, charlieBalBeforeResolve); // no change
        console.log("  [5] Charlie's 0.001 ETH stake forfeited (anti-spam)");

        // Step 6: Alice can now claim
        uint256 aliceBefore = alice.balance;
        vm.prank(alice);
        pm.claim(marketId);
        assertEq(alice.balance - aliceBefore, 2 ether);
        console.log("  [6] Alice claimed 2 ETH after dispute resolved");

        console.log("=== DEMO 3 PASSED ===");
    }

    // ================================================================
    //  DEMO SCENARIO 4: Dispute -> Overturned (outcome correction)
    //  CRE finds original settlement was wrong, flips to NO
    // ================================================================

    function test_demo4_dispute_overturned() public {
        console.log("=== DEMO 4: Dispute -> Overturned ===");

        // Setup: create, bet, settle wrongly
        uint256 marketId = pm.createMarket("Will SOL exceed $200?", "solana", 200e6);
        vm.prank(alice);
        pm.predict{value: 1 ether}(marketId, PredictionMarket.Prediction.Yes);
        vm.prank(bob);
        pm.predict{value: 1 ether}(marketId, PredictionMarket.Prediction.No);
        _settleReport(marketId, 0, 8000, 205e6); // YES @ $205, but let's say this was wrong
        console.log("  [1] Market settled: YES @ $205, 80% confidence");

        // Step 2: Charlie disputes
        vm.prank(charlie);
        pm.disputeMarket{value: 0.001 ether}(marketId);
        console.log("  [2] Charlie filed dispute");

        // Step 3: CRE re-verifies -> overturns to NO @ $195
        uint256 charlieBefore = charlie.balance;
        _disputeReport(marketId, 1, 9500, 195e6); // outcome flipped to NO

        PredictionMarket.Dispute memory d = pm.getDispute(marketId);
        assertTrue(d.resolved);
        assertTrue(d.overturned);
        console.log("  [3] Dispute resolved: OVERTURNED -> NO @ $195, 95%");

        // Step 4: Charlie's stake refunded
        assertEq(charlie.balance, charlieBefore + 0.001 ether);
        console.log("  [4] Charlie's 0.001 ETH stake refunded");

        // Step 5: Market outcome updated
        PredictionMarket.Market memory m = pm.getMarket(marketId);
        assertEq(uint8(m.outcome), 1); // now NO
        assertEq(m.confidence, 9500);
        assertEq(m.settledPrice, 195e6);
        console.log("  [5] Market now: NO @ $195, 95% confidence");

        // Step 6: Bob (NO) can now claim, Alice (YES) cannot
        vm.warp(block.timestamp + 1 hours + 1);

        uint256 bobBefore = bob.balance;
        vm.prank(bob);
        pm.claim(marketId);
        assertEq(bob.balance - bobBefore, 2 ether);
        console.log("  [6] Bob claimed 2 ETH (was NO, now wins)");

        vm.prank(alice);
        vm.expectRevert(PredictionMarket.NothingToClaim.selector);
        pm.claim(marketId);
        console.log("  [6] Alice correctly cannot claim (was YES, now loses)");

        console.log("=== DEMO 4 PASSED ===");
    }

    // ================================================================
    //  DEMO SCENARIO 5: CRE Auto-Create Market via onReport
    //  Simulates CRE creating a market autonomously
    // ================================================================

    function test_demo5_creAutoCreateMarket() public {
        console.log("=== DEMO 5: CRE Auto-Create Market ===");

        // CRE sends a report with no prefix (0x00 route -> createMarket)
        bytes memory report = abi.encode(
            "Will Dogecoin reach $1?",
            "dogecoin",
            uint256(1e6) // $1 in 6 decimals
        );
        pm.onReport("", report);

        PredictionMarket.Market memory m = pm.getMarket(0);
        assertEq(m.question, "Will Dogecoin reach $1?");
        assertEq(m.asset, "dogecoin");
        assertEq(m.targetPrice, 1e6);
        assertEq(m.creator, deployer); // creator = forwarder (known limitation)
        console.log("  [1] CRE created market: 'Will Dogecoin reach $1?'");
        console.log("  [1] Creator = forwarder address (known limitation, documented)");

        console.log("=== DEMO 5 PASSED ===");
    }

    // ================================================================
    //  DEMO SCENARIO 6: World ID Verified Market Creation
    // ================================================================

    function test_demo6_worldIdVerifiedCreation() public {
        console.log("=== DEMO 6: World ID Verified Creation ===");

        // World ID disabled (address(0)), so verification is skipped
        uint256[8] memory emptyProof;
        uint256 marketId = pm.createMarketVerified(
            "Will AI pass the Turing test by 2027?",
            "ai-turing-test",
            0, // event market
            0, 0, emptyProof
        );

        PredictionMarket.Market memory m = pm.getMarket(marketId);
        assertEq(m.question, "Will AI pass the Turing test by 2027?");
        assertEq(m.targetPrice, 0); // event market
        console.log("  [1] Verified market created (World ID disabled in test)");

        console.log("=== DEMO 6 PASSED ===");
    }

    // ================================================================
    //  DEMO SCENARIO 7: Deadline Enforcement
    // ================================================================

    function test_demo7_deadlineEnforcement() public {
        console.log("=== DEMO 7: Deadline Enforcement ===");

        // Create market with 1 day deadline
        uint48 deadline = uint48(block.timestamp) + 1 days;
        uint256 marketId = pm.createMarketWithDeadline(
            "Short-term BTC prediction",
            "bitcoin",
            50000e6,
            deadline
        );

        // Alice bets before deadline -> ok
        vm.prank(alice);
        pm.predict{value: 1 ether}(marketId, PredictionMarket.Prediction.Yes);
        console.log("  [1] Alice bet before deadline: OK");

        // Warp past deadline
        vm.warp(deadline + 1);

        // Bob tries to bet after deadline -> reverts
        vm.prank(bob);
        vm.expectRevert(PredictionMarket.MarketExpired.selector);
        pm.predict{value: 1 ether}(marketId, PredictionMarket.Prediction.No);
        console.log("  [2] Bob bet after deadline: correctly reverted");

        // Settlement still works after deadline
        _settleReport(marketId, 0, 10000, 55000e6);
        PredictionMarket.Market memory m = pm.getMarket(marketId);
        assertTrue(m.settled);
        console.log("  [3] Settlement after deadline: OK");

        console.log("=== DEMO 7 PASSED ===");
    }

    // ================================================================
    //  DEMO SCENARIO 8: Cancel + Refund Flow
    // ================================================================

    function test_demo8_cancelAndRefund() public {
        console.log("=== DEMO 8: Cancel + Refund ===");

        uint256 marketId = pm.createMarket("Will X happen?", "test-event", 0);

        vm.prank(alice);
        pm.predict{value: 2 ether}(marketId, PredictionMarket.Prediction.Yes);
        vm.prank(bob);
        pm.predict{value: 3 ether}(marketId, PredictionMarket.Prediction.No);
        console.log("  [1] Alice: 2 ETH YES, Bob: 3 ETH NO");

        // Creator cancels
        pm.cancelMarket(marketId);
        PredictionMarket.Market memory m = pm.getMarket(marketId);
        assertTrue(m.settled);
        assertEq(m.confidence, 0); // 0 = cancelled sentinel
        console.log("  [2] Market cancelled (confidence = 0)");

        // claim() should fail on cancelled market
        vm.prank(alice);
        vm.expectRevert(PredictionMarket.MarketNotCancelled.selector);
        pm.claim(marketId);
        console.log("  [3] claim() correctly reverts on cancelled market");

        // refund() works
        uint256 aliceBefore = alice.balance;
        vm.prank(alice);
        pm.refund(marketId);
        assertEq(alice.balance - aliceBefore, 2 ether);
        console.log("  [4] Alice refunded 2 ETH");

        uint256 bobBefore = bob.balance;
        vm.prank(bob);
        pm.refund(marketId);
        assertEq(bob.balance - bobBefore, 3 ether);
        console.log("  [4] Bob refunded 3 ETH");

        // Double refund fails
        vm.prank(alice);
        vm.expectRevert(PredictionMarket.AlreadyClaimed.selector);
        pm.refund(marketId);
        console.log("  [5] Double refund correctly reverts");

        console.log("=== DEMO 8 PASSED ===");
    }

    // ================================================================
    //  DEMO SCENARIO 9: Dispute Window Timing Edge Cases
    // ================================================================

    function test_demo9_disputeTimingEdgeCases() public {
        console.log("=== DEMO 9: Dispute Timing Edge Cases ===");

        uint256 marketId = pm.createMarket("Timing test", "bitcoin", 50000e6);
        vm.prank(alice);
        pm.predict{value: 1 ether}(marketId, PredictionMarket.Prediction.Yes);
        _settleReport(marketId, 0, 10000, 55000e6);

        uint256 settledAt = pm.getMarket(marketId).settledAt;

        // Just before window closes — dispute still allowed
        vm.warp(settledAt + 1 hours - 1);
        vm.prank(charlie);
        pm.disputeMarket{value: 0.001 ether}(marketId);
        console.log("  [1] Dispute at window-1s: OK");

        // Resolve dispute so we can test window closure
        _disputeReport(marketId, 0, 10000, 55000e6);

        // Create another market to test window closure
        uint256 marketId2 = pm.createMarket("Timing test 2", "ethereum", 5000e6);
        vm.prank(alice);
        pm.predict{value: 1 ether}(marketId2, PredictionMarket.Prediction.Yes);
        _settleReport(marketId2, 0, 10000, 5500e6);

        uint256 settledAt2 = pm.getMarket(marketId2).settledAt;

        // Exactly at window close — dispute fails (> not >=)
        vm.warp(settledAt2 + 1 hours + 1);
        vm.prank(charlie);
        vm.expectRevert(PredictionMarket.DisputeWindowClosed.selector);
        pm.disputeMarket{value: 0.001 ether}(marketId2);
        console.log("  [2] Dispute at window+1s: correctly reverted");

        console.log("=== DEMO 9 PASSED ===");
    }

    // ================================================================
    //  DEMO SCENARIO 10: Multiple Markets Isolation
    //  Ensure markets don't interfere with each other
    // ================================================================

    function test_demo10_multipleMarketsIsolation() public {
        console.log("=== DEMO 10: Multiple Markets Isolation ===");

        // Create 3 different markets
        uint256 priceMarket = pm.createMarket("BTC > $80K?", "bitcoin", 80_000e6);
        uint256 eventMarket = pm.createMarket("Will Starship orbit?", "starship-orbit", 0);
        uint256 ethMarket = pm.createMarket("ETH > $4K?", "ethereum", 4000e6);
        console.log("  [1] Created 3 markets: price, event, price");

        // Different users bet on different markets
        vm.prank(alice);
        pm.predict{value: 1 ether}(priceMarket, PredictionMarket.Prediction.Yes);
        vm.prank(bob);
        pm.predict{value: 1 ether}(eventMarket, PredictionMarket.Prediction.No);
        vm.prank(charlie);
        pm.predict{value: 1 ether}(ethMarket, PredictionMarket.Prediction.Yes);
        console.log("  [2] Different users bet on different markets");

        // Settle only market 0
        _settleReport(priceMarket, 0, 10000, 85_000e6);

        // Verify isolation
        assertTrue(pm.getMarket(priceMarket).settled);
        assertFalse(pm.getMarket(eventMarket).settled);
        assertFalse(pm.getMarket(ethMarket).settled);
        console.log("  [3] Only market 0 settled, others unaffected");

        // Settle event market
        _settleReport(eventMarket, 1, 7500, 0); // NO, 75% confidence, no price

        assertTrue(pm.getMarket(eventMarket).settled);
        assertEq(pm.getMarket(eventMarket).settledPrice, 0);
        assertFalse(pm.getMarket(ethMarket).settled);
        console.log("  [4] Event market settled (NO, 75%), ETH market still active");

        console.log("=== DEMO 10 PASSED ===");
    }

    // ================================================================
    //  DEMO SCENARIO 11: Proportional Payout (multiple winners)
    // ================================================================

    function test_demo11_proportionalPayout() public {
        console.log("=== DEMO 11: Proportional Payout ===");

        uint256 marketId = pm.createMarket("Multi-winner test", "bitcoin", 50000e6);

        // 3 YES bettors, 1 NO bettor
        vm.prank(alice);
        pm.predict{value: 1 ether}(marketId, PredictionMarket.Prediction.Yes);
        vm.prank(charlie);
        pm.predict{value: 2 ether}(marketId, PredictionMarket.Prediction.Yes);
        vm.prank(diana);
        pm.predict{value: 1 ether}(marketId, PredictionMarket.Prediction.Yes);
        vm.prank(bob);
        pm.predict{value: 6 ether}(marketId, PredictionMarket.Prediction.No);
        console.log("  [1] YES: alice=1, charlie=2, diana=1 | NO: bob=6 | Total=10 ETH");

        _settleReport(marketId, 0, 10000, 60000e6); // YES wins
        vm.warp(block.timestamp + 1 hours + 1);

        // Total pool = 10 ETH, YES pool = 4 ETH
        // alice: 1/4 * 10 = 2.5 ETH
        // charlie: 2/4 * 10 = 5 ETH
        // diana: 1/4 * 10 = 2.5 ETH

        uint256 aliceBal = alice.balance;
        vm.prank(alice);
        pm.claim(marketId);
        assertEq(alice.balance - aliceBal, 2.5 ether);
        console.log("  [2] Alice claimed 2.5 ETH (1/4 of 10)");

        uint256 charlieBal = charlie.balance;
        vm.prank(charlie);
        pm.claim(marketId);
        assertEq(charlie.balance - charlieBal, 5 ether);
        console.log("  [2] Charlie claimed 5 ETH (2/4 of 10)");

        uint256 dianaBal = diana.balance;
        vm.prank(diana);
        pm.claim(marketId);
        assertEq(diana.balance - dianaBal, 2.5 ether);
        console.log("  [2] Diana claimed 2.5 ETH (1/4 of 10)");

        console.log("=== DEMO 11 PASSED ===");
    }

    // ================================================================
    //  DEMO SCENARIO 12: Dispute on Event Market (not just price)
    // ================================================================

    function test_demo12_disputeOnEventMarket() public {
        console.log("=== DEMO 12: Dispute on Event Market ===");

        uint256 marketId = pm.createMarket("Will ETH Pectra launch Q1 2026?", "eth-pectra", 0);

        vm.prank(alice);
        pm.predict{value: 1 ether}(marketId, PredictionMarket.Prediction.Yes);
        vm.prank(bob);
        pm.predict{value: 1 ether}(marketId, PredictionMarket.Prediction.No);

        // AI initially says NO with 60% confidence
        _settleReport(marketId, 1, 6000, 0);
        console.log("  [1] Event settled: NO @ 60% confidence");

        // Charlie disputes — AI was wrong, Pectra did launch
        vm.prank(charlie);
        pm.disputeMarket{value: 0.001 ether}(marketId);
        console.log("  [2] Charlie disputes (thinks AI was wrong)");

        // CRE re-verifies with stricter threshold -> overturns to YES
        _disputeReport(marketId, 0, 8500, 0); // YES, 85% confidence, no price

        PredictionMarket.Dispute memory d = pm.getDispute(marketId);
        assertTrue(d.overturned);
        console.log("  [3] Dispute OVERTURNED: YES @ 85% confidence");

        PredictionMarket.Market memory m = pm.getMarket(marketId);
        assertEq(uint8(m.outcome), 0); // YES
        assertEq(m.confidence, 8500);
        assertEq(m.settledPrice, 0); // still event market
        console.log("  [3] Market updated: outcome=YES, price=0 (event)");

        // Alice (YES) can now claim
        vm.warp(block.timestamp + 1 hours + 1);
        uint256 aliceBefore = alice.balance;
        vm.prank(alice);
        pm.claim(marketId);
        assertEq(alice.balance - aliceBefore, 2 ether);
        console.log("  [4] Alice claimed 2 ETH (dispute overturned in her favor)");

        console.log("=== DEMO 12 PASSED ===");
    }

    // ================================================================
    //  DEMO SCENARIO 13: All Error Conditions (Guard Coverage)
    // ================================================================

    function test_demo13_allErrorConditions() public {
        console.log("=== DEMO 13: Guard Condition Coverage ===");

        // MarketDoesNotExist
        vm.expectRevert(PredictionMarket.MarketDoesNotExist.selector);
        pm.requestSettlement(999);
        console.log("  [1] MarketDoesNotExist: requestSettlement(999)");

        vm.prank(alice);
        vm.expectRevert(PredictionMarket.MarketDoesNotExist.selector);
        pm.predict{value: 1 ether}(999, PredictionMarket.Prediction.Yes);
        console.log("  [2] MarketDoesNotExist: predict(999)");

        // Create and settle a market
        uint256 id = pm.createMarket("Guard test", "bitcoin", 50000e6);
        vm.prank(alice);
        pm.predict{value: 1 ether}(id, PredictionMarket.Prediction.Yes);

        // AlreadyPredicted
        vm.prank(alice);
        vm.expectRevert(PredictionMarket.AlreadyPredicted.selector);
        pm.predict{value: 1 ether}(id, PredictionMarket.Prediction.No);
        console.log("  [3] AlreadyPredicted");

        // InvalidAmount
        vm.prank(bob);
        vm.expectRevert(PredictionMarket.InvalidAmount.selector);
        pm.predict{value: 0}(id, PredictionMarket.Prediction.No);
        console.log("  [4] InvalidAmount (0 ETH)");

        // MarketAlreadySettled (predict after settle)
        vm.prank(bob);
        pm.predict{value: 1 ether}(id, PredictionMarket.Prediction.No);
        _settleReport(id, 0, 10000, 55000e6);

        vm.prank(charlie);
        vm.expectRevert(PredictionMarket.MarketAlreadySettled.selector);
        pm.predict{value: 1 ether}(id, PredictionMarket.Prediction.Yes);
        console.log("  [5] MarketAlreadySettled: predict after settle");

        // MarketAlreadySettled (settle again)
        bytes memory dupeReport = abi.encodePacked(bytes1(0x01), abi.encode(id, uint8(1), uint16(100), uint256(40000e6)));
        vm.expectRevert(PredictionMarket.MarketAlreadySettled.selector);
        pm.onReport("", dupeReport);
        console.log("  [6] MarketAlreadySettled: double settle");

        // InsufficientDisputeStake
        vm.prank(charlie);
        vm.expectRevert(PredictionMarket.InsufficientDisputeStake.selector);
        pm.disputeMarket{value: 0.0001 ether}(id);
        console.log("  [7] InsufficientDisputeStake");

        // DisputeAlreadyFiled
        vm.prank(charlie);
        pm.disputeMarket{value: 0.001 ether}(id);
        vm.prank(diana);
        vm.expectRevert(PredictionMarket.DisputeAlreadyFiled.selector);
        pm.disputeMarket{value: 0.001 ether}(id);
        console.log("  [8] DisputeAlreadyFiled");

        // NoActiveDispute (resolve without filing)
        uint256 id2 = pm.createMarket("No dispute", "bitcoin", 50000e6);
        _settleReport(id2, 0, 10000, 55000e6);
        bytes memory noDisputeReport = abi.encodePacked(bytes1(0x02), abi.encode(id2, uint8(0), uint16(10000), uint256(55000e6)));
        vm.expectRevert(PredictionMarket.NoActiveDispute.selector);
        pm.onReport("", noDisputeReport);
        console.log("  [9] NoActiveDispute: resolve without filing");

        // Unauthorized (cancel by non-creator)
        uint256 id3 = pm.createMarket("Auth test", "bitcoin", 50000e6);
        vm.prank(alice);
        vm.expectRevert(PredictionMarket.Unauthorized.selector);
        pm.cancelMarket(id3);
        console.log("  [10] Unauthorized: cancel by non-creator");

        // MarketNotSettled (dispute unsettled)
        vm.prank(charlie);
        vm.expectRevert(PredictionMarket.MarketNotSettled.selector);
        pm.disputeMarket{value: 0.001 ether}(id3);
        console.log("  [11] MarketNotSettled: dispute unsettled market");

        // MarketNotCancelled (dispute cancelled market)
        uint256 id4 = pm.createMarket("Cancel test", "bitcoin", 50000e6);
        pm.cancelMarket(id4);
        vm.prank(charlie);
        vm.expectRevert(PredictionMarket.MarketNotCancelled.selector);
        pm.disputeMarket{value: 0.001 ether}(id4);
        console.log("  [12] MarketNotCancelled: dispute cancelled market");

        console.log("=== DEMO 13 PASSED (12/12 guards tested) ===");
    }

    // ================================================================
    //  DEMO SCENARIO 14: Contract Constants & Config Verification
    // ================================================================

    function test_demo14_contractConstants() public view {
        console.log("=== DEMO 14: Contract Constants ===");

        assertEq(pm.DEFAULT_DEADLINE_DURATION(), 7 days);
        console.log("  [1] DEFAULT_DEADLINE_DURATION = 7 days");

        assertEq(pm.DISPUTE_WINDOW(), 1 hours);
        console.log("  [2] DISPUTE_WINDOW = 1 hour");

        assertEq(pm.DISPUTE_STAKE(), 0.001 ether);
        console.log("  [3] DISPUTE_STAKE = 0.001 ETH");

        assertEq(address(pm.worldId()), address(0));
        console.log("  [4] worldId = address(0) (disabled in test)");

        assertEq(pm.getNextMarketId(), 0);
        console.log("  [5] nextMarketId = 0 (no markets yet)");

        console.log("=== DEMO 14 PASSED ===");
    }

    // ================================================================
    //  DEMO SCENARIO 15: Full Demo Flow (exact sequence for video)
    //  This is the EXACT order you'd show in a 5-min demo
    // ================================================================

    function test_demo15_fullDemoSequence() public {
        console.log("");
        console.log("========================================================");
        console.log("  FULL DEMO SEQUENCE (5-minute video simulation)");
        console.log("========================================================");
        console.log("");

        // === PART 1: Price Market ===
        console.log("--- Part 1: Price Market ---");
        uint256 btcMarket = pm.createMarket("Will BTC exceed $100K?", "bitcoin", 100_000e6);
        vm.prank(alice);
        pm.predict{value: 2 ether}(btcMarket, PredictionMarket.Prediction.Yes);
        vm.prank(bob);
        pm.predict{value: 1 ether}(btcMarket, PredictionMarket.Prediction.No);
        pm.requestSettlement(btcMarket);
        _settleReport(btcMarket, 0, 10000, 105_000e6); // YES @ $105K
        console.log("  BTC market: created, bet, settled (YES @ $105K)");

        // === PART 2: Event Market ===
        console.log("--- Part 2: Event Market ---");
        uint256 gptMarket = pm.createMarket("Will GPT-5 release before July 2026?", "gpt5-release", 0);
        vm.prank(charlie);
        pm.predict{value: 1 ether}(gptMarket, PredictionMarket.Prediction.No);
        vm.prank(diana);
        pm.predict{value: 1 ether}(gptMarket, PredictionMarket.Prediction.Yes);
        _settleReport(gptMarket, 1, 7000, 0); // NO @ 70%
        console.log("  GPT-5 market: created, bet, settled (NO @ 70%)");

        // === PART 3: Dispute (the wow factor) ===
        console.log("--- Part 3: Dispute Flow ---");
        vm.prank(diana);
        pm.disputeMarket{value: 0.001 ether}(gptMarket);
        console.log("  Diana disputes GPT-5 settlement");

        // Claims locked
        vm.warp(block.timestamp + 1 hours + 1);
        vm.prank(charlie);
        vm.expectRevert(PredictionMarket.DisputeWindowActive.selector);
        pm.claim(gptMarket);
        console.log("  Claims locked during active dispute");

        // CRE re-verifies -> confirms NO
        _disputeReport(gptMarket, 1, 8500, 0);
        console.log("  CRE re-verified: confirmed NO @ 85%");

        // Charlie (NO) claims
        uint256 charlieBefore = charlie.balance;
        vm.prank(charlie);
        pm.claim(gptMarket);
        assertEq(charlie.balance - charlieBefore, 2 ether);
        console.log("  Charlie claimed 2 ETH");

        // === PART 4: Claims from price market ===
        console.log("--- Part 4: Price Market Claims ---");
        uint256 aliceBefore = alice.balance;
        vm.prank(alice);
        pm.claim(btcMarket);
        assertEq(alice.balance - aliceBefore, 3 ether);
        console.log("  Alice claimed 3 ETH from BTC market");

        // === VERIFY FINAL STATE ===
        console.log("");
        console.log("--- Final State ---");
        assertEq(pm.getNextMarketId(), 2);
        console.log("  Total markets: 2");

        PredictionMarket.Market memory btc = pm.getMarket(btcMarket);
        assertTrue(btc.settled);
        assertEq(uint8(btc.outcome), 0);
        assertGt(btc.targetPrice, 0); // price market
        console.log("  BTC: settled=YES, type=PRICE");

        PredictionMarket.Market memory gpt = pm.getMarket(gptMarket);
        assertTrue(gpt.settled);
        assertEq(uint8(gpt.outcome), 1);
        assertEq(gpt.targetPrice, 0); // event market
        console.log("  GPT-5: settled=NO, type=EVENT");

        PredictionMarket.Dispute memory d = pm.getDispute(gptMarket);
        assertTrue(d.resolved);
        assertFalse(d.overturned);
        console.log("  GPT-5 dispute: resolved, confirmed");

        console.log("");
        console.log("========================================================");
        console.log("  ALL DEMO SCENARIOS PASSED SUCCESSFULLY!");
        console.log("========================================================");
    }
}
