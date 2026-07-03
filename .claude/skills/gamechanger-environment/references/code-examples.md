# GameChanger Environment Code Examples

## Encoding a GCScript into a Wallet URL

```typescript
import gc from '@gamechanger-finance/gc'

const gcscript = {
  type: 'script',
  title: 'Connect with Coordination Manager?',
  description: 'Share your basic wallet info to sign in',
  exportAs: 'connect',
  run: {
    address: { type: 'getCurrentAddress' },
    name:    { type: 'getName' },
  },
  returnURLPattern: `${window.location.origin}/auth/wallet-return?result={result}`,
}

const url = await gc.encode.url({
  input: JSON.stringify(gcscript),
  apiVersion: '2',
  network: 'mainnet',
  encoding: 'gzip',
  disableNetworkRouter: false,
  // refAddress: 'addr1...',     // optional: referral tracking
  // urlPattern: 'https://...',  // optional: override wallet URL
})

window.location.href = url
```

## QR Code Generation

```typescript
const pngDataURI = await gc.encode.qr({
  input: JSON.stringify(gcscript),
  apiVersion: '2',
  network: 'mainnet',
  encoding: 'gzip',
  qrResultType: 'png',   // 'png' or 'svg'
})
// Use as <img src={pngDataURI} /> in React
```

## Decoding Wallet Results

### Frontend (from URL query string)

```typescript
import { encodings } from '@gamechanger-finance/gc'

const resultRaw = new URL(window.location.href).searchParams.get('result')
if (resultRaw) {
  const resultObj = await encodings.msg.decoder(resultRaw)
  // resultObj.exports.{exportAs}.{field}
  console.log(resultObj.exports.connect.address)
}
```

### Backend (Express)

```typescript
app.get('/auth/wallet-return', async (req, res) => {
  const resultRaw = req.query.result as string
  if (!resultRaw) {
    return res.status(400).json({ error: 'Missing result parameter' })
  }
  try {
    const resultObj = await encodings.msg.decoder(resultRaw)
    // Validate address before trusting -- challenge-response recommended
    res.json(resultObj.exports)
  } catch {
    res.status(400).json({ error: 'Invalid wallet result' })
  }
})
```

## Create Wallet Flow

```typescript
const createWalletScript = {
  type: 'script',
  title: 'Welcome to Coordination Manager',
  description: 'Create or import a Cardano wallet to get started',
  exportAs: 'createWallet',
  run: {
    address: { type: 'getCurrentAddress' },
    name:    { type: 'getName' },
  },
  returnURLPattern: `${window.location.origin}/auth/wallet-return?result={result}`,
}

const url = await gc.encode.url({
  input: JSON.stringify(createWalletScript),
  apiVersion: '2',
  network: 'mainnet',
  encoding: 'gzip',
})
window.open(url, '_blank', 'noopener,noreferrer')
```

## CLI Quick Reference

```bash
# Encode to URL
gamechanger-cli mainnet encode url -v 2 -f script.gcscript
# Encode to QR
gamechanger-cli mainnet encode qr -v 2 -o output.png -f script.gcscript
# Generate HTML dapp
gamechanger-cli mainnet snippet html -v 2 -S -o dapp.html -f script.gcscript
# Generate Express backend
gamechanger-cli mainnet snippet express -v 2 -o backend.js -f script.gcscript
```
