export function About() {
  const capabilities = [
    { name: "HTTP Trigger", desc: "Market creation via webhook" },
    { name: "Log Trigger", desc: "Event-driven on-demand settlement" },
    { name: "Cron Trigger", desc: "Auto-settlement scan every 6 hours" },
    { name: "EVM Read", desc: "Read market data from smart contract" },
    { name: "EVM Write", desc: "Write signed settlement report on-chain" },
    { name: "Confidential HTTP (CoinGecko)", desc: "Primary price oracle" },
    { name: "Confidential HTTP (CoinCap)", desc: "Secondary price source for dual-source consensus" },
    { name: "Confidential HTTP (Gemini AI)", desc: "AI judgment for borderline cases" },
    { name: "Consensus Aggregation", desc: "Multi-node agreement on settlement data" },
    { name: "Custom Compute", desc: "Price threshold logic + source divergence check" },
    { name: "Log Trigger (Dispute)", desc: "Dispute-filed event triggers strict re-verification" },
    { name: "Strict Compute", desc: "Dispute re-verification with 70% confidence threshold" },
  ];

  return (
    <div className="about-page">
      <h2 className="about-title">About OracleSettler</h2>
      <p className="about-intro">
        Automated prediction market settlement using dual-source price consensus,
        AI judgment, and Chainlink CRE for trustless on-chain execution.
      </p>

      {/* How It Works */}
      <div className="about-section">
        <h3>How Settlement Works</h3>
        <div className="about-steps">
          <div className="about-step">
            <span className="about-step-num">1</span>
            <div>
              <strong>Create Market</strong>
              <p>Specify a question, asset (e.g. "bitcoin"), and target price</p>
            </div>
          </div>
          <div className="about-step">
            <span className="about-step-num">2</span>
            <div>
              <strong>Place Predictions</strong>
              <p>Bet YES or NO with ETH. Parimutuel odds update in real-time</p>
            </div>
          </div>
          <div className="about-step">
            <span className="about-step-num">3</span>
            <div>
              <strong>Request Settlement</strong>
              <p>Anyone can trigger CRE to settle the market</p>
            </div>
          </div>
          <div className="about-step">
            <span className="about-step-num">4</span>
            <div>
              <strong>Dual-Source Price Fetch</strong>
              <p>CRE fetches from CoinGecko + CoinCap via Confidential HTTP. If sources diverge &gt;2%, settlement is rejected</p>
            </div>
          </div>
          <div className="about-step">
            <span className="about-step-num">5</span>
            <div>
              <strong>Outcome Determination</strong>
              <p>&gt;5% from target = instant settlement. &lt;5% = Gemini AI provides nuanced judgment</p>
            </div>
          </div>
          <div className="about-step">
            <span className="about-step-num">6</span>
            <div>
              <strong>On-Chain Settlement</strong>
              <p>CRE consensus signs and writes the result to the smart contract</p>
            </div>
          </div>
          <div className="about-step">
            <span className="about-step-num">7</span>
            <div>
              <strong>Dispute Window</strong>
              <p>1-hour challenge period after settlement. Stake 0.001 ETH to dispute the outcome</p>
            </div>
          </div>
          <div className="about-step">
            <span className="about-step-num">8</span>
            <div>
              <strong>Dispute Resolution</strong>
              <p>CRE re-verifies in strict mode (70% threshold). Overturned = stake returned, outcome flipped</p>
            </div>
          </div>
        </div>
      </div>

      {/* CRE Capabilities */}
      <div className="about-section">
        <h3>CRE Capabilities Used</h3>
        <p className="about-section-desc">
          OracleSettler leverages 12 distinct Chainlink CRE capabilities across 4 trigger types.
        </p>
        <div className="capabilities-grid">
          {capabilities.map((cap, i) => (
            <div key={i} className="capability-card">
              <span className="cap-number">{i + 1}</span>
              <div>
                <span className="cap-name">{cap.name}</span>
                <p className="cap-desc">{cap.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Key Innovation */}
      <div className="about-section">
        <h3>Key Innovation</h3>
        <div className="innovation-cards">
          <div className="innovation-card">
            <h4>Dual-Source Consensus</h4>
            <p>
              Unlike single-oracle systems, OracleSettler fetches from two independent
              price APIs. If they diverge by &gt;2%, settlement is rejected — preventing
              manipulation from a single compromised source.
            </p>
          </div>
          <div className="innovation-card">
            <h4>AI + Oracle Hybrid</h4>
            <p>
              When prices are within 5% of the target (ambiguous zone), Gemini AI
              provides nuanced judgment with a confidence score — combining the precision
              of real data with the reasoning of AI.
            </p>
          </div>
          <div className="innovation-card">
            <h4>Settlement Explorer</h4>
            <p>
              Every settlement is fully transparent. The Settlement Explorer shows
              exactly which CRE capabilities were used, what prices were fetched,
              and how the outcome was determined.
            </p>
          </div>
          <div className="innovation-card">
            <h4>Dispute Arbitration</h4>
            <p>
              After settlement, a 1-hour dispute window allows anyone to challenge
              the outcome by staking ETH. CRE re-verifies with a stricter 70%
              confidence threshold — ensuring fair, decentralized arbitration.
            </p>
          </div>
        </div>
      </div>

      {/* Links */}
      <div className="about-links">
        <a href="https://github.com/YuxiangJiangCT/oracle-settler" target="_blank" rel="noopener noreferrer" className="about-link">
          GitHub Repository
        </a>
        <a href="https://sepolia.etherscan.io/address/0x51CC15B53d776b2B7a76Fa30425e8f9aD2aec1a5" target="_blank" rel="noopener noreferrer" className="about-link">
          Contract on Etherscan
        </a>
        <a href="https://chain.link/cre" target="_blank" rel="noopener noreferrer" className="about-link">
          Chainlink CRE Docs
        </a>
      </div>
    </div>
  );
}
