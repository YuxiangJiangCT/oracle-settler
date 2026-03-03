// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ReceiverTemplate} from "./interfaces/ReceiverTemplate.sol";

/// @title IPredictionMarket — minimal interface for reading market state
interface IPredictionMarket {
    enum Prediction { Yes, No }

    struct Market {
        address creator;
        uint48 createdAt;
        uint48 settledAt;
        uint48 deadline;
        bool settled;
        uint16 confidence;
        Prediction outcome;
        uint256 totalYesPool;
        uint256 totalNoPool;
        string question;
        string asset;
        uint256 targetPrice;
        uint256 settledPrice;
    }

    struct Dispute {
        address disputer;
        uint48 filedAt;
        uint256 stake;
        bool resolved;
        bool overturned;
    }

    function getMarket(uint256 marketId) external view returns (Market memory);
    function getDispute(uint256 marketId) external view returns (Dispute memory);
}

/// @title ParlayEngine — On-chain parlay bets with CRE autonomous settlement
/// @notice First prediction market parlay system. Users combine 2-5 market
///         predictions into a single bet. CRE verifies all legs and settles
///         the parlay autonomously — no human arbitrator needed.
contract ParlayEngine is ReceiverTemplate {

    // ── Errors ──────────────────────────────────────────────
    error InvalidLegCount();
    error InvalidStake();
    error MarketNotFound();
    error MarketAlreadySettled();
    error DuplicateMarket();
    error PoolTooSmall();
    error MultiplierTooHigh();
    error PayoutExceedsMax();
    error PayoutExceedsBalance();
    error ParlayDoesNotExist();
    error ParlayAlreadySettled();
    error ParlayNotSettled();
    error ParlayNotWon();
    error AlreadyClaimed();
    error NotCreator();
    error NotAllLegsSettled();
    error TransferFailed();

    // ── Events ──────────────────────────────────────────────
    event ParlayCreated(uint256 indexed parlayId, address indexed creator, uint8 legCount, uint256 stake, uint256 potentialPayout);
    event ParlaySettlementRequested(uint256 indexed parlayId);
    event ParlaySettled(uint256 indexed parlayId, bool won, bool voided, uint256 payout);

    // ── Structs ─────────────────────────────────────────────
    struct ParlayLeg {
        uint256 marketId;
        uint8   prediction;      // 0 = YES, 1 = NO
        uint256 multiplierBps;   // Snapshot odds in basis points (10000 = 1x)
    }

    struct Parlay {
        address creator;
        uint48  createdAt;
        uint256 stake;
        uint256 potentialPayout;
        uint8   legCount;
        bool    settled;
        bool    won;
        bool    voided;          // True if any leg market was cancelled
        bool    claimed;
    }

    // ── Constants ───────────────────────────────────────────
    uint8   public constant MIN_LEGS = 2;
    uint8   public constant MAX_LEGS = 5;
    uint256 public constant MAX_MULTIPLIER_BPS = 1_000_000; // 100x
    uint256 public constant MAX_PAYOUT = 0.5 ether;
    uint256 public constant MIN_POOL_SIZE = 0.005 ether;
    uint48  public constant DISPUTE_WINDOW = 1 hours;

    // ── Storage ─────────────────────────────────────────────
    IPredictionMarket public immutable predictionMarket;
    uint256 internal nextParlayId;
    mapping(uint256 => Parlay) internal parlays;
    mapping(uint256 => ParlayLeg[]) internal parlayLegs;

    // ── Constructor ─────────────────────────────────────────
    constructor(
        address _forwarderAddress,
        address _predictionMarket
    ) ReceiverTemplate(_forwarderAddress) {
        predictionMarket = IPredictionMarket(_predictionMarket);
    }

    // ================================================================
    // │                     Create Parlay                             │
    // ================================================================

    /// @notice Create a parlay bet on 2-5 markets.
    /// @param marketIds Array of market IDs to include as legs.
    /// @param predictions Array of predictions (0=YES, 1=NO) for each leg.
    function createParlay(
        uint256[] calldata marketIds,
        uint8[] calldata predictions
    ) external payable returns (uint256) {
        if (marketIds.length != predictions.length) revert InvalidLegCount();
        if (marketIds.length < MIN_LEGS || marketIds.length > MAX_LEGS) revert InvalidLegCount();
        if (msg.value == 0) revert InvalidStake();

        uint256 parlayId = nextParlayId++;
        uint256 combinedBps = 10_000; // Start at 1x

        for (uint256 i = 0; i < marketIds.length; i++) {
            // Check for duplicate markets
            for (uint256 j = 0; j < i; j++) {
                if (marketIds[i] == marketIds[j]) revert DuplicateMarket();
            }

            // Read market state
            IPredictionMarket.Market memory m = predictionMarket.getMarket(marketIds[i]);
            if (m.creator == address(0)) revert MarketNotFound();
            if (m.settled) revert MarketAlreadySettled();

            // Calculate snapshot multiplier
            uint256 totalPool = m.totalYesPool + m.totalNoPool;
            if (totalPool < MIN_POOL_SIZE) revert PoolTooSmall();

            uint256 selectedPool = predictions[i] == 0 ? m.totalYesPool : m.totalNoPool;

            // Default 2x if selected pool is 0 (no one bet this direction yet)
            uint256 legMultiplier;
            if (selectedPool == 0) {
                legMultiplier = 20_000; // 2x default
            } else {
                legMultiplier = (totalPool * 10_000) / selectedPool;
            }

            // Store leg
            parlayLegs[parlayId].push(ParlayLeg({
                marketId: marketIds[i],
                prediction: predictions[i],
                multiplierBps: legMultiplier
            }));

            // Accumulate combined multiplier
            combinedBps = (combinedBps * legMultiplier) / 10_000;
        }

        // Enforce max multiplier
        if (combinedBps > MAX_MULTIPLIER_BPS) revert MultiplierTooHigh();

        uint256 payout = (msg.value * combinedBps) / 10_000;
        if (payout > MAX_PAYOUT) revert PayoutExceedsMax();
        if (payout > address(this).balance) revert PayoutExceedsBalance();

        parlays[parlayId] = Parlay({
            creator: msg.sender,
            createdAt: uint48(block.timestamp),
            stake: msg.value,
            potentialPayout: payout,
            legCount: uint8(marketIds.length),
            settled: false,
            won: false,
            voided: false,
            claimed: false
        });

        emit ParlayCreated(parlayId, msg.sender, uint8(marketIds.length), msg.value, payout);
        return parlayId;
    }

    // ================================================================
    // │                 Request Settlement (CRE trigger)              │
    // ================================================================

    /// @notice Request CRE to settle a parlay. Permissionless — anyone can call.
    function requestParlaySettlement(uint256 parlayId) external {
        Parlay memory p = parlays[parlayId];
        if (p.creator == address(0)) revert ParlayDoesNotExist();
        if (p.settled) revert ParlayAlreadySettled();
        emit ParlaySettlementRequested(parlayId);
    }

    // ================================================================
    // │              CRE Report Processing (0x03 prefix)              │
    // ================================================================

    function _processReport(bytes calldata report) internal override {
        if (report.length > 0 && report[0] == 0x03) {
            _settleParlay(report[1:]);
        }
    }

    function _settleParlay(bytes calldata report) internal {
        (uint256 parlayId, bool won, bool voided, uint256 payout) = abi.decode(
            report, (uint256, bool, bool, uint256)
        );

        Parlay storage p = parlays[parlayId];
        if (p.creator == address(0)) revert ParlayDoesNotExist();
        if (p.settled) revert ParlayAlreadySettled();

        // Safety check: verify all leg markets are actually settled
        ParlayLeg[] memory legs = parlayLegs[parlayId];
        for (uint256 i = 0; i < legs.length; i++) {
            IPredictionMarket.Market memory m = predictionMarket.getMarket(legs[i].marketId);
            if (!m.settled) revert NotAllLegsSettled();
        }

        p.settled = true;
        p.won = won;
        p.voided = voided;

        emit ParlaySettled(parlayId, won, voided, won ? payout : (voided ? p.stake : 0));
    }

    // ================================================================
    // │                     Claim Winnings                            │
    // ================================================================

    /// @notice Claim parlay winnings (or refund if voided).
    function claimParlayWinnings(uint256 parlayId) external {
        Parlay storage p = parlays[parlayId];
        if (p.creator == address(0)) revert ParlayDoesNotExist();
        if (!p.settled) revert ParlayNotSettled();
        if (p.claimed) revert AlreadyClaimed();
        if (msg.sender != p.creator) revert NotCreator();

        p.claimed = true;

        uint256 amount;
        if (p.voided) {
            // Refund original stake
            amount = p.stake;
        } else if (p.won) {
            amount = p.potentialPayout;
        } else {
            revert ParlayNotWon();
        }

        if (address(this).balance < amount) revert PayoutExceedsBalance();
        (bool success,) = msg.sender.call{value: amount}("");
        if (!success) revert TransferFailed();
    }

    // ================================================================
    // │                          Getters                              │
    // ================================================================

    function getParlay(uint256 parlayId) external view returns (Parlay memory) {
        return parlays[parlayId];
    }

    function getParlayLegs(uint256 parlayId) external view returns (ParlayLeg[] memory) {
        return parlayLegs[parlayId];
    }

    function getNextParlayId() external view returns (uint256) {
        return nextParlayId;
    }

    function getHouseBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // Accept ETH to fund the house pool
    receive() external payable {}
}
