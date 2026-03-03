// prediction-market/my-workflow/parlayCallback.ts
// Log Trigger: Handles ParlaySettlementRequested events for autonomous parlay settlement.
// CRE reads parlay state from ParlayEngine, verifies all legs via PredictionMarket,
// then writes a 0x03 settlement report back to ParlayEngine.

import {
  cre,
  type Runtime,
  type EVMLog,
  bytesToHex,
  getNetwork,
  hexToBase64,
  TxStatus,
  encodeCallMsg,
} from "@chainlink/cre-sdk";
import {
  decodeEventLog,
  parseAbi,
  encodeFunctionData,
  decodeFunctionResult,
  encodeAbiParameters,
  parseAbiParameters,
  zeroAddress,
} from "viem";
import { type Config, readMarket } from "./settlementLogic";

// ===========================
// Event ABI
// ===========================

const PARLAY_EVENT_ABI = parseAbi([
  "event ParlaySettlementRequested(uint256 indexed parlayId)",
]);

// ===========================
// ParlayEngine Contract ABIs
// ===========================

const GET_PARLAY_ABI = [
  {
    name: "getParlay",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "parlayId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "creator", type: "address" },
          { name: "createdAt", type: "uint48" },
          { name: "stake", type: "uint256" },
          { name: "potentialPayout", type: "uint256" },
          { name: "legCount", type: "uint8" },
          { name: "settled", type: "bool" },
          { name: "won", type: "bool" },
          { name: "voided", type: "bool" },
          { name: "claimed", type: "bool" },
        ],
      },
    ],
  },
] as const;

const GET_PARLAY_LEGS_ABI = [
  {
    name: "getParlayLegs",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "parlayId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "marketId", type: "uint256" },
          { name: "prediction", type: "uint8" },
          { name: "multiplierBps", type: "uint256" },
        ],
      },
    ],
  },
] as const;

// PredictionMarket.getDispute() ABI
const GET_DISPUTE_ABI = [
  {
    name: "getDispute",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "marketId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "disputer", type: "address" },
          { name: "filedAt", type: "uint48" },
          { name: "stake", type: "uint256" },
          { name: "resolved", type: "bool" },
          { name: "overturned", type: "bool" },
        ],
      },
    ],
  },
] as const;

const PARLAY_SETTLEMENT_PARAMS = parseAbiParameters(
  "uint256 parlayId, bool won, bool voided, uint256 payout"
);

// ===========================
// Types
// ===========================

interface Parlay {
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

interface ParlayLeg {
  marketId: bigint;
  prediction: number;
  multiplierBps: bigint;
}

interface Dispute {
  disputer: string;
  filedAt: number;
  stake: bigint;
  resolved: boolean;
  overturned: boolean;
}

// ===========================
// Read Helpers
// ===========================

function readParlay(runtime: Runtime<Config>, parlayId: bigint): Parlay {
  const evmConfig = runtime.config.evms[0];
  if (!evmConfig.parlayAddress) {
    throw new Error("parlayAddress not configured");
  }

  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: evmConfig.chainSelectorName,
    isTestnet: true,
  });
  if (!network) throw new Error(`Unknown chain: ${evmConfig.chainSelectorName}`);

  const client = new cre.capabilities.EVMClient(network.chainSelector.selector);
  const callData = encodeFunctionData({
    abi: GET_PARLAY_ABI,
    functionName: "getParlay",
    args: [parlayId],
  });

  const result = client
    .callContract(runtime, {
      call: encodeCallMsg({
        from: zeroAddress,
        to: evmConfig.parlayAddress as `0x${string}`,
        data: callData,
      }),
    })
    .result();

  return decodeFunctionResult({
    abi: GET_PARLAY_ABI,
    functionName: "getParlay",
    data: bytesToHex(result.data),
  }) as unknown as Parlay;
}

