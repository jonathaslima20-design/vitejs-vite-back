/*
  # Add Gender and Brand Filters Support

  1. Schema Updates
    - Add gender column to products table
    - Update storefront settings to support brand and gender filters
  
  2. New Features
    - Gender filter (masculino, feminino, unissex)
    - Brand filter as separate option
    - Updated filter configurations
*/

-- Add gender column to products table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'gender'
  ) THEN
    ALTER TABLE products ADD COLUMN gender text;
    
    -- Add check constraint for gender values
    ALTER TABLE products ADD CONSTRAINT products_gender_check 
    CHECK (gender IS NULL OR gender = ANY (ARRAY['masculino'::text, 'feminino'::text, 'unissex'::text]));
  END IF;
END $$;

-- Update existing user_storefront_settings to include new filter options
UPDATE user_storefront_settings 
SET settings = jsonb_set(
  jsonb_set(
    settings,
    '{filters,showBrands}',
    'true'::jsonb,
    true
  ),
  '{filters,showGender}',
  'true'::jsonb,
  true
)
WHERE settings->'filters' IS NOT NULL;

-- For settings with old flat structure, migrate to new nested structure
UPDATE user_storefront_settings 
SET settings = jsonb_build_object(
  'filters', jsonb_build_object(
    'showFilters', COALESCE(settings->>'showFilters', 'true')::boolean,
    'showSearch', COALESCE(settings->>'showSearch', 'true')::boolean,
    'showPriceRange', COALESCE(settings->>'showPriceRange', 'true')::boolean,
    'showCategories', COALESCE(settings->>'showCategories', 'true')::boolean,
    'showBrands', true,
    'showGender', true,
    'showStatus', COALESCE(settings->>'showStatus', 'true')::boolean,
    'showCondition', COALESCE(settings->>'showCondition', 'true')::boolean
  ),
  'itemsPerPage', COALESCE((settings->>'itemsPerPage')::integer, 12)
)
WHERE settings->'filters' IS NULL;