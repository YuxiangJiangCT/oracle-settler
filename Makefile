.PHONY: install build test dev deploy clean demo-create demo-predict demo-settle

# ── Config ──────────────────────────────────────────────
PM_DIR     := prediction-market
CONTRACTS  := $(PM_DIR)/contracts
FRONTEND   := $(PM_DIR)/frontend
WORKFLOW   := $(PM_DIR)/my-workflow
RPC        := https://ethereum-sepolia-rpc.publicnode.com
CONTRACT   := 0x204173d93b41D76c467D6A75856Ba03A3412B10d

# ── Install ─────────────────────────────────────────────
install:
	@echo "Installing all dependencies..."
	cd $(CONTRACTS) && forge install --no-commit
	cd $(WORKFLOW) && bun install
	cd $(FRONTEND) && npm install

# ── Build ───────────────────────────────────────────────
build:
	@echo "Building contracts..."
	cd $(CONTRACTS) && forge build
	@echo "Building frontend..."
	cd $(FRONTEND) && npm run build

# ── Test ────────────────────────────────────────────────
test:
	@echo "Running contract tests..."
	cd $(CONTRACTS) && forge test -vvv
	@echo ""
	@echo "All tests passed!"

# ── Dev ─────────────────────────────────────────────────
dev:
	cd $(FRONTEND) && npm run dev

# ── Deploy ──────────────────────────────────────────────
deploy:
	@test -n "$(PK)" || (echo "Usage: make deploy PK=<private-key>" && exit 1)
	cd $(CONTRACTS) && forge create --broadcast \
		--rpc-url $(RPC) \
		--private-key $(PK) \
		src/PredictionMarket.sol:PredictionMarket \
		--constructor-args 0x15fc6ae953e024d975e77382eeec56a9101f9f88

# ── Demo Commands ───────────────────────────────────────
demo-create:
	@test -n "$(PK)" || (echo "Usage: make demo-create PK=<private-key>" && exit 1)
	cast send --rpc-url $(RPC) --private-key $(PK) $(CONTRACT) \
		"createMarket(string,string,uint256)" \
		"Will BTC be above 100000 USD?" "bitcoin" 100000000000

demo-predict:
	@test -n "$(PK)" || (echo "Usage: make demo-predict PK=<private-key> ID=<marketId> SIDE=<0|1> AMT=<eth>" && exit 1)
	cast send --rpc-url $(RPC) --private-key $(PK) --value $(AMT)ether $(CONTRACT) \
		"predict(uint256,uint8)" $(ID) $(SIDE)

demo-settle:
	@test -n "$(PK)" || (echo "Usage: make demo-settle PK=<private-key> ID=<marketId>" && exit 1)
	cast send --rpc-url $(RPC) --private-key $(PK) $(CONTRACT) \
		"requestSettlement(uint256)" $(ID)

# ── Clean ───────────────────────────────────────────────
clean:
	cd $(CONTRACTS) && forge clean
	rm -rf $(FRONTEND)/dist
	@echo "Cleaned build artifacts."
