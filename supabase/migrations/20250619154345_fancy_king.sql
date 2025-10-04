/*
  # Add display_order field to products table

  1. Changes
    - Add display_order column to products table
    - Set default value to allow ordering
    - Add index for better performance

  2. Security
    - No changes to RLS policies needed
*/

-- Add display_order column to products table
ALTER TABLE products 
ADD COLUMN display_order INTEGER;

-- Add index for better performance when ordering
CREATE INDEX idx_products_display_order ON products(display_order);

-- Update existing products to have sequential display_order values
UPDATE products 
SET display_order = subquery.row_number 
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as row_number
  FROM products
) AS subquery 
WHERE products.id = subquery.id;