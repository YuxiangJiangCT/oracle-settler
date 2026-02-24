// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

interface IWorldID {
    /// @notice Verifies a World ID zero-knowledge proof.
    /// @param root The Merkle root of the identity group.
    /// @param groupId The identity group (1 = Orb-verified).
    /// @param signalHash Hash of the signal (e.g., sender address).
    /// @param nullifierHash Unique nullifier preventing double-signaling.
    /// @param externalNullifierHash Hash of the external nullifier (app+action).
    /// @param proof The ZK proof (8 uint256 elements).
    function verifyProof(
        uint256 root,
        uint256 groupId,
        uint256 signalHash,
        uint256 nullifierHash,
        uint256 externalNullifierHash,
        uint256[8] calldata proof
    ) external view;
}
