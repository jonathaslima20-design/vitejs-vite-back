/*
  # Add PIX holder name field

  1. New Columns
    - `user_pix_keys`
      - `holder_name` (text, required) - Nome do titular da chave PIX

  2. Changes
    - Add holder_name column to user_pix_keys table
    - Update existing records with placeholder name
*/

-- Add holder_name column to user_pix_keys table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_pix_keys' AND column_name = 'holder_name'
  ) THEN
    ALTER TABLE user_pix_keys ADD COLUMN holder_name text NOT NULL DEFAULT 'Nome do Titular';
  END IF;
END $$;