function readParlayLegs(runtime: Runtime<Config>, parlayId: bigint): ParlayLeg[] {
  const evmConfig = runtime.config.evms[0];
  if (!evmConfig.parlayAddress) {
    throw new Error("parlayAddress not configured");
  }

  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: evmConfig.chainSelectorName,
    isTestnet: true,
  });
  if (!network) throw new Error(`Unknown chain: ${evmConfig.chainSelectorName}`);

  const client = new cre.capabilities.EVMClient(network.chainSelector.selector);
  const callData = encodeFunctionData({
    abi: GET_PARLAY_LEGS_ABI,
    functionName: "getParlayLegs",
    args: [parlayId],
  });

  const result = client
    .callContract(runtime, {
      call: encodeCallMsg({
        from: zeroAddress,
        to: evmConfig.parlayAddress as `0x${string}`,
        data: callData,
      }),
    })
    .result();

  return decodeFunctionResult({
    abi: GET_PARLAY_LEGS_ABI,
    functionName: "getParlayLegs",
    data: bytesToHex(result.data),
  }) as unknown as ParlayLeg[];
}

function readDispute(runtime: Runtime<Config>, marketId: bigint): Dispute {
  const evmConfig = runtime.config.evms[0];
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: evmConfig.chainSelectorName,
    isTestnet: true,
  });
  if (!network) throw new Error(`Unknown chain: ${evmConfig.chainSelectorName}`);

  const client = new cre.capabilities.EVMClient(network.chainSelector.selector);
  const callData = encodeFunctionData({
    abi: GET_DISPUTE_ABI,
    functionName: "getDispute",
    args: [marketId],
  });

  const result = client
    .callContract(runtime, {
      call: encodeCallMsg({
        from: zeroAddress,
        to: evmConfig.marketAddress as `0x${string}`,
        data: callData,
      }),
    })
    .result();

  return decodeFunctionResult({
    abi: GET_DISPUTE_ABI,
    functionName: "getDispute",
    data: bytesToHex(result.data),
  }) as unknown as Dispute;
}

// ===========================
// Write Helper
// ===========================

function writeParlaySettlement(
  runtime: Runtime<Config>,
  parlayId: bigint,
  won: boolean,
  voided: boolean,
  payout: bigint
): string {
  const evmConfig = runtime.config.evms[0];
  if (!evmConfig.parlayAddress) {
    throw new Error("parlayAddress not configured");
  }

  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: evmConfig.chainSelectorName,
    isTestnet: true,
  });
  if (!network) throw new Error(`Unknown chain: ${evmConfig.chainSelectorName}`);

  const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector);

  const settlementData = encodeAbiParameters(PARLAY_SETTLEMENT_PARAMS, [
    parlayId,
    won,
    voided,
    payout,
  ]);

  // 0x03 prefix → ParlayEngine._processReport routes to _settleParlay
  const reportData = ("0x03" + settlementData.slice(2)) as `0x${string}`;

  const reportResponse = runtime
    .report({
      encodedPayload: hexToBase64(reportData),
      encoderName: "evm",
      signingAlgo: "ecdsa",
      hashingAlgo: "keccak256",
    })
    .result();

  const writeResult = evmClient
    .writeReport(runtime, {
      receiver: evmConfig.parlayAddress,
      report: reportResponse,
      gasConfig: {
        gasLimit: evmConfig.gasLimit,
      },
    })
    .result();

  if (writeResult.txStatus === TxStatus.SUCCESS) {
    return bytesToHex(writeResult.txHash || new Uint8Array(32));
  }

  throw new Error(`Parlay settlement transaction failed: ${writeResult.txStatus}`);
}

// ===========================
// Main Handler
// ===========================

/**
 * Handles ParlaySettlementRequested log events — CRE cross-contract orchestration.
 *
 * Flow:
 * 1. Decode ParlaySettlementRequested(parlayId) event from ParlayEngine
 * 2. Read parlay + legs from ParlayEngine (Contract B)
 * 3. For each leg: read market + dispute from PredictionMarket (Contract A)
 * 4. Verify: all settled, all disputes resolved
 * 5. Determine: won (all predictions match) / voided (any cancelled) / lost
 * 6. Write 0x03 settlement report to ParlayEngine
 */
