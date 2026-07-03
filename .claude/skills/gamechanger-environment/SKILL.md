---
name: gamechanger-environment
description: Set up GameChanger Wallet UDC service layer -- library install, URL encoding, and result decoding
---

# gamechanger-environment

## Purpose

Guides integration of the GameChanger Wallet Universal Dapp Connector (UDC)
into the project. Covers npm library setup, GCScript URL encoding, QR code
generation, result decoding, network routing, and how the UDC differs from
CIP-30 browser extensions.

## When to Use

- Adding GameChanger Wallet as a Cardano auth or action flow
- Generating wallet request URLs or QR codes from a backend or frontend
- Decoding results returned from the wallet after execution
- Creating a "Create Wallet" flow that redirects users to GameChanger
- Any feature that interacts with Cardano without requiring a browser extension
- Generating embeddable HTML/React/Express snippet dapps via the CLI

## Core Concepts

### What is the Universal Dapp Connector?

GameChanger Wallet is a web-based non-custodial Cardano meta wallet. Unlike
CIP-30 extension wallets (Eternl, Lace, Typhon), it requires NO browser
extension. It communicates via URLs containing encoded GCScript JSON.

Key differences from CIP-30:
- No injected JS into the page -- no `window.cardano` entry
- Works on mobile, desktop, air-gapped devices, QR codes, NFC, printed labels
- Dapps build a URL, redirect user to wallet, wallet executes, redirects back
- Privacy-preserving: dapp does not need user address, UTXOs or balance to work
- Wallet URL base: `https://wallet.gamechanger.finance/api/2/run/{payload}`

### Official NPM Library

Package: `@gamechanger-finance/gc` (MIT)
Version: `>=1.1.1`
Node requirement: `>=24.12.0` for CLI; browser/React/Vite all supported

## Inputs

| Input | Source | Required |
|-------|--------|----------|
| GCScript JSON | Developer writes or generates | yes |
| Target network | mainnet or preprod | yes |
| Return URL pattern | Frontend/backend callback URL | no |
| Ref address | Cardano address for referral tracking | no |

## Workflow

1. **Install the library**: Run `pnpm add @gamechanger-finance/gc` in the target
   app directory (`Code/apps/web/` for frontend, `Code/apps/api/` for backend).
   For CLI: `npm install --global @gamechanger-finance/gc` (Node >= 24.12.0).

2. **Import**: Use ESM imports: `import gc from '@gamechanger-finance/gc'` or
   named: `import { gc, encode, snippet, encodings } from '@gamechanger-finance/gc'`

3. **Encode a GCScript into a wallet URL**: Build a GCScript JSON object, then call
   `gc.encode.url({ input, apiVersion: '2', network, encoding: 'gzip' })`.
   Optional params: `refAddress` (referral tracking), `urlPattern` (custom wallet URL).
   See `references/code-examples.md` for full encoding example.

4. **Generate QR codes** (optional): Call `gc.encode.qr({ input, apiVersion: '2',
   network, encoding: 'gzip', qrResultType: 'png' })` to get a data URI for
   embedding in `<img>` tags. Supports `png` and `svg` output.

5. **Decode the result**: After the wallet redirects back to your `returnURLPattern`,
   extract the `result` query parameter and decode with `encodings.msg.decoder()`.
   Handle missing/invalid results with try/catch. See `references/code-examples.md`.

6. **Create Wallet flow**: When a user has no CIP-30 extension, redirect to
   GameChanger using a minimal script. Use `window.open(url, '_blank', 'noopener,noreferrer')`.
   See `references/code-examples.md` for the full create-wallet script.

7. **Network routing**: Always include `networkTag` for deterministic links.
   `disableNetworkRouter: false` (default) appends `?networkTag=<network>`.
   Mainnet: `network: 'mainnet'`. Testnet: `network: 'preprod'`.

8. **CLI snippet generation** (optional): Use the CLI to generate full dapp
   boilerplates: `gamechanger-cli mainnet snippet html|react|express -v 2 -f script.gcscript`.
   See `references/code-examples.md` for CLI quick reference.

## Security Considerations

- GCScript executes inside the user's browser on the GameChanger domain -- NOT on your backend
- GCScript is domain-specific and non-turing-complete: cannot exfiltrate data outside Cardano scope
- All GCScript in URLs is publicly readable (auditable). Do not encode sensitive server data
- Validate returned addresses on the backend before trusting (use challenge-response for auth)
- NEVER redirect users to GameChanger URLs embedding user-supplied content without sanitizing
- Use `window.open(..., '_blank', 'noopener,noreferrer')` to prevent window.opener attacks
- Handle decode errors gracefully -- invalid `result` params should return 400, not crash

## Outputs

| Output | Format | Location |
|--------|--------|----------|
| GC URL encoder service | .ts | `Code/apps/web/src/lib/gamechanger-service.ts` |
| Wallet return handler | .tsx | `Code/apps/web/src/pages/auth/WalletReturnPage.tsx` |
| Backend result decoder | .ts | `Code/apps/api/src/services/gamechanger.ts` |

## Constraints

- Requires a user redirect to `wallet.gamechanger.finance` -- NOT a popup API
- Does NOT inject into `window.cardano` -- no CIP-30 compatibility
- Wallet execution happens on GC servers/browser -- cannot call your API during script
- GCScript payloads are public if not encrypted -- do not put secrets inside
- Always test on preprod before mainnet for transaction scripts
- Use `returnURLPattern` in the script to capture results, not URL hacks
- Must coexist with other skills -- does not modify global config or shared state

## Related Skills

- **gamechanger-scripting**: Writing GCScript DSL for transactions, minting, signing
- **cardano-fee-modeling**: Estimating ADA fees for scripts and network effects
- **authentication-system**: CIP-30 wallet auth flow (Eternl, Lace, Typhon, Yoroi)

## Self-Validation

### Trigger Indicators
- [ ] Feature needs wallet access without requiring a browser extension
- [ ] "Create Wallet" flow for users with no Cardano extension
- [ ] Need to generate wallet request URLs or QR codes
- [ ] Working with GameChanger Wallet integration

### Completion Markers
- [ ] `@gamechanger-finance/gc` installed in the correct workspace package
- [ ] GCScript encodes to a valid `wallet.gamechanger.finance` URL
- [ ] Return URL correctly decoded after wallet redirects back
- [ ] Network tag appended to all wallet-facing URLs
- [ ] Decode errors handled gracefully (try/catch, 400 response)

### Quality Signals
- [ ] No secrets in GCScript payloads
- [ ] `noopener,noreferrer` set on new-tab wallet links
- [ ] Backend validates returned address before trusting
- [ ] QR codes use data URIs, not external image services

### Lint Checks
- [ ] No hardcoded network choices -- use config or parameter
- [ ] No raw gzip encoding -- always use the library
- [ ] Return URL pattern uses origin-relative paths, not hardcoded domains
