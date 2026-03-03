// OracleSettler PredictionMarket — ABI & Config

export const SEPOLIA = {
  chainId: 11155111,
  chainIdHex: "0xAA36A7",
  name: "Sepolia Testnet",
  rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
  blockExplorer: "https://sepolia.etherscan.io",
  currency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
};

export const CONTRACT_ADDRESS = "0x51CC15B53d776b2B7a76Fa30425e8f9aD2aec1a5";

export const PREDICTION_MARKET_ABI = [
  // Read
  "function getMarket(uint256 marketId) view returns (tuple(address creator, uint48 createdAt, uint48 settledAt, uint48 deadline, bool settled, uint16 confidence, uint8 outcome, uint256 totalYesPool, uint256 totalNoPool, string question, string asset, uint256 targetPrice, uint256 settledPrice))",
  "function getPrediction(uint256 marketId, address user) view returns (tuple(uint256 amount, uint8 prediction, bool claimed))",
  "function getNextMarketId() view returns (uint256)",

  // Write
  "function createMarket(string question, string asset, uint256 targetPrice) returns (uint256)",
  "function createMarketWithDeadline(string question, string asset, uint256 targetPrice, uint48 deadline) returns (uint256)",
  "function predict(uint256 marketId, uint8 prediction) payable",
  "function requestSettlement(uint256 marketId)",
  "function claim(uint256 marketId)",
  "function cancelMarket(uint256 marketId)",
  "function refund(uint256 marketId)",
  "function createMarketVerified(string question, string asset, uint256 targetPrice, uint256 root, uint256 nullifierHash, uint256[8] proof) returns (uint256)",
  "function worldId() view returns (address)",

  // Dispute
  "function disputeMarket(uint256 marketId) payable",
  "function getDispute(uint256 marketId) view returns (tuple(address disputer, uint48 filedAt, uint256 stake, bool resolved, bool overturned))",
  "function DISPUTE_WINDOW() view returns (uint48)",
  "function DISPUTE_STAKE() view returns (uint256)",

  // Events
  "event MarketCreated(uint256 indexed marketId, string question, string asset, uint256 targetPrice, uint48 deadline, address creator)",
  "event PredictionMade(uint256 indexed marketId, address indexed predictor, uint8 prediction, uint256 amount)",
  "event SettlementRequested(uint256 indexed marketId, string question)",
  "event MarketSettled(uint256 indexed marketId, uint8 outcome, uint16 confidence, uint256 settledPrice)",
  "event MarketCancelled(uint256 indexed marketId, address indexed cancelledBy)",
  "event WinningsClaimed(uint256 indexed marketId, address indexed claimer, uint256 amount)",
  "event DisputeFiled(uint256 indexed marketId, address indexed disputer, uint256 stake)",
  "event DisputeResolved(uint256 indexed marketId, bool overturned, uint8 newOutcome, uint16 newConfidence, uint256 newSettledPrice)",
];

export interface Market {
  creator: string;
  createdAt: number;
  settledAt: number;
  deadline: number;
  settled: boolean;
  confidence: number;
  outcome: number; // 0 = Yes, 1 = No
  totalYesPool: bigint;
  totalNoPool: bigint;
  question: string;
  asset: string;
  targetPrice: bigint;
  settledPrice: bigint;
}

export interface UserPrediction {
  amount: bigint;
  prediction: number; // 0 = Yes, 1 = No
  claimed: boolean;
}

export interface Dispute {
  disputer: string;
  filedAt: number;
  stake: bigint;
  resolved: boolean;
  overturned: boolean;
}

// ===========================
// ParlayEngine
// ===========================

export const PARLAY_ENGINE_ADDRESS = "0x0000000000000000000000000000000000000000"; // Updated after deployment

export const PARLAY_ENGINE_ABI = [
  // Read
  "function getParlay(uint256 parlayId) view returns (tuple(address creator, uint48 createdAt, uint256 stake, uint256 potentialPayout, uint8 legCount, bool settled, bool won, bool voided, bool claimed))",
  "function getParlayLegs(uint256 parlayId) view returns (tuple(uint256 marketId, uint8 prediction, uint256 multiplierBps)[])",
  "function getNextParlayId() view returns (uint256)",
  "function getHouseBalance() view returns (uint256)",
  // Write
  "function createParlay(uint256[] marketIds, uint8[] predictions) payable returns (uint256)",
  "function requestParlaySettlement(uint256 parlayId)",
  "function claimParlayWinnings(uint256 parlayId)",
  // Constants
  "function MIN_LEGS() view returns (uint8)",
  "function MAX_LEGS() view returns (uint8)",
  "function MAX_PAYOUT() view returns (uint256)",
  // Events
  "event ParlayCreated(uint256 indexed parlayId, address indexed creator, uint8 legCount, uint256 stake, uint256 potentialPayout)",
  "event ParlaySettlementRequested(uint256 indexed parlayId)",
  "event ParlaySettled(uint256 indexed parlayId, bool won, bool voided, uint256 payout)",
];

export interface Parlay {
  creator: string;
  createdAt: number;
  stake: bigint;
  potentialPayout: bigint;
  legCount: number;
  settled: boolean;
  won: boolean;
  voided: boolean;
  claimed: boolean;
}

export interface ParlayLeg {
  marketId: bigint;
  prediction: number; // 0 = Yes, 1 = No
  multiplierBps: bigint;
}
