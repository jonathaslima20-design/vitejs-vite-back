/*
  # Add Language and Currency Support

  1. New Columns
    - `language` (text) - User's preferred language for storefront display
      - Supported values: 'pt-BR', 'en-US', 'es-ES'
      - Default: 'pt-BR' (Portuguese - Brazil)
    - `currency` (text) - User's preferred currency for price display
      - Supported values: 'BRL', 'USD', 'EUR', 'GBP'
      - Default: 'BRL' (Brazilian Real)

  2. Security
    - No additional RLS policies needed (inherits from existing user policies)
    - Constraints added to ensure only valid values are accepted

  3. Changes
    - Added language column with check constraint for valid locales
    - Added currency column with check constraint for valid currencies
    - Both columns have sensible defaults for Brazilian market
*/

-- Add language column to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'language'
  ) THEN
    ALTER TABLE users ADD COLUMN language TEXT DEFAULT 'pt-BR';
  END IF;
END $$;

-- Add currency column to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'currency'
  ) THEN
    ALTER TABLE users ADD COLUMN currency TEXT DEFAULT 'BRL';
  END IF;
END $$;

-- Add check constraint for language (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'users' AND constraint_name = 'users_language_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_language_check 
    CHECK (language IN ('pt-BR', 'en-US', 'es-ES'));
  END IF;
END $$;

-- Add check constraint for currency (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'users' AND constraint_name = 'users_currency_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_currency_check 
    CHECK (currency IN ('BRL', 'USD', 'EUR', 'GBP'));
  END IF;
END $$;

-- Create index for language queries (optional, for performance)
CREATE INDEX IF NOT EXISTS idx_users_language ON users(language);

-- Create index for currency queries (optional, for performance)
CREATE INDEX IF NOT EXISTS idx_users_currency ON users(currency);