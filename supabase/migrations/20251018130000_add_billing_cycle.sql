/*
  # Add billing cycle to subscriptions

  1. Changes
    - Add `billing_cycle` column to subscriptions table
    - Add constraint to ensure valid billing cycle values

  2. Details
    - billing_cycle: Type of billing period (monthly, quarterly, semiannually, annually)
    - Default value: 'monthly'
*/

-- Add billing cycle type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billing_cycle_type') THEN
    CREATE TYPE billing_cycle_type AS ENUM ('monthly', 'quarterly', 'semiannually', 'annually');
  END IF;
END $$;

-- Add billing_cycle column to subscriptions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'billing_cycle'
  ) THEN
    ALTER TABLE subscriptions
    ADD COLUMN billing_cycle billing_cycle_type NOT NULL DEFAULT 'monthly';
  END IF;
END $$;
