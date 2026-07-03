# Cardano Fee Reference Data

## Core Fee Formula (Cardano Shelley+ era)

```
fee = a * tx_size_bytes + b
```

Where (mainnet protocol parameters as of 2025):
- `a` = `44` (minFeeA: lovelace per byte)
- `b` = `155381` (minFeeB: constant lovelace)
- `tx_size_bytes` = serialised CBOR size of the transaction

For Plutus script transactions, add execution cost:
```
execution_fee = (priceMemory * memUnits) + (priceSteps * cpuSteps)
```

Where (approximate mainnet values):
- `priceMemory` = `0.0577` lovelace per memory unit
- `priceSteps` = `0.0000721` lovelace per CPU step

Total fee = linear fee + execution fee (rounded up to nearest lovelace)

## Minimum ADA (min-UTxO) Rules

Every Cardano UTxO must carry at least `minUTxOValue` lovelace. When tokens
are present the minimum increases based on the byte size of the value bundle.

### Formula (Babbage era, Alonzo+ params)

```
minLovelace = utxoCostPerByte * (160 + |serialised_value|)
```

Where:
- `utxoCostPerByte` = `4310` lovelace (mainnet 2025 approx)
- `160` = overhead bytes (address + pointer)
- `|serialised_value|` = CBOR size of the token/ADA bundle

### Quick Approximations

| Scenario | Approx min ADA |
|----------|---------------|
| Pure ADA output | 1.0 ADA |
| 1 native asset + ADA | 1.3 -- 1.5 ADA |
| 5 native assets + ADA | 1.8 -- 2.2 ADA |
| NFT with metadata datum | 1.5 -- 2.5 ADA |
| Inline datum (small) | +0.3 -- 0.5 ADA |

Always add 10-20% buffer above the minimum to avoid dust issues.

## Transaction Size Estimation

| Transaction Type | Size (bytes) |
|-----------------|-------------|
| Simple ADA payment (1-in, 1-out) | 190 -- 250 |
| Payment + change (1-in, 2-out) | 260 -- 320 |
| Multi-asset transfer (2-in, 2-out) | 400 -- 600 |
| NFT mint + send (1 asset) | 450 -- 700 |
| Plutus script (simple) | 600 -- 1200 |
| Multi-sig (3-of-5) | 800 -- 1500 |

## Plutus Execution Unit Budgeting

| Script type | Approx CPU steps | Approx Memory units | Added fee (ADA) |
|-------------|-----------------|--------------------|----|
| Simple timelock | 0 | 0 | +0 ADA (native, not Plutus) |
| Simple multisig | 0 | 0 | +0 ADA (native) |
| Plutus V2 validator (simple) | ~200M | ~200K | ~0.08 ADA |
| Plutus V2 validator (complex) | ~2B | ~2M | ~0.8 ADA |
| Minting policy | ~500M | ~500K | ~0.2 ADA |

## Network Effect Data

| Metric | Value (mainnet 2025) |
|--------|---------------------|
| Max block size | 90,112 bytes |
| Max block execution units | 62B CPU steps / 62M memory units |
| Block time | ~20 seconds (1 slot) |
| Throughput (simple tx) | ~250 -- 300 tx/block |
| Throughput (Plutus tx) | ~50 -- 100 tx/block |

Cardano does NOT use a fee market. Fees are deterministic from tx size and
execution units. During congestion, transactions wait longer but fees stay the same.

## Code Patterns

### Simple fee estimation

```typescript
function estimateFee(txSizeBytes: number): bigint {
  const minFeeA = 44n
  const minFeeB = 155381n
  return minFeeA * BigInt(txSizeBytes) + minFeeB
}
```

### Min-ADA calculation for token UTxO

```typescript
function calculateMinAda(tokenCount: number, policyIdCount: number, hasInlineDatum = false): bigint {
  const utxoCostPerByte = 4310n
  const valueBytes = 160n + BigInt(policyIdCount) * 28n + BigInt(tokenCount) * 12n + (hasInlineDatum ? 50n : 0n)
  return utxoCostPerByte * valueBytes
}
```

### Fee estimate interface

```typescript
interface FeeEstimate {
  minFeeLovelace: bigint
  recommendedFeeLovelace: bigint  // add 10% buffer
  minAdaLovelace: bigint
  totalLovelace: bigint
  adaFormatted: string            // "0.17 ADA"
}

function formatLovelace(lovelace: bigint): string {
  return `${(Number(lovelace) / 1_000_000).toFixed(2)} ADA`
}
```

### Reading fee from GCScript buildTx result

```json
{
  "type": "script",
  "exportAs": "txResult",
  "run": {
    "build": { "type": "buildTx", "params": { "outputs": [...] } },
    "feeInfo": { "type": "macro", "run": "{ get('cache.build.tx.body.fee') }" }
  }
}
```
