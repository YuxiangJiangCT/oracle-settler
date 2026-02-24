// OracleSettler PredictionMarket — ABI & Config

export const SEPOLIA = {
  chainId: 11155111,
  chainIdHex: "0xAA36A7",
  name: "Sepolia Testnet",
  rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
  blockExplorer: "https://sepolia.etherscan.io",
  currency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
};

export const CONTRACT_ADDRESS = "0x557542Bf475143a2f4F620E7C05bc8d913c55324";

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

  // Events
  "event MarketCreated(uint256 indexed marketId, string question, string asset, uint256 targetPrice, uint48 deadline, address creator)",
  "event PredictionMade(uint256 indexed marketId, address indexed predictor, uint8 prediction, uint256 amount)",
  "event SettlementRequested(uint256 indexed marketId, string question)",
  "event MarketSettled(uint256 indexed marketId, uint8 outcome, uint16 confidence, uint256 settledPrice)",
  "event MarketCancelled(uint256 indexed marketId, address indexed cancelledBy)",
  "event WinningsClaimed(uint256 indexed marketId, address indexed claimer, uint256 amount)",
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
