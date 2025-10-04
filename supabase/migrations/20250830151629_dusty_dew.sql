/*
  # Add colors and sizes fields to products table

  1. New Columns
    - `colors` (text[], array of color names)
    - `sizes` (text[], array of size values for apparel and shoes)

  2. Purpose
    - Allow products to have multiple color options
    - Support both apparel sizes (PP, P, M, G, GG) and shoe sizes (33-48)
    - Enable better product filtering and display options

  3. Data Structure
    - colors: ["Vermelho", "Azul", "Preto"]
    - sizes: ["P", "M", "G", "37", "38", "39"] (mixed apparel and shoe sizes)
*/

-- Add colors and sizes columns to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS colors TEXT[],
ADD COLUMN IF NOT EXISTS sizes TEXT[];

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_products_colors ON products USING gin (colors);
CREATE INDEX IF NOT EXISTS idx_products_sizes ON products USING gin (sizes);