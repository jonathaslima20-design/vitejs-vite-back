/*
  # Add location_url field to users table

  1. Changes
    - Add location_url column to users table for storing location links (Google Maps, etc.)
    
  2. Security
    - No changes to RLS policies needed as this is just adding a new optional field
*/

-- Add location_url column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS location_url text;

-- Add comment to describe the column
COMMENT ON COLUMN users.location_url IS 'URL for location link (Google Maps, etc.)';