// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ReceiverTemplate} from "./interfaces/ReceiverTemplate.sol";

/// @title OracleSettler
/// @notice AI + Real Data powered prediction market with CRE automated resolution.
/// @dev Extends bootcamp template with verifiable price data from CoinGecko.
contract PredictionMarket is ReceiverTemplate {
    error MarketDoesNotExist();
    error MarketAlreadySettled();
    error MarketNotSettled();
    error MarketExpired();
    error MarketNotCancelled();
    error Unauthorized();
    error AlreadyPredicted();
    error InvalidAmount();
    error NothingToClaim();
    error AlreadyClaimed();
    error TransferFailed();

    event MarketCreated(uint256 indexed marketId, string question, string asset, uint256 targetPrice, uint48 deadline, address creator);
    event PredictionMade(uint256 indexed marketId, address indexed predictor, Prediction prediction, uint256 amount);
    event SettlementRequested(uint256 indexed marketId, string question);
    event MarketSettled(uint256 indexed marketId, Prediction outcome, uint16 confidence, uint256 settledPrice);
    event MarketCancelled(uint256 indexed marketId, address indexed cancelledBy);
    event WinningsClaimed(uint256 indexed marketId, address indexed claimer, uint256 amount);

    enum Prediction {
        Yes,
        No
    }

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
        string asset;           // CoinGecko asset ID (e.g., "bitcoin")
        uint256 targetPrice;    // Target price in USD with 6 decimals (e.g., 100000e6)
        uint256 settledPrice;   // Actual price at settlement time (6 decimals)
    }

    struct UserPrediction {
        uint256 amount;
        Prediction prediction;
        bool claimed;
    }

    uint48 public constant DEFAULT_DEADLINE_DURATION = 7 days;

    uint256 internal nextMarketId;
    mapping(uint256 marketId => Market market) internal markets;
    mapping(uint256 marketId => mapping(address user => UserPrediction)) internal predictions;

    /// @notice Constructor sets the Chainlink Forwarder address for security
    /// @param _forwarderAddress The address of the Chainlink KeystoneForwarder contract
    /// @dev For Sepolia testnet, use: 0x15fc6ae953e024d975e77382eeec56a9101f9f88
    constructor(address _forwarderAddress) ReceiverTemplate(_forwarderAddress) {}

    // ================================================================
    // │                       Create market                          │
    // ================================================================

    /// @notice Create a new prediction market with default 7-day deadline.
    function createMarket(
        string memory question,
        string memory asset,
        uint256 targetPrice
    ) public returns (uint256 marketId) {
        return createMarketWithDeadline(question, asset, targetPrice, uint48(block.timestamp) + DEFAULT_DEADLINE_DURATION);
    }

    /// @notice Create a new prediction market with a custom deadline.
    /// @param question The question for the market.
    /// @param asset The CoinGecko asset ID (e.g., "bitcoin", "ethereum").
    /// @param targetPrice The target price in USD with 6 decimals.
    /// @param deadline The timestamp after which predictions are closed.
    /// @return marketId The ID of the newly created market.
    function createMarketWithDeadline(
        string memory question,
        string memory asset,
        uint256 targetPrice,
        uint48 deadline
    ) public returns (uint256 marketId) {
        marketId = nextMarketId++;

        markets[marketId] = Market({
            creator: msg.sender,
            createdAt: uint48(block.timestamp),
            settledAt: 0,
            deadline: deadline,
            settled: false,
            confidence: 0,
            outcome: Prediction.Yes,
            totalYesPool: 0,
            totalNoPool: 0,
            question: question,
            asset: asset,
            targetPrice: targetPrice,
            settledPrice: 0
        });

        emit MarketCreated(marketId, question, asset, targetPrice, deadline, msg.sender);
    }

    // ================================================================
    // │                          Predict                             │
    // ================================================================

    /// @notice Make a prediction on a market.
    /// @param marketId The ID of the market.
    /// @param prediction The prediction (Yes or No).
    function predict(uint256 marketId, Prediction prediction) external payable {
        Market memory m = markets[marketId];

        if (m.creator == address(0)) revert MarketDoesNotExist();
        if (m.settled) revert MarketAlreadySettled();
        if (m.deadline != 0 && block.timestamp >= m.deadline) revert MarketExpired();
        if (msg.value == 0) revert InvalidAmount();

        UserPrediction memory userPred = predictions[marketId][msg.sender];
        if (userPred.amount != 0) revert AlreadyPredicted();

        predictions[marketId][msg.sender] = UserPrediction({
            amount: msg.value,
            prediction: prediction,
            claimed: false
        });

        if (prediction == Prediction.Yes) {
            markets[marketId].totalYesPool += msg.value;
        } else {
            markets[marketId].totalNoPool += msg.value;
        }

        emit PredictionMade(marketId, msg.sender, prediction, msg.value);
    }

    // ================================================================
    // │                    Request settlement                        │
    // ================================================================

    /// @notice Request settlement for a market.
    /// @dev Emits SettlementRequested event for CRE Log Trigger.
    /// @param marketId The ID of the market to settle.
    function requestSettlement(uint256 marketId) external {
        Market memory m = markets[marketId];

        if (m.creator == address(0)) revert MarketDoesNotExist();
        if (m.settled) revert MarketAlreadySettled();

        emit SettlementRequested(marketId, m.question);
    }

    // ================================================================
    // │                 Market settlement by CRE                     │
    // ================================================================

    /// @notice Settles a market from a CRE report with verifiable price data + AI confidence.
    /// @dev Called via onReport → _processReport when prefix byte is 0x01.
    /// @param report ABI-encoded (uint256 marketId, uint8 outcome, uint16 confidence, uint256 settledPrice)
    function _settleMarket(bytes calldata report) internal {
        (uint256 marketId, Prediction outcome, uint16 confidence, uint256 settledPrice) = abi.decode(
            report,
            (uint256, Prediction, uint16, uint256)
        );

        Market memory m = markets[marketId];

        if (m.creator == address(0)) revert MarketDoesNotExist();
        if (m.settled) revert MarketAlreadySettled();

        markets[marketId].settled = true;
        markets[marketId].confidence = confidence;
        markets[marketId].settledAt = uint48(block.timestamp);
        markets[marketId].outcome = outcome;
        markets[marketId].settledPrice = settledPrice;

        emit MarketSettled(marketId, outcome, confidence, settledPrice);
    }

    // ================================================================
    // │                      CRE Entry Point                         │
    // ================================================================

    /// @inheritdoc ReceiverTemplate
    /// @dev Routes to either market creation or settlement based on prefix byte.
    ///      - No prefix → Create market
    ///      - Prefix 0x01 → Settle market
    function _processReport(bytes calldata report) internal override {
        if (report.length > 0 && report[0] == 0x01) {
            _settleMarket(report[1:]);
        } else {
            (string memory question, string memory asset, uint256 targetPrice) = abi.decode(
                report,
                (string, string, uint256)
            );
            createMarket(question, asset, targetPrice);
        }
    }

    // ================================================================
    // │                      Cancel market                           │
    // ================================================================

    /// @notice Cancel an unsettled market. Only the creator can cancel.
    /// @param marketId The ID of the market to cancel.
    function cancelMarket(uint256 marketId) external {
        Market memory m = markets[marketId];

        if (m.creator == address(0)) revert MarketDoesNotExist();
        if (m.settled) revert MarketAlreadySettled();
        if (msg.sender != m.creator) revert Unauthorized();

        markets[marketId].settled = true;
        markets[marketId].confidence = 0; // 0 confidence = cancelled
        markets[marketId].settledAt = uint48(block.timestamp);

        emit MarketCancelled(marketId, msg.sender);
    }

    /// @notice Refund original bet amount from a cancelled market.
    /// @param marketId The ID of the cancelled market.
    function refund(uint256 marketId) external {
        Market memory m = markets[marketId];

        if (m.creator == address(0)) revert MarketDoesNotExist();
        if (!m.settled || m.confidence != 0) revert MarketNotCancelled();

        UserPrediction memory userPred = predictions[marketId][msg.sender];

        if (userPred.amount == 0) revert NothingToClaim();
        if (userPred.claimed) revert AlreadyClaimed();

        predictions[marketId][msg.sender].claimed = true;

        (bool success,) = msg.sender.call{value: userPred.amount}("");
        if (!success) revert TransferFailed();

        emit WinningsClaimed(marketId, msg.sender, userPred.amount);
    }

    // ================================================================
    // │                      Claim winnings                          │
    // ================================================================

    /// @notice Claim winnings after market settlement.
    /// @param marketId The ID of the market.
    function claim(uint256 marketId) external {
        Market memory m = markets[marketId];

        if (m.creator == address(0)) revert MarketDoesNotExist();
        if (!m.settled) revert MarketNotSettled();
        if (m.confidence == 0) revert MarketNotCancelled(); // cancelled markets use refund()

        UserPrediction memory userPred = predictions[marketId][msg.sender];

        if (userPred.amount == 0) revert NothingToClaim();
        if (userPred.claimed) revert AlreadyClaimed();
        if (userPred.prediction != m.outcome) revert NothingToClaim();

        predictions[marketId][msg.sender].claimed = true;

        uint256 totalPool = m.totalYesPool + m.totalNoPool;
        uint256 winningPool = m.outcome == Prediction.Yes ? m.totalYesPool : m.totalNoPool;
        if (winningPool == 0) revert NothingToClaim();
        uint256 payout = (userPred.amount * totalPool) / winningPool;

        (bool success,) = msg.sender.call{value: payout}("");
        if (!success) revert TransferFailed();

        emit WinningsClaimed(marketId, msg.sender, payout);
    }

    // ================================================================
    // │                          Getters                             │
    // ================================================================

    /// @notice Get market details.
    /// @param marketId The ID of the market.
    function getMarket(uint256 marketId) external view returns (Market memory) {
        return markets[marketId];
    }

    /// @notice Get user's prediction for a market.
    /// @param marketId The ID of the market.
    /// @param user The user's address.
    function getPrediction(uint256 marketId, address user) external view returns (UserPrediction memory) {
        return predictions[marketId][user];
    }

    /// @notice Get total number of markets created.
    function getNextMarketId() external view returns (uint256) {
        return nextMarketId;
    }
}