export function onParlayTrigger(runtime: Runtime<Config>, log: EVMLog): string {
  runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  runtime.log("CRE Workflow: Parlay Settlement — Cross-Contract Orchestration");
  runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  try {
    // Step 1: Decode ParlaySettlementRequested event
    const topics = log.topics.map((t: Uint8Array) => bytesToHex(t)) as [
      `0x${string}`,
      ...`0x${string}`[]
    ];
    const data = bytesToHex(log.data);

    const decodedLog = decodeEventLog({ abi: PARLAY_EVENT_ABI, data, topics });
    const parlayId = decodedLog.args.parlayId as bigint;

    runtime.log(`[Parlay] Settlement requested for Parlay #${parlayId}`);

    // Step 2: Read parlay state from ParlayEngine
    const parlay = readParlay(runtime, parlayId);

    if (parlay.creator === "0x0000000000000000000000000000000000000000") {
      runtime.log(`[Parlay] Parlay #${parlayId} does not exist, skipping`);
      return "does not exist";
    }
    if (parlay.settled) {
      runtime.log(`[Parlay] Parlay #${parlayId} already settled, skipping`);
      return "already settled";
    }

    runtime.log(`[Parlay] Stake: ${parlay.stake} wei | Potential: ${parlay.potentialPayout} wei | Legs: ${parlay.legCount}`);

    // Step 3: Read all legs from ParlayEngine
    const legs = readParlayLegs(runtime, parlayId);
    runtime.log(`[Parlay] Loaded ${legs.length} legs`);

    // Step 4: Verify each leg via PredictionMarket (cross-contract reads)
    let allWon = true;
    let anyVoided = false;

    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];

      // Read market from PredictionMarket (Contract A)
      const market = readMarket(runtime, leg.marketId);
      runtime.log(`[Parlay]   Leg ${i + 1}: Market #${leg.marketId} — "${market.question}"`);

      // Verify market is settled
      if (!market.settled) {
        runtime.log(`[Parlay]   ✗ Market #${leg.marketId} not yet settled`);
        throw new Error(`Leg market #${leg.marketId} not yet settled — cannot settle parlay`);
      }

      // Verify no unresolved disputes
      const dispute = readDispute(runtime, leg.marketId);
      if (dispute.disputer !== "0x0000000000000000000000000000000000000000" && !dispute.resolved) {
        runtime.log(`[Parlay]   ✗ Market #${leg.marketId} has unresolved dispute`);
        throw new Error(`Leg market #${leg.marketId} has unresolved dispute — cannot settle parlay`);
      }

      // Check for cancelled market (confidence == 0)
      if (market.confidence === 0) {
        runtime.log(`[Parlay]   ⚠ Market #${leg.marketId} cancelled (confidence=0) → parlay voided`);
        anyVoided = true;
        continue;
      }

      // Compare prediction vs actual outcome
      const predicted = leg.prediction; // 0=YES, 1=NO
      const actual = market.outcome;    // 0=YES, 1=NO
      const legWon = predicted === actual;

      runtime.log(`[Parlay]   Predicted: ${predicted === 0 ? "YES" : "NO"} | Actual: ${actual === 0 ? "YES" : "NO"} → ${legWon ? "✓ HIT" : "✗ MISS"}`);

      if (!legWon) {
        allWon = false;
      }
    }

    // Step 5: Determine result
    const voided = anyVoided;
    const won = !voided && allWon;
    const payout = won ? parlay.potentialPayout : (voided ? parlay.stake : 0n);

    runtime.log(`[Parlay] ──────────────────────────────────────`);
    runtime.log(`[Parlay] Result: ${voided ? "VOIDED (refund)" : won ? "WON ✓" : "LOST ✗"}`);
    runtime.log(`[Parlay] Payout: ${payout} wei`);

    // Step 6: Write 0x03 settlement report to ParlayEngine
    const txHash = writeParlaySettlement(runtime, parlayId, won, voided, payout);

    runtime.log(`[Parlay] Settlement written to chain: ${txHash}`);
    runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return `Parlay #${parlayId} settled: ${voided ? "voided" : won ? "won" : "lost"} — ${txHash}`;

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    runtime.log(`[ERROR] Parlay settlement failed: ${msg}`);
    runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    throw err;
  }
}
