/*
  # Make price field optional in products table

  1. Database Changes
    - Make price column nullable in products table
    - Update existing products with null price to have a default value if needed
  
  2. Security
    - No changes to RLS policies needed
    - Existing policies will continue to work
*/

-- Make the price column nullable
ALTER TABLE public.products ALTER COLUMN price DROP NOT NULL;

-- Add a comment to document the change
COMMENT ON COLUMN public.products.price IS 'Product price - optional field. When null, product cannot be added to cart but can have external checkout link';