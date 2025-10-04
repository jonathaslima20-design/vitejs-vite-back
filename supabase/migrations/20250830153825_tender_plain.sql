/*
  # Create user_custom_colors table

  1. New Tables
    - `user_custom_colors`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `hex_code` (text, color hex code like #RRGGBB)
      - `name` (text, optional user-defined name for the color)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `user_custom_colors` table
    - Add policy for users to manage their own custom colors
    - Add unique constraint to prevent duplicate colors per user

  3. Indexes
    - Index on user_id for performance
    - Unique index on user_id + hex_code to prevent duplicates
*/

-- Create the user_custom_colors table
CREATE TABLE IF NOT EXISTS user_custom_colors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hex_code text NOT NULL,
  name text,
  created_at timestamptz DEFAULT now()
);

-- Add constraint to ensure hex_code format
ALTER TABLE user_custom_colors 
ADD CONSTRAINT user_custom_colors_hex_code_check 
CHECK (hex_code ~ '^#[0-9A-Fa-f]{6}$');

-- Create unique constraint to prevent duplicate colors per user
ALTER TABLE user_custom_colors 
ADD CONSTRAINT user_custom_colors_user_id_hex_code_key 
UNIQUE (user_id, hex_code);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_custom_colors_user_id 
ON user_custom_colors (user_id);

CREATE INDEX IF NOT EXISTS idx_user_custom_colors_created_at 
ON user_custom_colors (created_at);

-- Enable Row Level Security
ALTER TABLE user_custom_colors ENABLE ROW LEVEL SECURITY;

-- Create policy for users to manage their own custom colors
CREATE POLICY "Users can manage own custom colors"
  ON user_custom_colors
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create policy for users to read their own custom colors
CREATE POLICY "Users can read own custom colors"
  ON user_custom_colors
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policy for users to insert their own custom colors
CREATE POLICY "Users can insert own custom colors"
  ON user_custom_colors
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create policy for users to update their own custom colors
CREATE POLICY "Users can update own custom colors"
  ON user_custom_colors
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create policy for users to delete their own custom colors
CREATE POLICY "Users can delete own custom colors"
  ON user_custom_colors
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add trigger to update updated_at column if we add it later
-- (Currently not needed as we only have created_at)

-- Insert some default popular colors for all existing users (optional)
-- This gives users a starting point with common colors
DO $$
DECLARE
  user_record RECORD;
  default_colors text[] := ARRAY[
    '#FF0000', -- Red
    '#00FF00', -- Green  
    '#0000FF', -- Blue
    '#FFFF00', -- Yellow
    '#FF00FF', -- Magenta
    '#00FFFF', -- Cyan
    '#000000', -- Black
    '#FFFFFF', -- White
    '#808080', -- Gray
    '#FFA500', -- Orange
    '#800080', -- Purple
    '#FFC0CB'  -- Pink
  ];
  color_code text;
BEGIN
  -- Loop through all existing users
  FOR user_record IN SELECT id FROM users LOOP
    -- Insert default colors for each user (ignore duplicates)
    FOREACH color_code IN ARRAY default_colors LOOP
      INSERT INTO user_custom_colors (user_id, hex_code, name)
      VALUES (user_record.id, color_code, NULL)
      ON CONFLICT (user_id, hex_code) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;