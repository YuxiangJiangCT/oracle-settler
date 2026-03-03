// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {PredictionMarket} from "../src/PredictionMarket.sol";
import {ParlayEngine} from "../src/ParlayEngine.sol";
import {IWorldID} from "../src/interfaces/IWorldID.sol";

contract ParlayEngineTest is Test {
    PredictionMarket public market;
    ParlayEngine public parlay;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address charlie = makeAddr("charlie");

    function setUp() public {
        market = new PredictionMarket(address(this), IWorldID(address(0)), "", "");
        market.setForwarderAddress(address(this));

        parlay = new ParlayEngine(address(this), address(market));
        parlay.setForwarderAddress(address(this));

        // Fund house pool
        vm.deal(address(parlay), 10 ether);
        // Fund users
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
        vm.deal(charlie, 10 ether);
    }

    // ================================================================
    //  HELPERS
    // ================================================================

    function _createMarket(string memory q, string memory asset, uint256 price) internal returns (uint256) {
        return market.createMarket(q, asset, price);
    }

    function _seedMarket(uint256 marketId) internal {
        // Alice bets YES, Bob bets NO — gives us a real pool
        vm.prank(alice);
        market.predict{value: 0.01 ether}(marketId, PredictionMarket.Prediction.Yes);
        vm.prank(bob);
        market.predict{value: 0.01 ether}(marketId, PredictionMarket.Prediction.No);
    }

    function _settleMarket(uint256 marketId, uint8 outcome, uint16 confidence, uint256 settledPrice) internal {
        bytes memory report = abi.encodePacked(
            bytes1(0x01),
            abi.encode(marketId, outcome, confidence, settledPrice)
        );
        market.onReport("", report);
    }

    function _buildParlayReport(uint256 parlayId, bool won, bool voided, uint256 payout) internal pure returns (bytes memory) {
        return abi.encodePacked(
            bytes1(0x03),
            abi.encode(parlayId, won, voided, payout)
        );
    }

    function _settleParlayViaReport(uint256 parlayId, bool won, bool voided, uint256 payout) internal {
        bytes memory report = _buildParlayReport(parlayId, won, voided, payout);
        parlay.onReport("", report);
    }

    // ================================================================
    //  PARLAY CREATION (9 tests)
    // ================================================================

    function test_createParlay_2legs() public {
        uint256 m0 = _createMarket("BTC > 100K?", "bitcoin", 100000e6);
        uint256 m1 = _createMarket("ETH > 5K?", "ethereum", 5000e6);
        _seedMarket(m0);
        _seedMarket(m1);

        uint256[] memory ids = new uint256[](2);
        ids[0] = m0; ids[1] = m1;
        uint8[] memory preds = new uint8[](2);
        preds[0] = 0; preds[1] = 1; // YES, NO

        vm.prank(charlie);
        uint256 parlayId = parlay.createParlay{value: 0.001 ether}(ids, preds);
        assertEq(parlayId, 0);

        ParlayEngine.Parlay memory p = parlay.getParlay(0);
        assertEq(p.creator, charlie);
        assertEq(p.stake, 0.001 ether);
        assertEq(p.legCount, 2);
        assertFalse(p.settled);
    }

    function test_createParlay_5legs() public {
        uint256[] memory ids = new uint256[](5);
        uint8[] memory preds = new uint8[](5);
        for (uint256 i = 0; i < 5; i++) {
            ids[i] = _createMarket("Market?", "bitcoin", (i + 1) * 10000e6);
            _seedMarket(ids[i]);
            preds[i] = 0;
        }

        vm.prank(charlie);
        uint256 parlayId = parlay.createParlay{value: 0.001 ether}(ids, preds);
        ParlayEngine.Parlay memory p = parlay.getParlay(parlayId);
        assertEq(p.legCount, 5);
    }

    function test_createParlay_reverts_tooFewLegs() public {
        uint256 m0 = _createMarket("BTC?", "bitcoin", 100000e6);
        _seedMarket(m0);

        uint256[] memory ids = new uint256[](1);
        ids[0] = m0;
        uint8[] memory preds = new uint8[](1);
        preds[0] = 0;

        vm.prank(charlie);
        vm.expectRevert(ParlayEngine.InvalidLegCount.selector);
        parlay.createParlay{value: 0.001 ether}(ids, preds);
    }

    function test_createParlay_reverts_tooManyLegs() public {
        uint256[] memory ids = new uint256[](6);
        uint8[] memory preds = new uint8[](6);
        for (uint256 i = 0; i < 6; i++) {
            ids[i] = _createMarket("M?", "bitcoin", (i + 1) * 10000e6);
            _seedMarket(ids[i]);
            preds[i] = 0;
        }

        vm.prank(charlie);
        vm.expectRevert(ParlayEngine.InvalidLegCount.selector);
        parlay.createParlay{value: 0.001 ether}(ids, preds);
    }

    function test_createParlay_reverts_duplicateMarket() public {
        uint256 m0 = _createMarket("BTC?", "bitcoin", 100000e6);
        _seedMarket(m0);

        uint256[] memory ids = new uint256[](2);
        ids[0] = m0; ids[1] = m0; // duplicate
        uint8[] memory preds = new uint8[](2);
        preds[0] = 0; preds[1] = 1;

        vm.prank(charlie);
        vm.expectRevert(ParlayEngine.DuplicateMarket.selector);
        parlay.createParlay{value: 0.001 ether}(ids, preds);
    }

    function test_createParlay_reverts_settledMarket() public {
        uint256 m0 = _createMarket("BTC?", "bitcoin", 100000e6);
        uint256 m1 = _createMarket("ETH?", "ethereum", 5000e6);
        _seedMarket(m0);
        _seedMarket(m1);
        _settleMarket(m0, 0, 10000, 105000e6); // settle m0

        uint256[] memory ids = new uint256[](2);
        ids[0] = m0; ids[1] = m1;
        uint8[] memory preds = new uint8[](2);
        preds[0] = 0; preds[1] = 0;

        vm.prank(charlie);
        vm.expectRevert(ParlayEngine.MarketAlreadySettled.selector);
        parlay.createParlay{value: 0.001 ether}(ids, preds);
    }

    function test_createParlay_reverts_zeroStake() public {
        uint256 m0 = _createMarket("BTC?", "bitcoin", 100000e6);
        uint256 m1 = _createMarket("ETH?", "ethereum", 5000e6);
        _seedMarket(m0);
        _seedMarket(m1);

        uint256[] memory ids = new uint256[](2);
        ids[0] = m0; ids[1] = m1;
        uint8[] memory preds = new uint8[](2);
        preds[0] = 0; preds[1] = 0;

        vm.prank(charlie);
        vm.expectRevert(ParlayEngine.InvalidStake.selector);
        parlay.createParlay{value: 0}(ids, preds);
    }

    function test_createParlay_reverts_poolTooSmall() public {
        uint256 m0 = _createMarket("BTC?", "bitcoin", 100000e6);
        uint256 m1 = _createMarket("ETH?", "ethereum", 5000e6);
        _seedMarket(m0);
        // m1 NOT seeded — pool is 0

        uint256[] memory ids = new uint256[](2);
        ids[0] = m0; ids[1] = m1;
        uint8[] memory preds = new uint8[](2);
        preds[0] = 0; preds[1] = 0;

        vm.prank(charlie);
        vm.expectRevert(ParlayEngine.PoolTooSmall.selector);
        parlay.createParlay{value: 0.001 ether}(ids, preds);
    }

    function test_createParlay_snapshotsMultiplier() public {
        uint256 m0 = _createMarket("BTC?", "bitcoin", 100000e6);
        // Alice 0.01 YES, Bob 0.01 NO → totalPool = 0.02, each pool = 0.01
        _seedMarket(m0);

        uint256 m1 = _createMarket("ETH?", "ethereum", 5000e6);
        _seedMarket(m1);

        uint256[] memory ids = new uint256[](2);
        ids[0] = m0; ids[1] = m1;
        uint8[] memory preds = new uint8[](2);
        preds[0] = 0; preds[1] = 0; // both YES

        vm.prank(charlie);
        parlay.createParlay{value: 0.001 ether}(ids, preds);

        ParlayEngine.ParlayLeg[] memory legs = parlay.getParlayLegs(0);
        // 50/50 pool → multiplier = 20000 (2x) per leg
        assertEq(legs[0].multiplierBps, 20000);
        assertEq(legs[1].multiplierBps, 20000);

        // Combined: 2x × 2x = 4x → payout = 0.001 * 4 = 0.004
        ParlayEngine.Parlay memory p = parlay.getParlay(0);
        assertEq(p.potentialPayout, 0.004 ether);
    }

    // ================================================================
    //  REQUEST SETTLEMENT (1 test)
    // ================================================================

    function test_requestSettlement_emitsEvent() public {
        uint256 m0 = _createMarket("BTC?", "bitcoin", 100000e6);
        uint256 m1 = _createMarket("ETH?", "ethereum", 5000e6);
        _seedMarket(m0);
        _seedMarket(m1);

        uint256[] memory ids = new uint256[](2);
        ids[0] = m0; ids[1] = m1;
        uint8[] memory preds = new uint8[](2);
        preds[0] = 0; preds[1] = 1;

        vm.prank(charlie);
        uint256 parlayId = parlay.createParlay{value: 0.001 ether}(ids, preds);

        // Settle underlying markets
        _settleMarket(m0, 0, 10000, 105000e6); // YES wins
        _settleMarket(m1, 1, 10000, 4000e6);   // NO wins

        vm.expectEmit(true, false, false, false);
        emit ParlayEngine.ParlaySettlementRequested(parlayId);
        parlay.requestParlaySettlement(parlayId);
    }

    // ================================================================
    //  PARLAY SETTLEMENT (4 tests)
    // ================================================================

    function test_settleParlay_allWin() public {
        uint256 m0 = _createMarket("BTC?", "bitcoin", 100000e6);
        uint256 m1 = _createMarket("ETH?", "ethereum", 5000e6);
        _seedMarket(m0);
        _seedMarket(m1);

        uint256[] memory ids = new uint256[](2);
        ids[0] = m0; ids[1] = m1;
        uint8[] memory preds = new uint8[](2);
        preds[0] = 0; preds[1] = 1; // YES, NO

        vm.prank(charlie);
        uint256 parlayId = parlay.createParlay{value: 0.001 ether}(ids, preds);

        // Settle: m0=YES, m1=NO → both legs hit
        _settleMarket(m0, 0, 10000, 105000e6);
        _settleMarket(m1, 1, 10000, 4000e6);

        ParlayEngine.Parlay memory p = parlay.getParlay(parlayId);
        _settleParlayViaReport(parlayId, true, false, p.potentialPayout);

        p = parlay.getParlay(parlayId);
        assertTrue(p.settled);
        assertTrue(p.won);
        assertFalse(p.voided);
    }

    function test_settleParlay_oneLoses() public {
        uint256 m0 = _createMarket("BTC?", "bitcoin", 100000e6);
        uint256 m1 = _createMarket("ETH?", "ethereum", 5000e6);
        _seedMarket(m0);
        _seedMarket(m1);

        uint256[] memory ids = new uint256[](2);
        ids[0] = m0; ids[1] = m1;
        uint8[] memory preds = new uint8[](2);
        preds[0] = 0; preds[1] = 1; // YES, NO

        vm.prank(charlie);
        uint256 parlayId = parlay.createParlay{value: 0.001 ether}(ids, preds);

        // m0=YES (hit), m1=YES (miss — charlie bet NO)
        _settleMarket(m0, 0, 10000, 105000e6);
        _settleMarket(m1, 0, 10000, 6000e6);

        _settleParlayViaReport(parlayId, false, false, 0);

        ParlayEngine.Parlay memory p = parlay.getParlay(parlayId);
        assertTrue(p.settled);
        assertFalse(p.won);
    }

    function test_settleParlay_voided() public {
        uint256 m0 = _createMarket("BTC?", "bitcoin", 100000e6);
        uint256 m1 = _createMarket("ETH?", "ethereum", 5000e6);
        _seedMarket(m0);
        _seedMarket(m1);

        uint256[] memory ids = new uint256[](2);
        ids[0] = m0; ids[1] = m1;
        uint8[] memory preds = new uint8[](2);
        preds[0] = 0; preds[1] = 0;

        vm.prank(charlie);
        uint256 parlayId = parlay.createParlay{value: 0.001 ether}(ids, preds);

        // m0 settled normally, m1 cancelled (confidence=0)
        _settleMarket(m0, 0, 10000, 105000e6);
        _settleMarket(m1, 0, 0, 0); // cancelled

        _settleParlayViaReport(parlayId, false, true, 0);

        ParlayEngine.Parlay memory p = parlay.getParlay(parlayId);
        assertTrue(p.settled);
        assertTrue(p.voided);
    }

    function test_settleParlay_reverts_notAllSettled() public {
        uint256 m0 = _createMarket("BTC?", "bitcoin", 100000e6);
        uint256 m1 = _createMarket("ETH?", "ethereum", 5000e6);
        _seedMarket(m0);
        _seedMarket(m1);

        uint256[] memory ids = new uint256[](2);
        ids[0] = m0; ids[1] = m1;
        uint8[] memory preds = new uint8[](2);
        preds[0] = 0; preds[1] = 0;

        vm.prank(charlie);
        uint256 parlayId = parlay.createParlay{value: 0.001 ether}(ids, preds);

        // Only settle m0, leave m1 unsettled
        _settleMarket(m0, 0, 10000, 105000e6);

        vm.expectRevert(ParlayEngine.NotAllLegsSettled.selector);
        _settleParlayViaReport(parlayId, true, false, 0.004 ether);
    }

    // ================================================================
    //  CLAIM (5 tests)
    // ================================================================

    function test_claimWinnings_success() public {
        uint256 m0 = _createMarket("BTC?", "bitcoin", 100000e6);
        uint256 m1 = _createMarket("ETH?", "ethereum", 5000e6);
        _seedMarket(m0);
        _seedMarket(m1);

        uint256[] memory ids = new uint256[](2);
        ids[0] = m0; ids[1] = m1;
        uint8[] memory preds = new uint8[](2);
        preds[0] = 0; preds[1] = 1;

        vm.prank(charlie);
        uint256 parlayId = parlay.createParlay{value: 0.001 ether}(ids, preds);

        _settleMarket(m0, 0, 10000, 105000e6);
        _settleMarket(m1, 1, 10000, 4000e6);

        ParlayEngine.Parlay memory p = parlay.getParlay(parlayId);
        _settleParlayViaReport(parlayId, true, false, p.potentialPayout);

        uint256 balBefore = charlie.balance;
        vm.prank(charlie);
        parlay.claimParlayWinnings(parlayId);

        assertEq(charlie.balance - balBefore, p.potentialPayout);
        assertTrue(parlay.getParlay(parlayId).claimed);
    }

    function test_claimRefund_voided() public {
        uint256 m0 = _createMarket("BTC?", "bitcoin", 100000e6);
        uint256 m1 = _createMarket("ETH?", "ethereum", 5000e6);
        _seedMarket(m0);
        _seedMarket(m1);

        uint256[] memory ids = new uint256[](2);
        ids[0] = m0; ids[1] = m1;
        uint8[] memory preds = new uint8[](2);
        preds[0] = 0; preds[1] = 0;

        vm.prank(charlie);
        parlay.createParlay{value: 0.005 ether}(ids, preds);

        _settleMarket(m0, 0, 10000, 105000e6);
        _settleMarket(m1, 0, 0, 0); // cancelled

        _settleParlayViaReport(0, false, true, 0);

        uint256 balBefore = charlie.balance;
        vm.prank(charlie);
        parlay.claimParlayWinnings(0);

        // Should get back original stake
        assertEq(charlie.balance - balBefore, 0.005 ether);
    }

    function test_claim_reverts_ifLost() public {
        uint256 m0 = _createMarket("BTC?", "bitcoin", 100000e6);
        uint256 m1 = _createMarket("ETH?", "ethereum", 5000e6);
        _seedMarket(m0);
        _seedMarket(m1);

        uint256[] memory ids = new uint256[](2);
        ids[0] = m0; ids[1] = m1;
        uint8[] memory preds = new uint8[](2);
        preds[0] = 0; preds[1] = 1;

        vm.prank(charlie);
        parlay.createParlay{value: 0.001 ether}(ids, preds);

        _settleMarket(m0, 0, 10000, 105000e6);
        _settleMarket(m1, 0, 10000, 6000e6); // YES wins but charlie bet NO

        _settleParlayViaReport(0, false, false, 0);

        vm.prank(charlie);
        vm.expectRevert(ParlayEngine.ParlayNotWon.selector);
        parlay.claimParlayWinnings(0);
    }

    function test_claim_reverts_doubleClaim() public {
        uint256 m0 = _createMarket("BTC?", "bitcoin", 100000e6);
        uint256 m1 = _createMarket("ETH?", "ethereum", 5000e6);
        _seedMarket(m0);
        _seedMarket(m1);

        uint256[] memory ids = new uint256[](2);
        ids[0] = m0; ids[1] = m1;
        uint8[] memory preds = new uint8[](2);
        preds[0] = 0; preds[1] = 1;

        vm.prank(charlie);
        parlay.createParlay{value: 0.001 ether}(ids, preds);

        _settleMarket(m0, 0, 10000, 105000e6);
        _settleMarket(m1, 1, 10000, 4000e6);

        ParlayEngine.Parlay memory p = parlay.getParlay(0);
        _settleParlayViaReport(0, true, false, p.potentialPayout);

        vm.prank(charlie);
        parlay.claimParlayWinnings(0);

        vm.prank(charlie);
        vm.expectRevert(ParlayEngine.AlreadyClaimed.selector);
        parlay.claimParlayWinnings(0);
    }

    function test_claim_reverts_notCreator() public {
        uint256 m0 = _createMarket("BTC?", "bitcoin", 100000e6);
        uint256 m1 = _createMarket("ETH?", "ethereum", 5000e6);
        _seedMarket(m0);
        _seedMarket(m1);

        uint256[] memory ids = new uint256[](2);
        ids[0] = m0; ids[1] = m1;
        uint8[] memory preds = new uint8[](2);
        preds[0] = 0; preds[1] = 1;

        vm.prank(charlie);
        parlay.createParlay{value: 0.001 ether}(ids, preds);

        _settleMarket(m0, 0, 10000, 105000e6);
        _settleMarket(m1, 1, 10000, 4000e6);

        ParlayEngine.Parlay memory p = parlay.getParlay(0);
        _settleParlayViaReport(0, true, false, p.potentialPayout);

        // Alice tries to claim charlie's parlay
        vm.prank(alice);
        vm.expectRevert(ParlayEngine.NotCreator.selector);
        parlay.claimParlayWinnings(0);
    }

    // ================================================================
    //  GETTERS (2 tests)
    // ================================================================

    function test_getNextParlayId() public {
        assertEq(parlay.getNextParlayId(), 0);

        uint256 m0 = _createMarket("BTC?", "bitcoin", 100000e6);
        uint256 m1 = _createMarket("ETH?", "ethereum", 5000e6);
        _seedMarket(m0);
        _seedMarket(m1);

        uint256[] memory ids = new uint256[](2);
        ids[0] = m0; ids[1] = m1;
        uint8[] memory preds = new uint8[](2);
        preds[0] = 0; preds[1] = 0;

        vm.prank(charlie);
        parlay.createParlay{value: 0.001 ether}(ids, preds);
        assertEq(parlay.getNextParlayId(), 1);
    }

    function test_getHouseBalance() public {
        assertEq(parlay.getHouseBalance(), 10 ether);
    }

    // ================================================================
    //  RECEIVE ETH (1 test)
    // ================================================================

    function test_receiveEth() public {
        uint256 balBefore = address(parlay).balance;
        (bool ok,) = address(parlay).call{value: 1 ether}("");
        assertTrue(ok);
        assertEq(address(parlay).balance, balBefore + 1 ether);
    }
}
