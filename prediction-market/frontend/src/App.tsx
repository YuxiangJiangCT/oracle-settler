import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { SEPOLIA } from "./contract";
import { MarketList } from "./MarketList";
import "./App.css";

declare global {
  interface Window {
    ethereum?: any;
  }
}

function App() {
  const [account, setAccount] = useState<string | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [wrongNetwork, setWrongNetwork] = useState(false);

  const isMetaMaskInstalled = typeof window.ethereum !== "undefined";

  const switchToSepolia = async () => {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA.chainIdHex }],
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: SEPOLIA.chainIdHex,
              chainName: SEPOLIA.name,
              rpcUrls: [SEPOLIA.rpcUrl],
              blockExplorerUrls: [SEPOLIA.blockExplorer],
              nativeCurrency: SEPOLIA.currency,
            },
          ],
        });
      }
    }
  };

  const connectWallet = async () => {
    if (!isMetaMaskInstalled) {
      window.open("https://metamask.io/download/", "_blank");
      return;
    }

    try {
      const prov = new ethers.BrowserProvider(window.ethereum);
      await prov.send("eth_requestAccounts", []);
      const signer = await prov.getSigner();
      const address = await signer.getAddress();
      const network = await prov.getNetwork();
      const currentChain = Number(network.chainId);

      setProvider(prov);
      setAccount(address);
      setChainId(currentChain);
      setWrongNetwork(currentChain !== SEPOLIA.chainId);
    } catch (err) {
      console.error("Connection error:", err);
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setProvider(null);
    setChainId(null);
    setWrongNetwork(false);
  };

  // Listen for wallet events
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else {
        setAccount(accounts[0]);
      }
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum?.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener("chainChanged", handleChainChanged);
    };
  }, []);

  // Auto-connect
  useEffect(() => {
    if (!isMetaMaskInstalled) return;
    const checkConnection = async () => {
      const prov = new ethers.BrowserProvider(window.ethereum);
      const accounts = await prov.listAccounts();
      if (accounts.length > 0) {
        const network = await prov.getNetwork();
        const currentChain = Number(network.chainId);
        setProvider(prov);
        setAccount(accounts[0].address);
        setChainId(currentChain);
        setWrongNetwork(currentChain !== SEPOLIA.chainId);
      }
    };
    checkConnection();
  }, [isMetaMaskInstalled]);

  return (
    <div className="app-container">
      {/* Nav */}
      <nav className="nav-bar">
        <div className="nav-logo">
          <span className="logo-text">OracleSettler</span>
          <span className="chain-badge">SEPOLIA</span>
          <span className="cre-badge">CRE</span>
        </div>
        <div className="nav-buttons">
          {!account ? (
            <button className="connect-btn" onClick={connectWallet}>
              {isMetaMaskInstalled ? "Connect Wallet" : "Install MetaMask"}
            </button>
          ) : (
            <div className="wallet-info">
              <span className="network-pill">
                {chainId === SEPOLIA.chainId ? "Sepolia" : `Chain ${chainId}`}
              </span>
              <span className="address-pill">
                {account.slice(0, 6)}...{account.slice(-4)}
              </span>
              <button className="disconnect-btn" onClick={disconnectWallet}>
                Disconnect
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Main */}
      <main className="main-content">
        {wrongNetwork ? (
          <div className="hero-panel">
            <h2>Wrong Network</h2>
            <p>Please switch to Sepolia Testnet to interact with OracleSettler.</p>
            <button className="connect-btn large" onClick={switchToSepolia}>
              Switch to Sepolia
            </button>
          </div>
        ) : !account ? (
          <>
            {/* Show markets even without wallet */}
            <MarketList provider={null} account={null} />

            {/* Connect prompt at bottom */}
            <div className="hero-panel" style={{ marginTop: 32 }}>
              <h3>Connect to Interact</h3>
              <p>Connect your wallet to place predictions, request settlements, and claim winnings.</p>
              <button className="connect-btn large" onClick={connectWallet}>
                {isMetaMaskInstalled ? "Connect Wallet" : "Install MetaMask"}
              </button>
              <p className="hint">
                Powered by Chainlink CRE — AI-verified oracle settlements
              </p>
            </div>
          </>
        ) : (
          <MarketList provider={provider} account={account} />
        )}
      </main>

      {/* Footer */}
      <footer className="powered-by">
        Powered by{" "}
        <a href="https://chain.link" target="_blank" rel="noopener noreferrer">
          Chainlink CRE
        </a>{" "}
        | AI-Verified Oracle Settlements on Sepolia
      </footer>
    </div>
  );
}

export default App;
