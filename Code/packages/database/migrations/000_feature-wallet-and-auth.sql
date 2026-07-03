-- Consolidated feature migration file: feature-wallet-and-auth
-- Generated from incremental files for easier agent navigation.
-- Keep statements idempotent when adding future changes.

-- ============================================================
-- BEGIN SOURCE: 006_cardano_wallets.sql
-- ============================================================
-- ============================================================
-- Migration 006: Cardano Wallet Authentication Support
-- Adds wallet_address column to users and wallet_challenges table
-- ============================================================

-- 1. Expand account_type to include 'cardano'
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_account_type_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_account_type_check
  CHECK (account_type IN ('google', 'traveler', 'cardano'));

-- 2. Add wallet columns to users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS wallet_address TEXT;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS stake_address TEXT;

-- 3. Unique index on wallet address (NULLs allowed)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_wallet_address_unique
  ON public.users(wallet_address)
  WHERE wallet_address IS NOT NULL;

-- 4. Wallet challenge nonces (short-lived, backend-managed)
CREATE TABLE IF NOT EXISTS public.wallet_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address TEXT NOT NULL,
  nonce TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wallet_challenges_expires
  ON public.wallet_challenges(expires_at);

CREATE INDEX IF NOT EXISTS idx_wallet_challenges_address
  ON public.wallet_challenges(wallet_address);

-- RLS — only service role can manage challenges
ALTER TABLE public.wallet_challenges ENABLE ROW LEVEL SECURITY;

-- No permissive policies needed — the API uses supabaseAdmin
-- (service_role) which bypasses RLS entirely.

-- 5. Periodic cleanup function for expired challenges
CREATE OR REPLACE FUNCTION cleanup_expired_wallet_challenges()
RETURNS void AS $$
BEGIN
  DELETE FROM public.wallet_challenges
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';


-- END SOURCE: 006_cardano_wallets.sql

-- ============================================================
-- BEGIN SOURCE: 059_managed_wallet.sql
-- ============================================================
-- ============================================================
-- Migration 059: Managed Wallet Support
-- Adds encrypted_wallet_blob column so users can have an
-- app-generated (non-custodial) Cardano identity key stored
-- encrypted on our server. The blob is AES-256-GCM encrypted
-- with a device-local key; the platform can never decrypt it.
-- ============================================================

-- 1. Add encrypted blob column
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS encrypted_wallet_blob TEXT;

-- 2. Expand account_type constraint to allow 'managed_cardano'
--    (an app-generated identity, distinct from a real CIP-30 wallet)
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_account_type_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_account_type_check
  CHECK (account_type IN ('google', 'traveler', 'cardano', 'managed_cardano'));

-- 3. Index on wallet_address already exists from migration 006;
--    managed wallet addresses start with 'managed_' so they
--    are naturally distinct from bech32/hex CIP-30 addresses.


-- END SOURCE: 059_managed_wallet.sql

