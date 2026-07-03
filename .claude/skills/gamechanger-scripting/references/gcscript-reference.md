# GCScript Templates and Reference

## Script Templates

### 1. Connect and share address (auth use case)

```json
{
  "type": "script",
  "title": "Sign in to Coordination Manager",
  "description": "Share your wallet address and name to create or sign in to your account",
  "exportAs": "connect",
  "returnURLPattern": "https://coordinationmanager.com/auth/wallet-return?result={result}",
  "run": {
    "address": { "type": "getCurrentAddress" },
    "name": { "type": "getName" },
    "networkInfo": { "type": "getNetworkInfo" }
  }
}
```

### 2. Sign a challenge nonce (secure auth)

```json
{
  "type": "script",
  "title": "Prove wallet ownership",
  "description": "Sign a one-time challenge to authenticate -- no transaction submitted",
  "exportAs": "authProof",
  "returnURLPattern": "https://coordinationmanager.com/auth/wallet-return?result={result}",
  "run": {
    "address": { "type": "getCurrentAddress" },
    "signature": {
      "type": "signData",
      "address": "{ get('cache.address') }",
      "payload": "{ toHex('Coordination Manager Login\\nNonce: NONCE_PLACEHOLDER') }"
    }
  }
}
```

### 3. Simple ADA payment (build -> sign -> submit)

```json
{
  "type": "script",
  "title": "Send ADA",
  "description": "Send 5 ADA to a recipient address",
  "exportAs": "payment",
  "run": {
    "build": {
      "type": "buildTx",
      "params": {
        "outputs": [{
          "address": "addr1...",
          "assets": [{ "policyId": "ada", "assetName": "ada", "quantity": "5000000" }]
        }]
      }
    },
    "sign": { "type": "signTx", "tx": "{ get('cache.build.tx') }" },
    "submit": { "type": "submitTx", "tx": "{ get('cache.sign.tx') }" }
  }
}
```

### 4. Mint a native token

```json
{
  "type": "script",
  "title": "Mint Token",
  "description": "Mint 100 of MyToken to your wallet",
  "exportAs": "mint",
  "run": {
    "myMint": {
      "type": "mintTokens",
      "tokens": [{
        "assetName": "MyToken",
        "quantity": "100",
        "metadata": {
          "721": {
            "{ get('cache.myMint.policyId') }": {
              "MyToken": { "name": "My Token", "description": "A sample token" }
            }
          }
        }
      }]
    }
  }
}
```

### 5. Multi-network adaptive script

```json
{
  "type": "script",
  "title": "Adaptive Network Script",
  "exportAs": "result",
  "run": {
    "networkInfo": { "type": "getNetworkInfo" },
    "networkKey": {
      "type": "macro",
      "run": "{ join('-', get('cache.networkInfo.dltTag'), get('cache.networkInfo.networkTag')) }"
    },
    "address": { "type": "getCurrentAddress" }
  }
}
```

### 6. Rich connection with key info

```json
{
  "type": "script",
  "title": "Connect with dapp",
  "description": "Share wallet info including public keys and address details",
  "exportAs": "connect",
  "run": {
    "name": { "type": "getName" },
    "address": { "type": "getCurrentAddress" },
    "spendPubKey": { "type": "getSpendingPublicKey" },
    "stakePubKey": { "type": "getStakingPublicKey" },
    "addressInfo": { "type": "macro", "run": "{getAddressInfo(get('cache.address'))}" }
  }
}
```

## Key Function Types

| Function | Purpose |
|----------|---------|
| `data` | Return a static value |
| `script` | A nested code block |
| `macro` | ISL expression |
| `getCurrentAddress` | Get user's current Cardano address |
| `getName` | Get user's wallet display name |
| `getSpendingPublicKey` | Get spending pub key |
| `getStakingPublicKey` | Get staking pub key |
| `getNetworkInfo` | Get DLT tag, network tag, magic number |
| `getAddressInfo` | Parse address into components |
| `buildTx` | Build an unsigned transaction |
| `signTx` | Sign a transaction |
| `submitTx` | Submit signed transaction to chain |
| `mintTokens` | Mint native tokens or NFTs |
| `signData` | Sign arbitrary data (CIP-30 style) |

## ISL Functions Reference

- `get('cache.key')` -- read a cached value from a previous step
- `join('-', a, b)` -- join strings
- `getAddressInfo(addr)` -- parse address
- `toHex(value)` -- convert to hex
- `fromHex(value)` -- decode hex
- Arithmetic: `add(a, b)`, `sub(a, b)`, `mul(a, b)`

## Testing Methods

1. **Playground IDE**: https://wallet.gamechanger.finance/playground
   - Paste script JSON, get live URL, run on preprod

2. **CLI**: `gamechanger-cli preprod encode url -v 2 -f my-script.gcscript`

3. **Library**: `gc.encode.url({ input, apiVersion: '2', network: 'preprod', encoding: 'gzip' })`

## Transaction Pattern

All transaction scripts follow this step order:
1. `buildTx` -- construct the unsigned transaction
2. `signTx` -- sign with `{ get('cache.build.tx') }`
3. `submitTx` -- submit with `{ get('cache.sign.tx') }`

Never skip `signTx`. Never submit an unsigned transaction.
