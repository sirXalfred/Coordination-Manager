---
description: Estimate Cardano transaction fees, min-ADA, and Plutus execution costs
---

# cardano-fee-modeling

## Purpose

Guides estimation of Cardano transaction fees, minimum ADA requirements (min-UTxO),
and Plutus execution unit budgets. Used for fee preview UX, off-chain calculators,
and validating GCScript transactions before mainnet submission.

## When to Use

- Showing users estimated fees before they confirm a transaction
- Calculating min-ADA when creating UTxOs with tokens or datum
- Estimating Plutus execution costs (ExUnits: memory + CPU steps)
- Building fee breakdowns for governance, minting, or staking transactions
- Validating GCScript scripts will not fail due to insufficient fees

## Workflow

1. Identify transaction type (payment, mint, Plutus, staking, governance)
2. Fetch current protocol parameters from Blockfrost or connected node
3. Estimate transaction size using the size table in references/fee-reference.md
4. Calculate linear fee: `fee = minFeeA * txSizeBytes + minFeeB`
5. If Plutus: add execution fee from ExUnits estimate (see Plutus table in references)
6. If creating token UTxOs: calculate min-ADA using `utxoCostPerByte * (160 + valueSize)`
7. Add 10% buffer to minimum fee for recommended fee
8. Format as ADA (divide lovelace by 1,000,000) for user display
9. After `buildTx`, read actual fee from `cache.build.tx.body.fee` macro
10. Show fee as informational (not blocking) in the UI

## Outputs

| Output | Location | Format |
|--------|----------|--------|
| Fee estimate object | Service layer return | FeeEstimate interface (see references) |
| Min-ADA calculation | Token UTxO creation | bigint lovelace |
| User-facing fee | UI component | "0.17 ADA" string |
| Actual fee (post-build) | GCScript cache | lovelace from buildTx result |

## Constraints

- NEVER hardcode protocol parameters -- fetch from API or use as fallback only
- ALWAYS add 10% buffer above minimum fee to avoid rejection
- ALWAYS calculate min-ADA for outputs containing native tokens
- Display fees in ADA format ("0.17 ADA") not raw lovelace in user-facing UI
- Mark Plutus cost estimates as approximations (exact cost requires node evaluation)
- Do NOT block transaction flow on fee estimates -- show as informational
- Use `buildTx` actual fee over estimates when available (post-build)
- Cardano has NO fee market -- fees are deterministic, only wait time changes under load

## Self-Validation

### Trigger Indicators
- [ ] Feature shows ADA amounts or transaction costs to the user
- [ ] Script builds a Cardano transaction (payment, mint, Plutus)
- [ ] Need to estimate min-ADA for a token UTxO
- [ ] Designing fee preview UX before wallet confirmation

### Completion Markers
- [ ] Fee estimate uses current protocol parameters (not hardcoded)
- [ ] Min-ADA calculated for any output containing native tokens
- [ ] 10% buffer added above minimum to avoid tx rejection
- [ ] Fees shown in ADA (not lovelace) in user-facing UI
- [ ] FeeEstimate interface used with all required fields

### Quality Signals
- [ ] Fees formatted as "0.17 ADA" not "170000 lovelace" in UI
- [ ] Plutus cost estimates clearly marked as approximations
- [ ] Real fee read from buildTx result when available
- [ ] Protocol params fetched, not assumed
