/**
 * CIP-30 type declarations for Cardano wallet browser extensions.
 * These types describe the API injected into window.cardano by wallets
 * like Eternl, Lace, Typhon, etc.
 */

/** Data signature result from CIP-30 signData (CIP-8 message signing) */
export interface DataSignature {
  signature: string // CBOR-encoded COSESign1
  key: string // CBOR-encoded COSEKey
}

/** The wallet API returned after enabling a wallet via CIP-30 */
export interface CardanoWalletApi {
  /** Get the wallet's used addresses (hex-encoded) */
  getUsedAddresses(): Promise<string[]>

  /** Get the wallet's unused/change addresses (hex-encoded) */
  getUnusedAddresses(): Promise<string[]>

  /** Get the wallet's reward/stake addresses (hex-encoded) */
  getRewardAddresses(): Promise<string[]>

  /** Get the network ID (0 = testnet, 1 = mainnet) */
  getNetworkId(): Promise<number>

  /** Get the wallet's UTxOs (hex-encoded CBOR) */
  getUtxos(): Promise<string[] | undefined>

  /** Get the wallet's remaining balance (hex-encoded CBOR) */
  getBalance(): Promise<string>

  /** Get collateral UTxOs (for Plutus script execution) */
  getCollateral(): Promise<string[] | undefined>

  /**
   * Sign arbitrary data using CIP-8 message signing.
   * @param address - The hex-encoded address to sign with
   * @param payload - The hex-encoded data to sign
   * @returns The signature and public key (COSESign1/COSEKey)
   */
  signData(address: string, payload: string): Promise<DataSignature>

  /**
   * Sign a transaction.
   * @param tx - The hex-encoded unsigned transaction (CBOR)
   * @param partialSign - If true, allows partial signing
   * @returns The hex-encoded transaction witness set
   */
  signTx(tx: string, partialSign?: boolean): Promise<string>

  /**
   * Submit a signed transaction to the network.
   * @param tx - The hex-encoded signed transaction (CBOR)
   * @returns The transaction hash
   */
  submitTx(tx: string): Promise<string>
}

/** A wallet entry injected into window.cardano by browser extensions */
export interface CardanoWalletEntry {
  name: string
  icon: string
  apiVersion: string
  isEnabled(): Promise<boolean>
  enable(): Promise<CardanoWalletApi>
}

/** Known wallet identifiers for window.cardano */
export type CardanoWalletId =
  | 'eternl'
  | 'lace'
  | 'typhonwallet'
  | 'yoroi'

/** Wallet metadata for UI display */
export interface WalletInfo {
  id: CardanoWalletId
  name: string
  installed: boolean
  icon?: string
}

/** Augment the global Window interface */
declare global {
  interface Window {
    cardano?: Partial<Record<CardanoWalletId, CardanoWalletEntry>> & Record<string, CardanoWalletEntry | undefined>
  }
}
