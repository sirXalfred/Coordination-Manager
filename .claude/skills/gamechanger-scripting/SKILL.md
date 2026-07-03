---
name: gamechanger-scripting
description: Write GCScript DSL for Cardano transactions, minting, signing via GameChanger Wallet
---

# gamechanger-scripting

## Purpose

Guides writing GCScript DSL -- the JSON-based scripting language used by
GameChanger Wallet to interact with the Cardano protocol. Covers syntax,
common patterns, ISL inline scripting, transaction building, minting,
governance, multi-sig, and how to test scripts in the Playground IDE.

## When to Use

- Writing any GCScript `.gcscript` file or inline JSON payload
- Building transaction scripts (payment, minting, smart contract interactions)
- Using ISL (Inline Scripting Language) for dynamic GCScript values
- Creating workspace, key management, or address derivation scripts
- Working with multi-signature transactions
- Generating Plutus parameter scripts from user wallets
- Designing scripts for the Coordination Manager Cardano integration

## Core Language Properties

GCScript is:
- **JSON-based**: all scripts are valid JSON objects
- **Domain-specific**: only Cardano-related functions, cannot escape scope
- **Non-turing-complete**: deterministic, predictable, safer than general code
- **Isomorphic**: result structure mirrors script structure
- **Permission-based**: user sees and approves every action in wallet UI
- **Transport-agnostic**: works as URL, QR, NFC, backend redirect, or air-gap

## Inputs

| Input | Source | Required |
|-------|--------|----------|
| Script goal description | Developer provides | yes |
| Target network | mainnet or preprod | yes |
| GCScript API reference | https://wallet.gamechanger.finance/doc/api/v2 | reference |

## Workflow

1. **Define the script goal**: Identify which Cardano operation is needed (auth,
   payment, minting, signing, multi-sig). Select function types from the table in
   `references/gcscript-reference.md`. Auth: `getCurrentAddress` + `getName`.
   Payments: `buildTx` -> `signTx` -> `submitTx`. Signing: `signData`.

2. **Write the script structure**: Create a JSON object with `type: "script"` at root.
   Required fields: `title` (under 60 chars, shown in wallet UI), `description`
   (under 200 chars, consent text), `exportAs` (result key name). Add
   `returnURLPattern` with `{result}` placeholder when dapp needs results back.

3. **Implement the `run` block**: Add named steps using GCScript function types.
   Steps execute in order; each result is cached under `cache.{stepName}`.
   For transactions, always follow: `buildTx` -> `signTx` -> `submitTx`.
   Chain outputs with ISL: `{ get('cache.build.tx') }`.

4. **Add ISL expressions**: For dynamic values, use `{ }` syntax inside strings.
   Common patterns: `get('cache.stepName.field')` for chaining, `toHex(value)`
   for encoding, `join('-', a, b)` for string ops. See ISL reference in
   `references/gcscript-reference.md`.

5. **Test on preprod**: Use one of three methods:
   - Playground IDE: https://wallet.gamechanger.finance/playground (paste JSON, run live)
   - CLI: `gamechanger-cli preprod encode url -v 2 -f my-script.gcscript`
   - Library: `gc.encode.url({ input, apiVersion: '2', network: 'preprod', encoding: 'gzip' })`

6. **Save as .gcscript file**: Store as `kebab-case-name.gcscript` in
   `Code/apps/api/data/` for server-side scripts, or embed inline in TypeScript.
   Always include `title` and `description`. Keep titles under 60 chars.

## File Conventions

- Store GCScript files as `.gcscript` (JSON with `.gcscript` extension)
- Location: `Code/apps/api/data/` for server-side scripts, or inline in TypeScript
- Names: `kebab-case-description.gcscript`
- Always include `title` and `description` (shown to user in wallet UI for consent)
- Keep titles under 60 chars, descriptions under 200 chars

## Outputs

| Output | Format | Location |
|--------|--------|----------|
| Auth connect script | .gcscript | `Code/apps/api/data/gc-connect.gcscript` |
| Challenge-sign script | .gcscript | `Code/apps/api/data/gc-sign-challenge.gcscript` |
| Payment script | .gcscript | `Code/apps/api/data/gc-payment.gcscript` |

## Constraints

- NEVER put private keys, JWT secrets, or API credentials inside GCScript
- All GCScript in URLs is publicly readable (base64url + gzip, not encrypted)
- `description` and `title` are user-facing consent text -- make them accurate
- Do NOT use GCScript to trick users into signing transactions they did not expect
- Validate all `returnURLPattern` callback data server-side before trusting
- For auth flows: use a nonce/challenge pattern to prevent replay attacks
- Do NOT hardcode user addresses into scripts -- use `getCurrentAddress`
- Test all transaction scripts on `preprod` before deploying on `mainnet`
- Must coexist with other skills -- does not modify global config or shared state

## Related Skills

- **gamechanger-environment**: Library setup, URL encoding, result decoding, service layer
- **cardano-fee-modeling**: Estimating fees before building transactions
- **authentication-system**: CIP-30 auth flow (Eternl, Lace, Typhon, Yoroi)

## Self-Validation

### Trigger Indicators
- [ ] Writing a `.gcscript` file or inline GCScript JSON
- [ ] Building a transaction, minting, or signing flow via GameChanger
- [ ] ISL expressions needed inside a GCScript
- [ ] Script needs to return data to a dapp after wallet execution

### Completion Markers
- [ ] Script is valid JSON with `type: "script"` at root
- [ ] `title` and `description` present (user consent text)
- [ ] `exportAs` set to capture results
- [ ] `returnURLPattern` included when dapp needs results back
- [ ] Script tested on `preprod` before mainnet use

### Quality Signals
- [ ] No secrets in GCScript payload
- [ ] `description` accurately describes what the user is consenting to
- [ ] ISL expressions use `get('cache...')` correctly for chained values
- [ ] Transaction scripts call `buildTx` -> `signTx` -> `submitTx` in order

### Lint Checks
- [ ] No hardcoded user addresses -- use `getCurrentAddress` dynamically
- [ ] No private keys or secrets embedded in script JSON
- [ ] `returnURLPattern` uses the app domain, not third-party URLs
