/*
  # Add external checkout URL field to products

  1. New Columns
    - `external_checkout_url` (text, optional) - URL for external checkout link

  2. Changes
    - Add external_checkout_url column to products table
    - Allow NULL values for optional external checkout links
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'external_checkout_url'
  ) THEN
    ALTER TABLE products ADD COLUMN external_checkout_url text;
  END IF;
END $$;