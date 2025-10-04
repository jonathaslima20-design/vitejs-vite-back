/*
  # Create User Colors Table

  1. New Tables
    - `user_colors`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `name` (text, color name like "Azul Marinho")
      - `hex_value` (text, hex color code like "#1a365d")
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `user_colors` table
    - Add policy for users to manage their own colors
    
  3. Indexes
    - Add index on user_id for performance
    - Add unique constraint on user_id + name to prevent duplicates
*/

-- Create user_colors table
CREATE TABLE IF NOT EXISTS user_colors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  hex_value text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Ensure unique color names per user
  CONSTRAINT unique_user_color_name UNIQUE (user_id, name)
);

-- Enable RLS
ALTER TABLE user_colors ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own colors"
  ON user_colors
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own colors"
  ON user_colors
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own colors"
  ON user_colors
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own colors"
  ON user_colors
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_colors_user_id ON user_colors(user_id);
CREATE INDEX IF NOT EXISTS idx_user_colors_name ON user_colors(user_id, name);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_user_colors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_colors_updated_at
  BEFORE UPDATE ON user_colors
  FOR EACH ROW
  EXECUTE FUNCTION update_user_colors_updated_at();