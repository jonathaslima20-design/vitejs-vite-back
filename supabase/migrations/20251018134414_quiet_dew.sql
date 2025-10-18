/*
  # Add billing_cycle column to subscriptions table

  1. Changes
    - Add `billing_cycle` column to `subscriptions` table with default value 'monthly'
    - Update existing records to have 'monthly' as default billing cycle
  
  2. Security
    - No RLS changes needed as this is just adding a column
*/

-- Add billing_cycle column to subscriptions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'billing_cycle'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN billing_cycle text DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'quarterly', 'semiannually', 'annually'));
  END IF;
END $$;

-- Update any existing records to have monthly billing cycle if null
UPDATE subscriptions 
SET billing_cycle = 'monthly' 
WHERE billing_cycle IS NULL;