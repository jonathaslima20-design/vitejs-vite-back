/*
  # Create Custom Sizes Table

  1. New Tables
    - `user_custom_sizes`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `size_name` (text, the custom size name)
      - `size_type` (text, type of size: 'apparel', 'shoe', 'custom')
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `user_custom_sizes` table
    - Add policy for users to manage their own custom sizes

  3. Indexes
    - Add index on user_id for better performance
    - Add unique constraint on user_id + size_name to prevent duplicates
*/

CREATE TABLE IF NOT EXISTS user_custom_sizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  size_name text NOT NULL,
  size_type text NOT NULL DEFAULT 'custom',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_custom_sizes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read own custom sizes"
  ON user_custom_sizes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own custom sizes"
  ON user_custom_sizes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own custom sizes"
  ON user_custom_sizes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own custom sizes"
  ON user_custom_sizes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_custom_sizes_user_id ON user_custom_sizes(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_custom_sizes_unique ON user_custom_sizes(user_id, size_name, size_type);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_user_custom_sizes_updated_at'
  ) THEN
    CREATE TRIGGER update_user_custom_sizes_updated_at
      BEFORE UPDATE ON user_custom_sizes
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;