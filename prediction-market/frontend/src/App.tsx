import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import {
  SEPOLIA,
  PREDICTION_MARKET_ABI,
  CONTRACT_ADDRESS,
} from "./contract";
import type { Market } from "./contract";
import { MarketList } from "./MarketList";
import { PriceComparison } from "./PriceComparison";
import { CreateMarket } from "./CreateMarket";
import { About } from "./About";
import "./App.css";

declare global {
  interface Window {
    ethereum?: any;
  }
}

type Page = "markets" | "compare" | "create" | "about";

function App() {
  const [account, setAccount] = useState<string | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [wrongNetwork, setWrongNetwork] = useState(false);
  const [page, setPage] = useState<Page>("markets");

  // Shared market data for PriceComparison
  const [markets, setMarkets] = useState<{ id: number; data: Market }[]>([]);

  const isMetaMaskInstalled = typeof window.ethereum !== "undefined";

  const loadMarkets = useCallback(async () => {
    try {
      const rpcProvider =
        provider || new ethers.JsonRpcProvider(SEPOLIA.rpcUrl);
      const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        PREDICTION_MARKET_ABI,
        rpcProvider
      );
      const nextId = await contract.getNextMarketId();
      const count = Number(nextId);
      const loaded: { id: number; data: Market }[] = [];

      for (let i = 0; i < count; i++) {
        try {
          const m = await contract.getMarket(i);
          loaded.push({
            id: i,
            data: {
              creator: m[0],
              createdAt: Number(m[1]),
              settledAt: Number(m[2]),
              deadline: Number(m[3]),
              settled: m[4],
              confidence: Number(m[5]),
              outcome: Number(m[6]),
              totalYesPool: m[7],
              totalNoPool: m[8],
              question: m[9],
              asset: m[10],
              targetPrice: m[11],
              settledPrice: m[12],
            },
          });
        } catch {
          // skip individual market errors
        }
      }
      setMarkets(loaded);
    } catch (err) {
      console.error("Failed to load markets:", err);
    }
  }, [provider]);

  useEffect(() => {
    loadMarkets();
  }, [loadMarkets]);

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

  const renderPage = () => {
    if (wrongNetwork) {
      return (
        <div className="hero-panel">
          <h2>Wrong Network</h2>
          <p>Please switch to Sepolia Testnet to interact with OracleSettler.</p>
          <button className="connect-btn large" onClick={switchToSepolia}>
            Switch to Sepolia
          </button>
        </div>
      );
    }

    switch (page) {
      case "markets":
        return (
          <>
            <MarketList provider={provider} account={account} />
            {!account && (
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
            )}
          </>
        );
      case "compare":
        return <PriceComparison markets={markets} />;
      case "create":
        return provider && account ? (
          <CreateMarket
            provider={provider}
            onCreated={() => {
              loadMarkets();
              setPage("markets");
            }}
          />
        ) : (
          <div className="hero-panel">
            <h3>Connect Wallet</h3>
            <p>You need to connect your wallet to create a market.</p>
            <button className="connect-btn large" onClick={connectWallet}>
              {isMetaMaskInstalled ? "Connect Wallet" : "Install MetaMask"}
            </button>
          </div>
        );
      case "about":
        return <About />;
    }
  };

  return (
    <div className="app-container">
      {/* Nav */}
      <nav className="nav-bar">
        <div className="nav-left">
          <div className="nav-logo">
            <span className="logo-text" onClick={() => setPage("markets")} style={{ cursor: "pointer" }}>
              OracleSettler
            </span>
            <span className="chain-badge">SEPOLIA</span>
            <span className="cre-badge">CRE</span>
          </div>
          <div className="nav-tabs">
            <button
              className={`nav-tab ${page === "markets" ? "active" : ""}`}
              onClick={() => setPage("markets")}
            >
              Markets
            </button>
            <button
              className={`nav-tab ${page === "compare" ? "active" : ""}`}
              onClick={() => setPage("compare")}
            >
              Compare
            </button>
            <button
              className={`nav-tab ${page === "create" ? "active" : ""}`}
              onClick={() => setPage("create")}
            >
              Create
            </button>
            <button
              className={`nav-tab ${page === "about" ? "active" : ""}`}
              onClick={() => setPage("about")}
            >
              About
            </button>
          </div>
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
        <div key={page} className="page-transition">
          {renderPage()}
        </div>
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
